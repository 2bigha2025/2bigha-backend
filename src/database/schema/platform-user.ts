import { pgEnum, pgTable, serial, text, timestamp, boolean, jsonb, uuid, integer } from "drizzle-orm/pg-core"
import { adminUsers } from "./admin-user"
// Platform user role enum - for regular platform users
export const platformUserRoleEnum = pgEnum("platform_user_roles", ["OWNER", "AGENT", "USER"])

// Platform users table - Regular users of the platform
export const platformUsers = pgTable("platform_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  password: text("password"),
  role: platformUserRoleEnum("role").notNull().default("USER"),
  isActive: boolean("is_active").notNull().default(true),
  isVerified: boolean("is_verified").notNull().default(false),
  emailVerifiedAt: timestamp("email_verified_at"),
  lastLoginAt: timestamp("last_login_at"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedby:uuid("updated_by").references(() => adminUsers.id, { onDelete: "set null", }),
  createdByAdminId:uuid("created_by_admin_id").references(() => adminUsers.id, { onDelete: "set null" })
})

// Platform user profiles table
export const platformUserProfiles = pgTable("platform_user_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => platformUsers.id, { onDelete: "cascade" }),
  bio: text("bio"),
  avatar: text("avatar"),
  phone: text("phone").unique(),
  whatsappNumber: text("whatsapp_number"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  country: text("country"),
  pincode: text("pincode"),
  website: text("website"),
  socialLinks: jsonb("social_links"),
  preferences: jsonb("preferences"),
  location: text("location"), // PostGIS geometry
  // Agent specific profile fields
  specializations: jsonb("specializations"), // Property types they specialize in
  serviceAreas: jsonb("service_areas"), // Areas they serve
  languages: jsonb("languages"), // Languages spoken
  experience: uuid("experience"), // Years of experience
  rating: uuid("rating"), // Average rating (1-5)
  totalReviews: integer("total_reviews").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})
