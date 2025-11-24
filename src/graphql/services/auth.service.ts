import { eq, and, sql, gt } from "drizzle-orm"
import { db } from "../../database/connection"
import * as schema from "../../database/schema/index"
import bcrypt from 'bcryptjs';
import { createSession, getSession, deleteSession } from "../../config/auth"
import { logInfo, logError } from "../../utils/logger"
import crypto from "crypto"

const { adminUsers, adminUserRoles, adminRoles, adminPermissions, adminRolePermissions, adminActivityLogs, otpTokens } =
    schema

export class AdminAuthService {
    // Find admin user by email
    static async findAdminByEmail(email: string) {
        const [admin] = await db
            .select()
            .from(adminUsers)
            .where(and(eq(adminUsers.email, email), eq(adminUsers.isActive, true)))
        return admin
    }

    // Find admin user by ID with roles and permissions
    static async findAdminById(adminId: string) {
        const [admin] = await db
            .select()
            .from(adminUsers)
            .where(and(eq(adminUsers.id, adminId), eq(adminUsers.isActive, true)))

        return admin
    }

    // Get admin user with roles and permissions
    static async getAdminWithPermissions(adminId: string) {
        // Get admin user
        const admin = await this.findAdminById(adminId)
        if (!admin) return null

        // Get admin roles
        const roles = await db
            .select({
                roleId: adminRoles.id,
                roleName: adminRoles.name,
                roleSlug: adminRoles.slug,
                roleDescription: adminRoles.description,
                roleColor: adminRoles.color,
            })
            .from(adminUserRoles)
            .innerJoin(adminRoles, eq(adminUserRoles.roleId, adminRoles.id))
            .where(eq(adminUserRoles.userId, adminId))



        // Get all permissions for this admin
        const permissions = await db
            .select({
                permissionId: adminPermissions.id,
                permissionName: adminPermissions.name,
                resource: adminPermissions.resource,
                action: adminPermissions.action,
                description: adminPermissions.description,
            })
            .from(adminUserRoles)
            .innerJoin(adminRolePermissions, eq(adminUserRoles.roleId, adminRolePermissions.roleId))
            .innerJoin(adminPermissions, eq(adminRolePermissions.permissionId, adminPermissions.id))
            .where(eq(adminUserRoles.userId, adminId))

        return {
            admin,
            roles,
            permissions,
        }
    }

    // Check if admin has specific permission
    static async hasPermission(adminId: string, permissionName: string): Promise<boolean> {
        const [result] = await db
            .select({ count: sql<number>`count(*)` })
            .from(adminUserRoles)
            .innerJoin(adminRolePermissions, eq(adminUserRoles.roleId, adminRolePermissions.roleId))
            .innerJoin(adminPermissions, eq(adminRolePermissions.permissionId, adminPermissions.id))
            .where(and(eq(adminUserRoles.userId, adminId), eq(adminPermissions.name, permissionName)))

        return result.count > 0
    }

    // Check if admin has any of the specified permissions
    static async hasAnyPermission(adminId: string, permissionNames: string[]): Promise<boolean> {
        const [result] = await db
            .select({ count: sql<number>`count(*)` })
            .from(adminUserRoles)
            .innerJoin(adminRolePermissions, eq(adminUserRoles.roleId, adminRolePermissions.roleId))
            .innerJoin(adminPermissions, eq(adminRolePermissions.permissionId, adminPermissions.id))
            .where(and(eq(adminUserRoles.userId, adminId), sql`${adminPermissions.name} = ANY(${permissionNames})`))

        return result.count > 0
    }

    // Verify password
    static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
        return await bcrypt.compare(password, hashedPassword)
    }

    // Update last login
    static async updateLastLogin(adminId: string) {
        await db
            .update(adminUsers)
            .set({
                lastLoginAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(adminUsers.id, adminId))
    }

    // Log admin activity
    static async logAdminActivity(
        adminId: string,
        action: string,
        resourceType?: string,
        resourceId?: string,
        details?: any,
        ipAddress = "127.0.0.1",
    ) {
        try {
            await db.insert(adminActivityLogs).values({
                adminId,
                action,
                resource: resourceType,
                resourceId,
                details,
                ipAddress,
                createdAt: new Date(),
            })

            logInfo(`Admin activity logged: ${action}`, { adminId, resourceType, resourceId })
        } catch (error) {
            logError("Failed to log admin activity", error as Error, { adminId, action })
        }
    }

    // Verify OTP token for admin
    static async verifyAdminOTP(adminId: string, otp: string, type: string) {
        const [otpRecord] = await db
            .select()
            .from(otpTokens)
            .where(
                and(
                    eq(otpTokens.adminUserId, adminId),
                    eq(otpTokens.token, otp),
                    eq(otpTokens.type, type),
                    eq(otpTokens.isUsed, false),
                    sql`expires_at > NOW()`,
                ),
            )

        if (otpRecord) {
            // Mark OTP as used
            await db
                .update(otpTokens)
                .set({
                    isUsed: true,
                    usedAt: new Date(),
                })
                .where(eq(otpTokens.id, otpRecord.id))
        }

        return otpRecord
    }

    // Create admin session
    static createAdminSession(adminId: string, email: string, roles: string[],phone:string): string {
        return createSession(adminId, email, roles.join(","),phone)
    }

    // Get admin session
    static getAdminSession(token: string) {
        return getSession(token)
    }

    // Delete admin session
    static deleteAdminSession(token: string) {
        return deleteSession(token)
    }

    // Assign role to admin
    static async assignRoleToAdmin(adminId: string, roleId: string, assignedBy: string) {
        await db.insert(adminUserRoles).values({
            userId: adminId,
            roleId,
            assignedBy,
        })
    }

    // Remove role from admin
    static async removeRoleFromAdmin(adminId: string, roleId: string) {
        await db.delete(adminUserRoles).where(and(eq(adminUserRoles.userId, adminId), eq(adminUserRoles.roleId, roleId)))
    }

    // Get all admin users with their roles
    static async getAllAdminsWithRoles() {
        return await db
            .select({
                adminId: adminUsers.id,

                email: adminUsers.email,
                firstName: adminUsers.firstName,
                lastName: adminUsers.lastName,
                department: adminUsers.department,
                employeeId: adminUsers.employeeId,
                phone: adminUsers.phone,
                isActive: adminUsers.isActive,
                lastLoginAt: adminUsers.lastLoginAt,
                createdAt: adminUsers.createdAt,
                roleName: adminRoles.name,
                roleSlug: adminRoles.slug,
                roleColor: adminRoles.color,
            })
            .from(adminUsers)
            .leftJoin(adminUserRoles, eq(adminUsers.id, adminUserRoles.userId))
            .leftJoin(adminRoles, eq(adminUserRoles.roleId, adminRoles.id))
            .orderBy(adminUsers.createdAt)
    }

    static generateOTP(): string {
        return Math.floor(100000 + Math.random() * 900000).toString()
    }

    // Create refresh token
    static async createRefreshToken(adminId: string, ipAddress?: string, userAgent?: string): Promise<string> {
        const refreshToken = crypto.randomBytes(64).toString("hex")
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

        await db.insert(schema.adminSessions).values({
            adminId,
            token: crypto.createHash("sha256").update(refreshToken).digest("hex"), // Store hashed
            refreshToken: refreshToken,
            ipAddress: ipAddress || "127.0.0.1",
            userAgent: userAgent || "Unknown",
            expiresAt,
            isActive: true,
        })

        return refreshToken
    }

    // Validate refresh token
    static async validateRefreshToken(refreshToken: string): Promise<any> {
        const hashedToken = crypto.createHash("sha256").update(refreshToken).digest("hex")

        const [session] = await db
            .select({
                adminId: schema.adminSessions.adminId,
                expiresAt: schema.adminSessions.expiresAt,
                isActive: schema.adminSessions.isActive,
            })
            .from(schema.adminSessions)
            .where(
                and(
                    eq(schema.adminSessions.token, hashedToken),
                    eq(schema.adminSessions.isActive, true),
                    gt(schema.adminSessions.expiresAt, new Date()),
                ),
            )

        if (!session) return null

        // Update last used timestamp
        await db.update(schema.adminSessions).set({ lastUsedAt: new Date() }).where(eq(schema.adminSessions.token, hashedToken))

        return session
    }

    // Create and send OTP
    static async createOTP(adminId: string, type: string, email: string): Promise<{ otp: string; expiresIn: number }> {
        const otp = this.generateOTP()
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        const expiresIn = 10 * 60 // 600 seconds

        // Invalidate existing OTPs of same type
        await db
            .update(otpTokens)
            .set({ isUsed: true, usedAt: new Date() })
            .where(and(eq(otpTokens.adminUserId, adminId), eq(otpTokens.type, type), eq(otpTokens.isUsed, false)))

        // Create new OTP
        await db.insert(otpTokens).values({
            adminUserId: adminId,
            token: otp,
            type,
            expiresAt,
        })

        // Log OTP creation
        await db.insert(adminActivityLogs).values({
            adminId,
            action: "otp_created",
            resource: "auth",
            details: { type, email, expiresIn },
            ipAddress: "127.0.0.1",
        })

        // TODO: Send OTP via email/SMS service
        console.log(`OTP for ${email}: ${otp} (expires in ${expiresIn} seconds)`)

        return { otp, expiresIn }
    }

    // Verify OTP
    static async verifyOTP(email: string, otp: string, type: string): Promise<any> {
        // Find admin user
        const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, email))

        if (!admin) return null

        // Find valid OTP
        const [otpRecord] = await db
            .select()
            .from(otpTokens)
            .where(
                and(
                    eq(otpTokens.adminUserId, admin.id),
                    eq(otpTokens.token, otp),
                    eq(otpTokens.type, type),
                    eq(otpTokens.isUsed, false),
                    gt(otpTokens.expiresAt, new Date()),
                ),
            )

        if (!otpRecord) return null

        // Mark OTP as used
        await db.update(otpTokens).set({ isUsed: true, usedAt: new Date() }).where(eq(otpTokens.id, otpRecord.id))

        // Log successful verification
        await db.insert(adminActivityLogs).values({
            adminId: admin.id,
            action: "otp_verified",
            resource: "auth",
            details: { type, email },
            ipAddress: "127.0.0.1",
        })

        return { admin, otpRecord }
    }

    // Check OTP status (rate limiting, attempts, etc.)
    static async getOTPStatus(email: string, type: string): Promise<any> {
        const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, email))

        if (!admin) return { canResend: false, attemptsRemaining: 0 }

        // Check recent OTP attempts (last 1 hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)

        const recentOTPs = await db
            .select()
            .from(otpTokens)
            .where(and(eq(otpTokens.adminUserId, admin.id), eq(otpTokens.type, type), gt(otpTokens.createdAt, oneHourAgo)))

        const maxAttempts = 5
        const attemptsUsed = recentOTPs.length
        const attemptsRemaining = Math.max(0, maxAttempts - attemptsUsed)
        const canResend = attemptsRemaining > 0

        // Check if there's a recent valid OTP (within last 2 minutes)
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000)
        const recentValidOTP = recentOTPs.find(
            (otp) => !otp.isUsed && otp.expiresAt > new Date() && otp.createdAt > twoMinutesAgo,
        )

        const nextResendIn = recentValidOTP
            ? Math.max(0, Math.floor((twoMinutesAgo.getTime() - recentValidOTP.createdAt.getTime()) / 1000))
            : 0

        return {
            canResend: canResend && nextResendIn === 0,
            nextResendIn,
            attemptsRemaining,
            isBlocked: attemptsRemaining === 0,
            blockExpiresIn: attemptsRemaining === 0 ? 3600 : 0, // 1 hour block
        }
    }

    // Revoke refresh token
    static async revokeRefreshToken(refreshToken: string): Promise<boolean> {
        const hashedToken = crypto.createHash("sha256").update(refreshToken).digest("hex")

        const result = await db.update(schema.adminSessions).set({ isActive: false }).where(eq(schema.adminSessions.token, hashedToken))

        return result.length > 0
    }

    // Revoke all refresh tokens for admin
    static async revokeAllRefreshTokens(adminId: string): Promise<number> {
        const result = await db.update(schema.adminSessions).set({ isActive: false }).where(eq(schema.adminSessions.adminId, adminId))

        return result.length
    }
}
