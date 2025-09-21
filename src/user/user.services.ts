import { eq, and, or, like, sql, gt } from "drizzle-orm"
import { db } from "../database/connection"
import * as schema from "../database/schema/index"
import bcrypt from 'bcryptjs';
import crypto from "crypto"


import { logInfo, logError } from "../utils/logger"
import { validateInput, createUserSchema, updateUserSchema, updateAddressInfoSchema, updateOnlinePresenceSchema, updateProfessionalInfoSchema, updateBasicInfoSchema } from "../utils/validation"
import { azureEmailService } from "../../src/graphql/services/email.service"
import { createSession, getSession, deleteSession } from "../config/auth"
import { twilioSMSService } from "../graphql/services/twilio-sms.service"
import { googleAuthService } from "../graphql/services/google-auth.service"
import { azureStorage } from "../utils/azure-storage"


const { platformUsers, platformUserProfiles, otpTokens } = schema

export class PlatformUserService {
    // Create new platform user
    static async createUser(userData: any,adminId='') {
        try {
            // Validate input
            const validatedData = validateInput(createUserSchema, userData)

            // Check if user already exists by email
            const existingUser = await this.findUserByEmail(validatedData.email)
            if (existingUser) {
                throw new Error("User with this email already exists")
            }

            // Check if user already exists by phone
            const existingUserByPhone = await this.findUserByPhone(userData.phone)
            if (existingUserByPhone) {
                throw new Error("User with this phone number already exists")
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(validatedData.password, 12)

            console.log(userData);

			// Handle optional avatar upload to Azure (users folder)
			let avatarUrl: string | undefined
			const normalizedRole = ((validatedData.role || "USER").toUpperCase() as "OWNER" | "AGENT" | "USER")
			const resolveUpload = async (maybeUpload: any) => {
				if (!maybeUpload) return null
				return typeof maybeUpload?.promise === 'function' ? await maybeUpload.promise : maybeUpload
			}
			const profileUpload = await resolveUpload(userData.profileImage.file)
			if (profileUpload) {
				const variants = await azureStorage.uploadFile(profileUpload, "users")
				const baseFilename = variants?.[0]?.filename
				if (baseFilename) {
					const urls = azureStorage.getAllVariantUrls(baseFilename, "users")
					avatarUrl = urls.large || urls.original || Object.values(urls)[0]
				}
			}

			// Create user
			const [newUser] = await db
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
				.returning()

			// Create user profile
			await db.insert(platformUserProfiles).values({
				userId: newUser.id,
				phone: userData.phone,
				avatar: avatarUrl,
				address:userData.address
			})

			// Send welcome email
			if (validatedData.firstName) {
				await azureEmailService.sendWelcomeEmail(validatedData.email, validatedData.firstName)
			}

			logInfo("Platform user created successfully", { userId: newUser.id, email: validatedData.email })

			return newUser
		} catch (error) {
			logError("Failed to create platform user", error as Error, { email: userData.email, phone: userData.phone })
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

            return result?.user
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

    // Search users by name, email, phone, or id
    // page is 1-based (default 1)
    static async searchUsers(searchTerm:string,limit:number=10,page:number=1) {
        try {
            const trimmed = (searchTerm || "").trim()
            if (!trimmed) {
                throw new Error("Search term is required")
            }

            const wildcard = `%${trimmed}%`

            // sanitize pagination
            const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10))
            const safePage = Math.max(1, Number(page) || 1)
            const offset = (safePage - 1) * safeLimit

            // Build where clause once and reuse for count
            const whereClause = or(
                like(platformUsers.firstName, wildcard),
                like(platformUsers.lastName, wildcard),
                like(platformUsers.email, wildcard),
                like(platformUserProfiles.phone as any, wildcard),
            )

            const results = await db
                .select({
                    user: platformUsers,
                    profile: platformUserProfiles,
                })
                .from(platformUsers)
                .leftJoin(platformUserProfiles, eq(platformUsers.id, platformUserProfiles.userId))
                .where(whereClause)
                .limit(safeLimit)
                .offset(offset)

            const users = (results || []).map((row: any) => ({
                ...row.user,
                profile: row.profile,
            }))

            const [{ count }] = await db
                .select({ count: sql<number>`COUNT(*)` })
                .from(platformUsers)
                .leftJoin(platformUserProfiles, eq(platformUsers.id, platformUserProfiles.userId))
                .where(whereClause)

            const total = Number(count || 0)
            const totalPages = Math.max(1, Math.ceil(total / safeLimit))

            logInfo("Search users executed", { searchTerm: trimmed, returned: users.length, total })

            return {
                data: users,
                meta: {
                    page: safePage,
                    limit: safeLimit,
                    totalPages,
                },
            }
        } catch (error) {
            logError("Failed to search users", error as Error, { searchTerm })
            throw error
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
            const user = await this.findUserByPhone(phone)
            if (!user) {
                throw new Error("User not found with this phone number")
            }
            console.log(user, "dsd")

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

            if (remainingAttempts === 0) {
                throw new Error("Too many OTP attempts. Please try again later.")
            }

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

            // Send SMS via Azure
            console.log(phone)
            const smsSent = await twilioSMSService.sendOTP(phone, otp)

            if (!smsSent) {
                logError("Failed to send SMS OTP", new Error("SMS service failed"), { phone, userId: user.id })
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
            const user = await this.findUserByPhone(phone)
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

            return user
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

    // Update user profile
    static async updateUserProfile(userId: string, profileData: any) {
        try {
            const validatedData = validateInput(updateUserSchema.partial(), profileData)

            // Update user basic info
            if (validatedData.firstName || validatedData.lastName) {
                await db
                    .update(platformUsers)
                    .set({
                        firstName: validatedData.firstName,
                        lastName: validatedData.lastName,
                        updatedAt: new Date(),
                    })
                    .where(eq(platformUsers.id, userId))
            }

            // Update profile
            const profileUpdateData = { ...validatedData }
            delete profileUpdateData.firstName
            delete profileUpdateData.lastName

            if (Object.keys(profileUpdateData).length > 0) {
                await db
                    .update(platformUserProfiles)
                    .set({
                        ...profileUpdateData,
                        updatedAt: new Date(),
                    })
                    .where(eq(platformUserProfiles.userId, userId))
            }

            // Return updated user
            return await this.findUserById(userId)
        } catch (error) {
            logError("Failed to update user profile", error as Error, { userId })
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
            await azureEmailService.sendEmailVerification(user.email, verificationUrl)

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

    // Update Basic Information
    static async updateBasicInfo(userId: string, basicInfoData: any) {
        try {
            const validatedData = validateInput(updateBasicInfoSchema, basicInfoData)

            // Update user basic info (firstName, lastName, email)
            const userUpdateFields: { firstName?: string; lastName?: string; email?: string; updatedAt: Date } = {
                updatedAt: new Date(),
            }
            if (validatedData.firstName !== undefined) userUpdateFields.firstName = validatedData.firstName
            if (validatedData.lastName !== undefined) userUpdateFields.lastName = validatedData.lastName
            if (validatedData.email !== undefined) userUpdateFields.email = validatedData.email

            if (Object.keys(userUpdateFields).length > 1) {
                await db.update(platformUsers).set(userUpdateFields).where(eq(platformUsers.id, userId))
            }

            // Update profile fields
            const profileUpdateData: {
                bio?: string
                avatar?: string
                phone?: string
                updatedAt: Date
            } = { updatedAt: new Date() }

            if (validatedData.bio !== undefined) profileUpdateData.bio = validatedData.bio
            if (validatedData.avatar !== undefined) profileUpdateData.avatar = validatedData.avatar
            if (validatedData.phone !== undefined) profileUpdateData.phone = validatedData.phone

            if (Object.keys(profileUpdateData).length > 1) {
                await db.update(platformUserProfiles).set(profileUpdateData).where(eq(platformUserProfiles.userId, userId))
            }

            logInfo("Basic info updated successfully", { userId })
            return await this.findUserById(userId)
        } catch (error) {
            logError("Failed to update basic info", error as Error, { userId })
            throw error
        }
    }

    // Update Address Information
    static async updateAddressInfo(userId: string, addressInfoData: any) {
        try {
            const validatedData = validateInput(updateAddressInfoSchema, addressInfoData)

            const profileUpdateData: {
                address?: string
                state?: string
                city?: string
                country?: string
                pincode?: string
                location?: string
                updatedAt: Date
            } = { updatedAt: new Date() }

            if (validatedData.address !== undefined) profileUpdateData.address = validatedData.address
            if (validatedData.state !== undefined) profileUpdateData.state = validatedData.state
            if (validatedData.city !== undefined) profileUpdateData.city = validatedData.city
            if (validatedData.country !== undefined) profileUpdateData.country = validatedData.country
            if (validatedData.pincode !== undefined) profileUpdateData.pincode = validatedData.pincode
            if (validatedData.location !== undefined) profileUpdateData.location = validatedData.location

            if (Object.keys(profileUpdateData).length > 1) {
                await db.update(platformUserProfiles).set(profileUpdateData).where(eq(platformUserProfiles.userId, userId))
            }

            logInfo("Address info updated successfully", { userId })
            return await this.findUserById(userId)
        } catch (error) {
            logError("Failed to update address info", error as Error, { userId })
            throw error
        }
    }

    // Update Online Presence
    static async updateOnlinePresence(userId: string, onlinePresenceData: any) {
        try {
            const validatedData = validateInput(updateOnlinePresenceSchema, onlinePresenceData)

            const profileUpdateData: {
                website?: string
                socialLinks?: any
                updatedAt: Date
            } = { updatedAt: new Date() }

            if (validatedData.website !== undefined) profileUpdateData.website = validatedData.website
            if (validatedData.socialLinks !== undefined) profileUpdateData.socialLinks = validatedData.socialLinks

            if (Object.keys(profileUpdateData).length > 1) {
                await db.update(platformUserProfiles).set(profileUpdateData).where(eq(platformUserProfiles.userId, userId))
            }

            logInfo("Online presence updated successfully", { userId })
            return await this.findUserById(userId)
        } catch (error) {
            logError("Failed to update online presence", error as Error, { userId })
            throw error
        }
    }

    // Update Professional Information
    static async updateProfessionalInfo(userId: string, professionalInfoData: any) {
        try {
            const validatedData = validateInput(updateProfessionalInfoSchema, professionalInfoData)

            const profileUpdateData: {
                experience?: string
                specializations?: any
                languages?: any
                serviceAreas?: any
                updatedAt: Date
            } = { updatedAt: new Date() }

            if (validatedData.experience !== undefined) profileUpdateData.experience = String(validatedData.experience)
            if (validatedData.specializations !== undefined) profileUpdateData.specializations = validatedData.specializations
            if (validatedData.languages !== undefined) profileUpdateData.languages = validatedData.languages
            if (validatedData.serviceAreas !== undefined) profileUpdateData.serviceAreas = validatedData.serviceAreas

            if (Object.keys(profileUpdateData).length > 1) {
                await db.update(platformUserProfiles).set(profileUpdateData).where(eq(platformUserProfiles.userId, userId))
            }

            logInfo("Professional info updated successfully", { userId })
            return await this.findUserById(userId)
        } catch (error) {
            logError("Failed to update professional info", error as Error, { userId })
            throw error
        }
    }
}
