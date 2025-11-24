import { pgTable, serial, text, timestamp, boolean, jsonb, uuid, } from "drizzle-orm/pg-core"

// Admin users table - System administrators
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  password: text("password").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isVerified: boolean("is_verified").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at"),
  lastLoginAt: timestamp("last_login_at"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  // Admin specific fields
  department: text("department"), // IT, Operations, Marketing, etc.
  employeeId: text("employee_id"),
  phone: text("phone").unique(),
  avatar: text("avatar"),
  bio: text("bio"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// RBAC: Roles table
export const adminRoles = pgTable("admin_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(), // Super Admin, Property Manager, Content Manager, etc.
  slug: text("slug").notNull().unique(), // super_admin, property_manager, etc.
  description: text("description"),
  color: text("color"), // For UI display
  isSystemRole: boolean("is_system_role").notNull().default(false), // Cannot be deleted
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// RBAC: Permissions table
export const adminPermissions = pgTable("admin_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  resource: text("resource").notNull(), // properties, users, analytics, blog, seo, system
  action: text("action").notNull(), // view, create, edit, delete, approve, reject, etc.
  name: text("name").notNull().unique(), // properties:view, properties:create, etc.
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// RBAC: Role-Permission junction table
export const adminRolePermissions = pgTable("admin_role_permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  roleId: uuid("role_id")
    .notNull()
    .references(() => adminRoles.id, { onDelete: "cascade" }),
  permissionId: uuid("permission_id")
    .notNull()
    .references(() => adminPermissions.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// RBAC: User-Role junction table
export const adminUserRoles = pgTable("admin_user_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  roleId: uuid("role_id")
    .notNull()
    .references(() => adminRoles.id, { onDelete: "cascade" }),
  assignedBy: uuid("assigned_by").references(() => adminUsers.id),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"), // Optional role expiration
})

// Admin activity logs
export const adminActivityLogs = pgTable("admin_activity_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // login, logout, create_property, etc.
  resource: text("resource"), // property, user, role, etc.
  resourceId: uuid("resource_id"), // ID of affected resource
  details: jsonb("details"), // Additional action details
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Admin sessions table
export const adminSessions = pgTable("admin_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminId: uuid("admin_id")
    .notNull()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  refreshToken: text("refresh_token"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at").notNull(),
  lastUsedAt: timestamp("last_used_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Admin relations
export const adminUserRelations = {
  adminUsers: {
    roles: {
      relation: "many",
      table: adminUserRoles,
      fields: [adminUsers.id],
      references: [adminUserRoles.userId],
    },
    activityLogs: {
      relation: "many",
      table: adminActivityLogs,
      fields: [adminUsers.id],
      references: [adminActivityLogs.adminId],
    },
    sessions: {
      relation: "many",
      table: adminSessions,
      fields: [adminUsers.id],
      references: [adminSessions.adminId],
    },
  },
  adminRoles: {
    permissions: {
      relation: "many",
      table: adminRolePermissions,
      fields: [adminRoles.id],
      references: [adminRolePermissions.roleId],
    },
    users: {
      relation: "many",
      table: adminUserRoles,
      fields: [adminRoles.id],
      references: [adminUserRoles.roleId],
    },
  },
  adminPermissions: {
    roles: {
      relation: "many",
      table: adminRolePermissions,
      fields: [adminPermissions.id],
      references: [adminRolePermissions.permissionId],
    },
  },
  adminUserRoles: {
    user: {
      relation: "one",
      table: adminUsers,
      fields: [adminUserRoles.userId],
      references: [adminUsers.id],
    },
    role: {
      relation: "one",
      table: adminRoles,
      fields: [adminUserRoles.roleId],
      references: [adminRoles.id],
    },
  },
  adminRolePermissions: {
    role: {
      relation: "one",
      table: adminRoles,
      fields: [adminRolePermissions.roleId],
      references: [adminRoles.id],
    },
    permission: {
      relation: "one",
      table: adminPermissions,
      fields: [adminRolePermissions.permissionId],
      references: [adminPermissions.id],
    },
  },
}
