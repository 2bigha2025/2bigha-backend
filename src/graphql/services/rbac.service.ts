import { eq, and, or, like, sql, inArray, desc, asc } from "drizzle-orm"
import { db } from "../../database/connection"
import * as schema from "../../database/schema/index"
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from "uuid"

const { adminUsers, adminRoles, adminPermissions, adminRolePermissions, adminUserRoles, adminActivityLogs } = schema

export class RBACService {
    // ==================== PERMISSIONS ====================

    // Get all permissions
    static async getAllPermissions() {
        return await db.select().from(adminPermissions).orderBy(adminPermissions.resource, adminPermissions.action)
    }

    // Get permissions grouped by resource
    static async getPermissionsByResource() {
        const permissions = await this.getAllPermissions()

        const grouped = permissions.reduce(
            (acc, permission) => {
                if (!acc[permission.resource]) {
                    acc[permission.resource] = []
                }
                acc[permission.resource].push(permission)
                return acc
            },
            {} as Record<string, typeof permissions>,
        )

        return Object.entries(grouped).map(([resource, permissions]) => ({
            resource,
            permissions,
        }))
    }

    // Get single permission
    static async getPermission(id: string) {
        const [permission] = await db.select().from(adminPermissions).where(eq(adminPermissions.id, id))
        return permission || null
    }

    // ==================== ROLES ====================

    // Get all roles with filters and sorting
    static async getAllRoles(filter?: any, sort?: any, limit = 20, offset = 0) {
        let query = db.select().from(adminRoles)



        // Get total count
        const [{ count: total }] = await db.select({ count: sql<number>`count(*)` }).from(adminRoles)

        // Apply pagination
        const roles = await query.limit(limit).offset(offset)

        // Get permissions for each role
        const rolesWithPermissions = await Promise.all(
            roles.map(async (role) => {
                const permissions = await this.getRolePermissions(role.id)
                const userCount = await this.getRoleUserCount(role.id)

                return {
                    ...role,
                    permissions,
                    userCount,
                }
            }),
        )

        return {
            roles: rolesWithPermissions,
            total,
            hasMore: offset + limit < total,
        }
    }

    // Get single role
    static async getRole(id: string) {
        const [role] = await db.select().from(adminRoles).where(eq(adminRoles.id, id))

        if (!role) return null

        const permissions = await this.getRolePermissions(id)
        const userCount = await this.getRoleUserCount(id)

        return {
            ...role,
            permissions,
            userCount,
        }
    }

    // Get role by slug
    static async getRoleBySlug(slug: string) {
        const [role] = await db.select().from(adminRoles).where(eq(adminRoles.slug, slug))

        if (!role) return null

        const permissions = await this.getRolePermissions(role.id)
        const userCount = await this.getRoleUserCount(role.id)

        return {
            ...role,
            permissions,
            userCount,
        }
    }

    // Get role permissions
    static async getRolePermissions(roleId: string) {
        return await db
            .select({
                id: adminPermissions.id,
                name: adminPermissions.name,
                resource: adminPermissions.resource,
                action: adminPermissions.action,
                description: adminPermissions.description,
                createdAt: adminPermissions.createdAt,
            })
            .from(adminRolePermissions)
            .innerJoin(adminPermissions, eq(adminRolePermissions.permissionId, adminPermissions.id))
            .where(eq(adminRolePermissions.roleId, roleId))
            .orderBy(adminPermissions.resource, adminPermissions.action)
    }

    // Get role user count
    static async getRoleUserCount(roleId: string) {
        const [{ count }] = await db
            .select({ count: sql<number>`count(*)` })
            .from(adminUserRoles)
            .where(eq(adminUserRoles.roleId, roleId))
        return count
    }

    // Create role
    static async createRole(input: any, createdBy: string) {
        const roleId = uuidv4()

        // Create role
        const [role] = await db
            .insert(adminRoles)
            .values({
                id: roleId,
                name: input.name,
                slug: input.slug,
                description: input.description,
                color: input.color,
                isSystemRole: false,
                isActive: true,
            })
            .returning()

        // Assign permissions
        if (input.permissionIds && input.permissionIds.length > 0) {
            const rolePermissions = input.permissionIds.map((permissionId: string) => ({
                id: uuidv4(),
                roleId,
                permissionId,
            }))

            await db.insert(adminRolePermissions).values(rolePermissions)
        }

        // Log activity
        await this.logActivity(createdBy, "create_role", "role", roleId, { roleName: input.name })

        return await this.getRole(roleId)
    }

    // Update role
    static async updateRole(id: string, input: any, updatedBy: string) {
        // Update role
        const [role] = await db
            .update(adminRoles)
            .set({
                ...input,
                updatedAt: new Date(),
            })
            .where(eq(adminRoles.id, id))
            .returning()

        if (!role) throw new Error("Role not found")

        // Update permissions if provided
        if (input.permissionIds !== undefined) {
            // Remove existing permissions
            await db.delete(adminRolePermissions).where(eq(adminRolePermissions.roleId, id))

            // Add new permissions
            if (input.permissionIds.length > 0) {
                const rolePermissions = input.permissionIds.map((permissionId: string) => ({
                    id: uuidv4(),
                    roleId: id,
                    permissionId,
                }))

                await db.insert(adminRolePermissions).values(rolePermissions)
            }
        }

        // Log activity
        await this.logActivity(updatedBy, "update_role", "role", id, { roleName: role.name })

        return await this.getRole(id)
    }

    // Delete role
    static async deleteRole(id: string, deletedBy: string) {
        const role = await this.getRole(id)
        if (!role) throw new Error("Role not found")

        if (role.isSystemRole) {
            throw new Error("Cannot delete system role")
        }

        if (role.userCount > 0) {
            throw new Error("Cannot delete role with assigned users")
        }

        // Delete role permissions
        await db.delete(adminRolePermissions).where(eq(adminRolePermissions.roleId, id))

        // Delete role
        await db.delete(adminRoles).where(eq(adminRoles.id, id))

        // Log activity
        await this.logActivity(deletedBy, "delete_role", "role", id, { roleName: role.name })

        return true
    }

    // ==================== ADMINS ====================

    // Get all admins with RBAC info
    static async getAllAdmins(filter?: any, sort?: any, limit = 25, offset = 0) {
        let query = db.select().from(adminUsers)

        // Apply filters


        // Apply sorting


        // Get total count
        const [{ count: total }] = await db.select({ count: sql<number>`count(*)` }).from(adminUsers)

        // Apply pagination
        const admins = await query.limit(limit).offset(offset)

        // Get RBAC info for each admin
        const adminsWithRBAC = await Promise.all(
            admins.map(async (admin) => {
                const roles = await this.getAdminRoles(admin.id)
                const permissions = await this.getAdminPermissions(admin.id)
                const directPermissions = await this.getAdminDirectPermissions(admin.id)

                return {
                    ...admin,
                    roles,
                    permissions,
                    directPermissions,
                }
            }),
        )

        return {
            admins: adminsWithRBAC,
            total,
            hasMore: offset + limit < total,
        }
    }

    // Get admin with RBAC info
    static async getAdminWithRBAC(id: string) {
        const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, id))

        if (!admin) return null

        const roles = await this.getAdminRoles(id)
        const permissions = await this.getAdminPermissions(id)
        const directPermissions = await this.getAdminDirectPermissions(id)

        return {
            ...admin,
            roles,
            permissions,
            directPermissions,
        }
    }

    // Get admin roles
    static async getAdminRoles(adminId: string) {
        return await db
            .select({
                id: adminRoles.id,
                name: adminRoles.name,
                slug: adminRoles.slug,
                description: adminRoles.description,
                color: adminRoles.color,
                isSystemRole: adminRoles.isSystemRole,
                isActive: adminRoles.isActive,
                createdAt: adminRoles.createdAt,
                updatedAt: adminRoles.updatedAt,
            })
            .from(adminUserRoles)
            .innerJoin(adminRoles, eq(adminUserRoles.roleId, adminRoles.id))
            .where(eq(adminUserRoles.userId, adminId))
            .orderBy(adminRoles.name)
    }

    // Get admin permissions (from roles)
    static async getAdminPermissions(adminId: string) {
        return await db
            .select({
                id: adminPermissions.id,
                name: adminPermissions.name,
                resource: adminPermissions.resource,
                action: adminPermissions.action,
                description: adminPermissions.description,
                createdAt: adminPermissions.createdAt,
            })
            .from(adminUserRoles)
            .innerJoin(adminRolePermissions, eq(adminUserRoles.roleId, adminRolePermissions.roleId))
            .innerJoin(adminPermissions, eq(adminRolePermissions.permissionId, adminPermissions.id))
            .where(eq(adminUserRoles.userId, adminId))
            .orderBy(adminPermissions.resource, adminPermissions.action)
    }

    // Get admin direct permissions (if any)
    static async getAdminDirectPermissions(adminId: string) {
        // For now, return empty array as we're using role-based permissions
        // This can be extended later for direct permission assignments
        return []
    }

    // Create admin
    static async createAdmin(input: any, createdBy: string) {
        const adminId = uuidv4()
        const hashedPassword = await bcrypt.hash(input.password, 12)

        // Create admin
        const [admin] = await db
            .insert(adminUsers)
            .values({
                id: adminId,
                email: input.email,
                firstName: input.firstName,
                lastName: input.lastName,
                password: hashedPassword,
                department: input.department,
                employeeId: input.employeeId,
                phone: input.phone,
                isActive: true,
                isVerified: false,
            })
            .returning()


        // Assign roles


        await db.insert(adminUserRoles).values({
            id: uuidv4(),
            userId: adminId,
            roleId: input.roleId,
            assignedBy: createdBy,
        })


        // Log activity
        await this.logActivity(createdBy, "create_admin", "admin", adminId, {
            email: input.email,
            roles: input.roleIds,
        })

        return await this.getAdminWithRBAC(adminId)
    }

    // Update admin
    static async updateAdmin(id: string, input: any, updatedBy: string) {
        const updateData: any = { ...input, updatedAt: new Date() }

        // Remove roleIds from update data as it's handled separately
        delete updateData.roleIds

        // Update admin
        const [admin] = await db.update(adminUsers).set(updateData).where(eq(adminUsers.id, id)).returning()

        if (!admin) throw new Error("Admin not found")

        // Update roles if provided
        if (input.roleIds !== undefined) {
            // Remove existing roles
            await db.delete(adminUserRoles).where(eq(adminUserRoles.userId, id))

            // Add new roles
            if (input.roleIds.length > 0) {
                const userRoles = input.roleIds.map((roleId: string) => ({
                    id: uuidv4(),
                    userId: id,
                    roleId,
                    assignedBy: updatedBy,
                }))

                await db.insert(adminUserRoles).values(userRoles)
            }
        }

        // Log activity
        await this.logActivity(updatedBy, "update_admin", "admin", id, {
            email: admin.email,
            changes: input,
        })

        return await this.getAdminWithRBAC(id)
    }

    // Disable admin
    static async disableAdmin(id: string, disabledBy: string) {
        const [admin] = await db
            .update(adminUsers)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(adminUsers.id, id))
            .returning()

        if (!admin) throw new Error("Admin not found")

        // Log activity
        await this.logActivity(disabledBy, "disable_admin", "admin", id, { email: admin.email })

        return await this.getAdminWithRBAC(id)
    }

    // Enable admin
    static async enableAdmin(id: string, enabledBy: string) {
        const [admin] = await db
            .update(adminUsers)
            .set({ isActive: true, updatedAt: new Date() })
            .where(eq(adminUsers.id, id))
            .returning()

        if (!admin) throw new Error("Admin not found")

        // Log activity
        await this.logActivity(enabledBy, "enable_admin", "admin", id, { email: admin.email })

        return await this.getAdminWithRBAC(id)
    }

    // ==================== ROLE ASSIGNMENTS ====================

    // Assign roles to admin
    static async assignRolesToAdmin(adminId: string, roleIds: string[], assignedBy: string) {
        // Get existing roles
        const existingRoles = await db
            .select({ roleId: adminUserRoles.roleId })
            .from(adminUserRoles)
            .where(eq(adminUserRoles.userId, adminId))

        const existingRoleIds = existingRoles.map((r) => r.roleId)
        const newRoleIds = roleIds.filter((roleId) => !existingRoleIds.includes(roleId))

        // Add new roles
        if (newRoleIds.length > 0) {
            const userRoles = newRoleIds.map((roleId: string) => ({
                id: uuidv4(),
                userId: adminId,
                roleId,
                assignedBy,
            }))

            await db.insert(adminUserRoles).values(userRoles)
        }

        // Log activity
        await this.logActivity(assignedBy, "assign_roles", "admin", adminId, {
            roleIds: newRoleIds,
        })

        return await this.getAdminWithRBAC(adminId)
    }

    // Revoke roles from admin
    static async revokeRolesFromAdmin(adminId: string, roleIds: string[], revokedBy: string) {
        await db
            .delete(adminUserRoles)
            .where(and(eq(adminUserRoles.userId, adminId), inArray(adminUserRoles.roleId, roleIds)))

        // Log activity
        await this.logActivity(revokedBy, "revoke_roles", "admin", adminId, {
            roleIds,
        })

        return await this.getAdminWithRBAC(adminId)
    }

    // Replace admin roles
    static async replaceAdminRoles(adminId: string, roleIds: string[], replacedBy: string) {
        // Remove all existing roles
        await db.delete(adminUserRoles).where(eq(adminUserRoles.userId, adminId))

        // Add new roles
        if (roleIds.length > 0) {
            const userRoles = roleIds.map((roleId: string) => ({
                id: uuidv4(),
                userId: adminId,
                roleId,
                assignedBy: replacedBy,
            }))

            await db.insert(adminUserRoles).values(userRoles)
        }

        // Log activity
        await this.logActivity(replacedBy, "replace_roles", "admin", adminId, {
            roleIds,
        })

        return await this.getAdminWithRBAC(adminId)
    }

    // ==================== STATS ====================

    // Get RBAC stats
    static async getRBACStats() {
        const [totalAdmins] = await db.select({ count: sql<number>`count(*)` }).from(adminUsers)

        const [activeAdmins] = await db
            .select({ count: sql<number>`count(*)` })
            .from(adminUsers)
            .where(eq(adminUsers.isActive, true))

        const [totalRoles] = await db.select({ count: sql<number>`count(*)` }).from(adminRoles)

        const [totalPermissions] = await db.select({ count: sql<number>`count(*)` }).from(adminPermissions)

        const adminsByRole = await db
            .select({
                roleId: adminRoles.id,
                roleName: adminRoles.name,
                userCount: sql<number>`count(${adminUserRoles.userId})`,
            })
            .from(adminRoles)
            .leftJoin(adminUserRoles, eq(adminRoles.id, adminUserRoles.roleId))
            .groupBy(adminRoles.id, adminRoles.name)
            .orderBy(desc(sql`count(${adminUserRoles.userId})`))

        return {
            totalAdmins: totalAdmins.count,
            activeAdmins: activeAdmins.count,
            totalRoles: totalRoles.count,
            totalPermissions: totalPermissions.count,
            adminsByRole,
        }
    }

    // ==================== UTILITIES ====================

    // Log activity
    static async logActivity(adminId: string, action: string, resource: string, resourceId: string, details: any) {
        await db.insert(adminActivityLogs).values({
            id: uuidv4(),
            adminId,
            action,
            resource,
            resourceId,
            details,
            ipAddress: "127.0.0.1", // This should come from context
            createdAt: new Date(),
        })
    }
}
