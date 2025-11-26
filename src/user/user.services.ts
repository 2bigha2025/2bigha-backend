import { eq, and, or, like, sql, gt, ilike } from "drizzle-orm"
import { db } from "../database/connection"
import * as schema from "../database/schema/index"
import bcrypt from 'bcryptjs';
import crypto from "crypto"
import { logInfo, logError } from "../utils/logger"
import { validateInput, createUserSchema, updateUserSchema} from "../utils/validation"
import { azureEmailService } from "../../src/graphql/services/email.service"
import { createSession, getSession, deleteSession } from "../config/auth"
import { twilioSMSService } from "../graphql/services/twilio-sms.service"
import { googleAuthService } from "../graphql/services/google-auth.service"
import { azureStorage } from "../utils/azure-storage"
import { filterDefined } from "../utils/filteredundefined";


const { platformUsers, platformUserProfiles, otpTokens } = schema

export class PlatformUserService {
    // Create new platform user
    static async createUser(userData: any, adminId = '') {
        try {
            // Validate input
            const validatedData = validateInput(createUserSchema, userData)
            // Check if user already exists by email
            const existingUser = validatedData?.email ? await this.findUserByEmail(validatedData.email) : await this.findUserByPhone(userData.phone);
            if (existingUser) {
                throw new Error("User already exists")
            }
            console.log("userData", userData);
            // Check if user already exists by phone

            // Hash password
            const hashedPassword = validatedData?.password ? await bcrypt.hash(validatedData.password, 12) : undefined

            // Handle optional avatar upload to Azure (users folder)
            let avatarUrl: string | undefined
            const normalizedRole = ((validatedData.role || "USER").toUpperCase() as "OWNER" | "AGENT" | "USER")
            const resolveUpload = async (maybeUpload: any) => {
                if (!maybeUpload) return null
                return typeof maybeUpload?.promise === 'function' ? await maybeUpload.promise : maybeUpload
            }
            // Safely resolve an optional uploaded file (may be undefined)
            const profileImageFile = userData?.profileImage?.file ?? null
            // console.log('profileImage.file ->', profileImageFile)
            const profileUpload = await resolveUpload(profileImageFile)
            if (profileUpload) {
                const variants = await azureStorage.uploadFile(profileUpload, "users")
                const baseFilename = variants?.[0]?.filename
                if (baseFilename) {
                    const urls = azureStorage.getAllVariantUrls(baseFilename, "users")
                    avatarUrl = urls.large || urls.original || Object.values(urls)[0]
                }
            }
            const result = await db.transaction(async (tx) => {
                // Create user
                const [newUser] = await tx
                    .insert(platformUsers)
                    .values({
                        email: validatedData.email,
                        firstName: validatedData.firstName,
                        lastName: validatedData.lastName,
                        password: hashedPassword,
                        role: normalizedRole,
                        isActive: true,
                        isVerified: false,
                        createdByAdminId: adminId || null,
                    })
                    .returning();

                // Create user profile
                await tx.insert(platformUserProfiles).values({
                    userId: newUser.id,
                    phone: userData.phone || null,
                    whatsappNumber: userData.whatsappNumber,
                    avatar: avatarUrl || null,
                    address: userData.address || null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });

                return newUser;
            });
            // Send welcome email
            if (validatedData.email && validatedData.firstName) {
                await azureEmailService.sendWelcomeEmail(validatedData.email, validatedData.firstName)
            }

            logInfo("Platform user created successfully", { userId: result.id, email: validatedData.email })
            return result
        } catch (error) {
            logError("Failed to create platform user", error as Error, { email: userData.email, phone: userData.phone })
            throw error
        }
    }

    static async updateUser(userId: string, updated_by = '', userData: any) {
        try {
            // Validate input
            if (!userId || typeof userId !== "string") {
                throw new Error("Invalid userId");
            }
             console.log("userId", userId);
            // Fetch current user once
            const existingUser = await this.findUserById(userId);
            if (!existingUser) {
                throw new Error(`User with ID ${userId} not found`);
            }
            console.log("existinguser",existingUser);
            console.log("userdata", userData);
            const validatedData = validateInput(updateUserSchema.partial(), userData);
            // Handle optional avatar upload to Azure (users folder)
            let avatarUrl: string | undefined
            const normalizedRole = ((validatedData.role||'USER').toUpperCase() as "OWNER" | "AGENT" | "USER")
            const resolveUpload = async (maybeUpload: any) => {
                if (!maybeUpload) return null
                return typeof maybeUpload?.promise === 'function' ? await maybeUpload.promise : maybeUpload
            }
            // Safely resolve an optional uploaded file (may be undefined)
            const profileImageFile = userData?.avatar?.file ?? null
            // console.log('profileImage.file ->', profileImageFile)
            const profileUpload = await resolveUpload(profileImageFile)
            if (profileUpload) {
                const variants = await azureStorage.uploadFile(profileUpload, "users")
                const baseFilename = variants?.[0]?.filename
                if (baseFilename) {
                    const urls = azureStorage.getAllVariantUrls(baseFilename, "users")
                    avatarUrl = urls.large || urls.original || Object.values(urls)[0]
                }
            }
            // update user
            // console.log("validatedData", validatedData);
            const userUpdates = filterDefined({
                email: validatedData.email?.trim().toLowerCase(),
                firstName: validatedData.firstName?.trim(),
                lastName: validatedData.lastName?.trim(),
                ...(normalizedRole ? { role: normalizedRole } : {}),
                updatedby: updated_by,
                updatedAt: new Date(),
            });

            const profileUpdates = filterDefined({
                phone: validatedData.phone ? String(validatedData.phone).trim() : undefined,
                avatar: avatarUrl,
                address: validatedData.address ? String(validatedData.address).trim() : undefined,
                updatedAt: new Date(),
            });
            console.log(userUpdates, profileUpdates);
            let updatedUserRow = null;
            let updatedProfileRow = null;

            const [userRow] = await db
                .update(platformUsers)
                .set(userUpdates)
                .where(eq(platformUsers.id, existingUser.id))
                .returning(); // Returns updated row
            updatedUserRow = userRow;

            const [profileRow] = await db
                .update(platformUserProfiles)
                .set(profileUpdates)
                .where(eq(platformUserProfiles.userId, existingUser.id))
                .returning(); // Returns updated row
            updatedProfileRow = profileRow;

            // Merge updated rows with existing data
            const finalUser = {
                ...existingUser,
                ...updatedUserRow, // override with updated fields
                profile: {
                    ...existingUser.profile,
                    ...updatedProfileRow, // override profile fields
                }
            };

            logInfo("Platform user updated successfully", { userId: finalUser?.id, email: validatedData?.email })
            return finalUser
        } catch (error) {
            logError("Failed to update platform user", error as Error, { email: userData.email, phone: userData.phone })
            throw error
        }
    }

    // Find user by email
    static async findUserByEmail(email: string) {
        try {
            const [user] = await db.select().from(platformUsers).where(eq(platformUsers.email, email))

            return user
        } catch (error) {
            logError("Failed to find user by email", error as Error, { email })
            return null
        }
    }

    static async getAllUsers(limit: number = 10, page: number = 1, searchTerm: string) {
        try {
            const offset = (page - 1) * limit;
            if (searchTerm) {
                const { data, meta } = await this.searchUsers(searchTerm, limit, page);
                return { data, meta };
            } else {
                const results = await db
                    .select({
                        user: {
                            id: platformUsers.id,
                            firstName: platformUsers.firstName,
                            lastName: platformUsers.lastName,
                            email: platformUsers?.email || "",
                            role: platformUsers.role,
                            lastLoginAt: platformUsers.lastLoginAt,
                            isActive: platformUsers.isActive,
                            updatedAt: platformUsers.updatedAt,
                        },
                        profile: {
                            id: platformUserProfiles.id,
                            userId: platformUserProfiles.userId,
                            phone: platformUserProfiles.phone,
                            address: platformUserProfiles.address,
                            createdAt: platformUserProfiles.createdAt,
                            totalReviews: platformUserProfiles.totalReviews,
                            avatar: platformUserProfiles.avatar,
                        },
                    })
                    .from(platformUsers)
                    .innerJoin(
                        platformUserProfiles,
                        eq(platformUsers.id, platformUserProfiles.userId)
                    )
                    .limit(limit)
                    .offset(offset);

                const [{ count }] = await db
                    .select({ count: sql<number>`COUNT(*)` })
                    .from(platformUsers)
                    .innerJoin(
                        platformUserProfiles,
                        eq(platformUsers.id, platformUserProfiles.userId)
                    )
                const data = results.map((row: any) => ({
                    ...row.user,
                    profile: row.profile,
                }))
                return {
                    data,
                    meta: {
                        total: count,
                        page,
                        limit,
                        totalPages: Math.ceil(count / limit),
                    },
                };

            }

        } catch (error) {
            logError("Failed to getUsers from the table", error as Error);
            return null;
        }
    }
    // Find user by phone
    static async findUserByPhone(phone: string) {
        try {
            const [result] = await db
                .select({
                    user: platformUsers,
                    profile: platformUserProfiles,
                })
                .from(platformUsers)
                .innerJoin(platformUserProfiles, eq(platformUsers.id, platformUserProfiles.userId))
                .where(eq(platformUserProfiles.phone, phone))
                return result
        } catch (error) {
            logError("Failed to find user by phone", error as Error, { phone })
            return null
        }
    }

    // Find user by ID with profile
    static async findUserById(userId: string) {
        try {
            const [result] = await db
                .select({
                    user: platformUsers,
                    profile: platformUserProfiles,
                })
                .from(platformUsers)
                .leftJoin(platformUserProfiles, eq(platformUsers.id, platformUserProfiles.userId))
                .where(eq(platformUsers.id, userId))



            if (!result) return null

            return {
                ...result.user,
                profile: result.profile,
            }
        } catch (error) {
            logError("Failed to find user by ID", error as Error, { userId })
            return null
        }
    }

    // Verify password
    static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
        try {
            return await bcrypt.compare(password, hashedPassword)
        } catch (error) {
            logError("Password verification failed", error as Error)
            return false
        }
    }

    static async searchUsers(searchTerm: string, limit: number = 30, page: number = 1) {
        try {
            const trimmed = (searchTerm || "").trim();
            if (!trimmed) throw new Error("Search term is required");

            const queryParts = trimmed.split(" ").filter(Boolean);
            const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
            const safePage = Math.max(1, Number(page) || 1);
            const offset = (safePage - 1) * safeLimit;

            let whereClause;

            if (queryParts.length === 1) {
                // 🔹 Single-word search (case-insensitive)
                whereClause = or(
                    ilike(platformUsers.firstName, `%${queryParts[0]}%`),
                    ilike(platformUsers.lastName, `%${queryParts[0]}%`)
                );
            } else if (queryParts.length >= 2) {
                const [first, last] = queryParts;

                if (last && last.length > 0) {
                    // 🔹 Two words → both must match (case-insensitive)
                    whereClause = and(
                        ilike(platformUsers.firstName, `%${first}%`),
                        ilike(platformUsers.lastName, `%${last}%`)
                    );
                } else {
                    // 🔹 Fallback if last name is empty
                    whereClause = or(
                        ilike(platformUsers.firstName, `%${first}%`),
                        ilike(platformUsers.lastName, `%${first}%`)
                    );
                }
            }

            const results = await db
                .select({
                    user: {
                        id: platformUsers.id,
                        firstName: platformUsers.firstName,
                        lastName: platformUsers.lastName,
                        email: platformUsers.email,
                        role: platformUsers.role,
                        isActive: platformUsers.isActive,
                        lastLoginAt: platformUsers.lastLoginAt,
                        updatedAt: platformUsers.updatedAt,
                        createdAt: platformUsers.createdAt,
                    },
                    profile: platformUserProfiles,
                })
                .from(platformUsers)
                .leftJoin(platformUserProfiles, eq(platformUsers.id, platformUserProfiles.userId))
                .where(whereClause)
                .limit(safeLimit)
                .offset(offset);

            const users = (results || []).map((row: any) => ({
                ...row.user,
                profile: row.profile,
            }));

            const [{ count }] = await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(platformUsers)
                .leftJoin(platformUserProfiles, eq(platformUsers.id, platformUserProfiles.userId))
                .where(whereClause);

            const total = Number(count || 0);
            const totalPages = Math.max(1, Math.ceil(total / safeLimit));

            return {
                data: users,
                meta: { total, page: safePage, limit: safeLimit, totalPages },
            };
        } catch (error) {
            logError("Failed to search users", error as Error, { searchTerm });
            throw error;
        }
    }


    // Update last login
    static async updateLastLogin(userId: string) {
        try {
            await db
                .update(platformUsers)
                .set({
                    lastLoginAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(platformUsers.id, userId))
        } catch (error) {
            logError("Failed to update last login", error as Error, { userId })
        }
    }

    // Create user session
    static createUserSession(userId: string, email: string, role: string): string {
        return createSession(userId, email, role)
    }

    // Get user session
    static getUserSession(token: string) {
        return getSession(token)
    }

    // Delete user session
    static deleteUserSession(token: string) {
        return deleteSession(token)
    }

    // Send phone OTP
    static async sendPhoneOTP(
        phone: string,
    ): Promise<{ success: boolean; expiresIn: number; remainingAttempts: number }> {
        try {
            let result = await this.findUserByPhone(phone.slice(3))
            if (!result?.user) {
                const newuser = await this.createUser({ role: 'USER', phone: phone });
                user = newuser;
                console.log("new user created", newuser);
            }
            const user = result?.user

            // Check rate limiting
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
            const recentOTPs = await db
                .select()
                .from(otpTokens)
                .where(
                    and(
                        eq(otpTokens.platformUserId, user.id),
                        eq(otpTokens.type, "PHONE_LOGIN"),
                        gt(otpTokens.createdAt, oneHourAgo)
                    ),
                )

            const maxAttempts = 5
            const attemptsUsed = recentOTPs.length
            const remainingAttempts = Math.max(0, maxAttempts - attemptsUsed)

            // if (remainingAttempts === 0) {
            //     throw new Error("Too many OTP attempts. Please try again later.")
            // }

            // Generate OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString()
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
            const expiresIn = 10 * 60 // 600 seconds

            // Invalidate existing OTPs
            await db
                .update(otpTokens)
                .set({ isUsed: true, usedAt: new Date() })
                .where(
                    and(eq(otpTokens.platformUserId, user.id), eq(otpTokens.type, "PHONE_LOGIN"), eq(otpTokens.isUsed, false)),
                )

            // Create new OTP
            await db.insert(otpTokens).values({
                platformUserId: user.id,
                token: otp,
                type: "PHONE_LOGIN",
                expiresAt,
            })

            const smsSent = await twilioSMSService.sendOTP(`+91${phone}`, otp)

            if (!smsSent) {
                logError("Failed to send SMS OTP", new Error("SMS service failed"), { phone, userId: user.id })
                throw new Error("Failed to send SMS OTP");
            }

            logInfo("Phone OTP sent", { phone, userId: user.id, smsSent })

            return {
                success: true,
                expiresIn,
                remainingAttempts: remainingAttempts - 1,
            }
        } catch (error) {
            logError("Failed to send phone OTP", error as Error, { phone })
            throw error
        }
    }

    // Verify phone OTP
    static async verifyPhoneOTP(phone: string, otp: string) {
        try {
            const result = await this.findUserByPhone(phone)
            const user = result?.user as any
            if (!user) {
                throw new Error("User not found with this phone number")
            }
            console.log(user)

            // Find valid OTP
            const [otpRecord] = await db
                .select()
                .from(otpTokens)
                .where(
                    and(
                        eq(otpTokens.platformUserId, user.id),
                        eq(otpTokens.token, otp),
                        eq(otpTokens.type, "PHONE_LOGIN"),
                        eq(otpTokens.isUsed, false),
                        // gt(otpTokens.expiresAt, new Date()),
                    ),
                )

            if (!otpRecord) {
                throw new Error("Invalid or expired OTP")
            }

            // Mark OTP as used
            await db.update(otpTokens).set({ isUsed: true, usedAt: new Date() }).where(eq(otpTokens.id, otpRecord.id))

            // Update last login
            await this.updateLastLogin(user.id)

            logInfo("Phone OTP verified successfully", { phone, userId: user.id })

            return result
        } catch (error) {
            logError("Phone OTP verification failed", error as Error, { phone })
            throw error
        }
    }

    // Google authentication
    static async authenticateWithGoogle(googleToken: string) {
        try {
            // Verify Google token and get user info
            const googleUser = await googleAuthService.verifyToken(googleToken)

            if (!googleUser) {
                throw new Error("Invalid Google token")
            }

            // Check if user exists
            let user = await this.findUserByEmail(googleUser.email)
            let isNewUser = false

            if (!user) {
                // Create new user from Google data
                const [newUser] = await db
                    .insert(platformUsers)
                    .values({
                        email: googleUser.email,
                        firstName: googleUser.given_name,
                        lastName: googleUser.family_name,
                        role: "USER",
                        isActive: true,
                        isVerified: true, // Google accounts are pre-verified
                        emailVerifiedAt: new Date(),
                    })
                    .returning()

                // Create profile
                await db.insert(platformUserProfiles).values({
                    userId: newUser.id,
                    avatar: googleUser.picture,
                })

                user = newUser
                isNewUser = true

                // Send welcome email
                if (googleUser.given_name) {
                    await azureEmailService.sendWelcomeEmail(googleUser.email, googleUser.given_name)
                }

                logInfo("New user created via Google auth", { userId: user.id, email: googleUser.email })
            } else {
                // Update last login for existing user
                await this.updateLastLogin(user?.id)
                logInfo("Existing user logged in via Google", { userId: user.id, email: googleUser.email })
            }

            return { user, isNewUser }
        } catch (error) {
            logError("Google authentication failed", error as Error)
            throw error
        }
    }


    // Send email verification
    static async sendEmailVerification(userId: string) {
        try {
            const user = await this.findUserById(userId)
            if (!user) {
                throw new Error("User not found")
            }

            if (user.isVerified) {
                throw new Error("Email is already verified")
            }

            // Generate verification token
            const verificationToken = crypto.randomBytes(32).toString("hex")
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

            // Store verification token
            await db.insert(otpTokens).values({
                platformUserId: user.id,
                token: verificationToken,
                type: "EMAIL_VERIFICATION",
                expiresAt,
            })

            // Send verification email
            const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`
            if (user.email) { await azureEmailService.sendEmailVerification(user.email, verificationUrl) }
            logInfo("Email verification sent", { userId, email: user.email })

            return true
        } catch (error) {
            logError("Failed to send email verification", error as Error, { userId })
            throw error
        }
    }

    // Verify email
    static async verifyEmail(token: string) {
        try {
            // Find valid token
            const [tokenRecord] = await db
                .select()
                .from(otpTokens)
                .where(
                    and(
                        eq(otpTokens.token, token),
                        eq(otpTokens.type, "EMAIL_VERIFICATION"),
                        eq(otpTokens.isUsed, false),
                        sql`expires_at > NOW()`,
                    ),
                )

            if (!tokenRecord || !tokenRecord.platformUserId) {
                throw new Error("Invalid or expired verification token")
            }

            // Mark token as used
            await db.update(otpTokens).set({ isUsed: true, usedAt: new Date() }).where(eq(otpTokens.id, tokenRecord.id))

            // Update user as verified
            await db
                .update(platformUsers)
                .set({
                    isVerified: true,
                    emailVerifiedAt: new Date(),
                    updatedAt: new Date(),
                })
                .where(eq(platformUsers.id, tokenRecord.platformUserId))

            logInfo("Email verified successfully", { userId: tokenRecord.platformUserId })

            return await this.findUserById(tokenRecord?.platformUserId)
        } catch (error) {
            logError("Email verification failed", error as Error, { token })
            throw error
        }
    }
}
