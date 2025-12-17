import {
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
  jsonb,

  real,
  doublePrecision,
  varchar,
  uuid,
  integer,
  customType,
} from "drizzle-orm/pg-core"
import { platformUsers } from "./platform-user"
import { adminUsers } from "./admin-user"
// Property enums - Updated based on the UI
export const propertyTypeEnum = pgEnum("property_type", [
  "AGRICULTURAL",
  "COMMERCIAL",
  "RESIDENTIAL",
  "INDUSTRIAL",
  "VILLA",
  "APARTMENT",
  "PLOT",
  "FARMHOUSE",
  "WAREHOUSE",
  "OFFICE",
  "FARMLAND",
  "OTHER",
])

export const propertyStatusEnum = pgEnum("property_status", [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "FLAGGED",
])


export const publishedStatusEnum = pgEnum("published_status", [
  "DRAFT",
  "PUBLISHED",
])

export const availablilityStatus = pgEnum("availiblity_status", [
  "AVAILABLE",
  "SOLD",
  "MANAGED",
])



// Area unit enum
export const areaUnitEnum = pgEnum("area_unit", [
  "SQYRD",
  "SQFT",
  "SQM",
  "ACRE",
  "HECTARE",
  "BIGHA",
  "KATHA",
  "MARLA",
  "KANAL",
  "GUNTA",
  "CENT",
])

// Listing as enum
export const listingAsEnum = pgEnum("listing_as", [
  "OWNER",
  "AGENT",
  "COMPANY",
])

export const approvalStatusEnum = pgEnum("approval_status", [
  "PENDING",
  "APPROVED",
  "FLAGGED",
  "REJECTED",
])

export const propertyOriginEnum = pgEnum("property_origin", [
  "PM",
  "2BIGHA",
  "FARMS",
  "DASHBOARD",
  "APP",
]);

export const createdByEnum = pgEnum("created_by_type", [
  "USER", "ADMIN"
])
const geometry = customType<{ data: string }>({
  dataType() {
    return "geometry";
  },
});
// Properties table - Enhanced with all UI fields
export const properties = pgTable("properties", {
  id: uuid("id").defaultRandom().primaryKey(),
  listingId : serial("listing_id"),
  title: text("title"),
  description: text("description"),
  propertyType: propertyTypeEnum("property_type"),

  status: publishedStatusEnum("published_status").default("DRAFT"),
  price: real("price"),
  pricePerUnit: real("price_per_unit"), // Calculated field

  area: real("area"),
  areaUnit: areaUnitEnum("area_unit").default("SQFT"),

  khasraNumber: text("khasra_number"), // Land record number
  murabbaNumber: text("murabba_number"), // Revenue village subdivision
  khewatNumber: text("khewat_number"), // Ownership record number

  // Location Information
  address: text("address"),
  city: text("city"),
  district: text("district"), // Added from UI
  state: text("state"),
  country: text("country").default("India"),
  pinCode: text("pin_code"), // Changed from postalCode to pinCode

  // Geographic Data
  // PostGIS geometry point for lat/lng
  location: jsonb("location"), // PostGIS geometry point
  centerPoint: geometry("center_point"),
  boundary: geometry("geometry", "boundary"),// PostGIS geometry polygon for property boundaries
  calculatedArea: real("calculated_area"), // Area calculated from boundary
  geoJson: jsonb("geo_json"), // Store boundary as GeoJSON
  createdByType: createdByEnum("created_by_type").notNull().default("USER"),


  listingAs: listingAsEnum("listing_as").notNull().default("OWNER"), // Who is listing the property
  ownerName: text("owner_name"), // From UI form
  ownerPhone: text("owner_phone"), // From UI form
  ownerWhatsapp: text("owner_whatsapp"), // From UI form (optional)


  // Status Flags
  isFeatured: boolean("is_featured").notNull().default(false),
  isVerified: boolean("is_verified").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  availablilityStatus: availablilityStatus("availiblity_status").notNull().default("AVAILABLE"),
  // Analytics
  viewCount: integer("view_count").notNull().default(0),
  inquiryCount: integer("inquiry_count").notNull().default(0),

  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  publishedAt: timestamp("published_at"), // When property was made public

  // References to platform users
  createdByAdminId: uuid("created_by_admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
  createdByUserId: uuid("created_by_user_id").references(() => platformUsers.id, { onDelete: "set null" }),
  ownerId:uuid("owner_id").references(() => platformUsers.id, { onDelete: "cascade" }),
  approvalStatus: approvalStatusEnum("approval_status").notNull().default("PENDING"), // Pending, Approved, Flagged
  approvalMessage: text("approval_message"), // Message from admin during approval/rejection
  approvedBy: uuid("approved_by").references(() => adminUsers.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"), // Detailed rejection reason
  rejectedBy: uuid("rejected_by").references(() => adminUsers.id),
  rejectedAt: timestamp("rejected_at"),


  // Admin Notes
  adminNotes: text("admin_notes"), // Private admin notes
  lastReviewedBy: uuid("last_reviewed_by").references(() => adminUsers.id),
  lastReviewedAt: timestamp("last_reviewed_at"),
  waterLevel: integer("water_level"),
  category: text("category"),
  highwayConn: boolean("highway_conn"),
  landZoning: text("land_zoning"),
  ownersCount: integer("owners_count"),
  ownershipYes: boolean("ownership_yes"),
  soilType: text("soil_type"),
  roadAccess: boolean("road_access"),
  roadAccessDistance: integer("road_access_distance"),
  landMark: jsonb("land_mark").$type<string[]>(),
  landMarkName: jsonb("landmark_name").$type<Record<string,string>>(),
  roadAccessWidth: integer("road_access_width"),
  roadAccessDistanceUnit: text("road_access_distance_unit"),
  propertyName : text('property_name'),
   // New columns added
  
  listingType: text("listing_type").default("SALE"),
  isPriceNegotiable: boolean("is_price_negotiable").default(false),
  source: propertyOriginEnum("source").default("2BIGHA"),
  hasGatedCommunity: boolean("has_gated_community").default(false),
  multipleSizeOptions: boolean("multiple_size_options").default(false),
  nearestMajorCity: jsonb("nearest_major_city").$type<{
    city?: string;
    distance?: number;
    unit?: string;
  } | null>(),
  
  nearbyActivities: jsonb("nearby_activities")
    .$type<
      (
        | "Boating"
        | "Walks"
        | "Jet Skiing"
        | "Trekking"
        | "Camping"
        | "Fishing"
      )[]
    >()
    .default([]),

  scenicFeatures: jsonb("scenic_features")
    .$type<
      ("Riverside" | "Hills" | "Mountains" | "Forest" | "Valley" | "Lake")[]
    >()
    .default([]),

  amenities: jsonb("amenities")
    .$type<("Club House" | "Swimming Pool" | "Mud House" | "Solar Power")[]>()
    .default([]),
})

export const propertyVerification = pgTable("property_verification", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  isVerified: boolean("is_verified").notNull().default(false), // Whether property is verified
  verificationMessage: text("verification_message"),
  verificationNotes: text("verification_notes"),
  verifiedBy: uuid("verified_by").references(() => adminUsers.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at").notNull().defaultNow(),
})


export const propertySeo = pgTable("property_seo", {
  id: uuid("id").defaultRandom().primaryKey(),

  propertyId: uuid("property_id")
    .notNull()
    .unique()
    .references(() => properties.id, { onDelete: "cascade" }),

  slug: text("slug").unique(), // URL slug
  seoTitle: text("seo_title"), // SEO title (50–60 chars recommended)
  seoDescription: text("seo_description"), // Meta description (150–160 chars)
  seoKeywords: text("seo_keywords"), // Comma-separated keywords
  schema: jsonb("schema"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Property views table - Enhanced
export const propertyViews = pgTable("property_views", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => platformUsers.id, { onDelete: "set null" }),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  referrer: text("referrer"),
  sessionId: text("session_id"), // Track unique sessions
  viewDuration: uuid("view_duration"), // Time spent viewing (seconds)
  viewedAt: timestamp("viewed_at").notNull().defaultNow(),
})

// Property images table - Separate table for better management
export const propertyImages = pgTable("property_images", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  imageType: text("image_type").default("general"), // main, exterior, interior, floor_plan, etc.
  caption: text("caption"),
  altText: text("alt_text"),
  sortOrder: integer("sort_order").default(0),
  isMain: boolean("is_main").default(false), // Main property image
  variants: jsonb("variants"), // { thumbnail, medium, large, original }
  createdAt: timestamp("created_at").notNull().defaultNow(),
})


// Property price history - Track price changes
export const propertyPriceHistory = pgTable("property_price_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .notNull()
    .references(() => properties.id, { onDelete: "cascade" }),
  oldPrice: real("old_price"),
  newPrice: real("new_price").notNull(),
  changeReason: text("change_reason"), // market_adjustment, negotiation, etc.
  changedBy: uuid("changed_by").references(() => platformUsers.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Property relations
export const propertyRelations = {
  properties: {
    seo: {
      relation: "one",
      table: propertySeo,
      fields: [properties.id],
      references: [propertySeo.propertyId],
    },
    createdByUser: {
      relation: "one",
      table: platformUsers,
      fields: [properties.createdByUserId],
      references: [platformUsers.id],
    },
    verificationLogs: {
      relation: "many",
      table: propertyVerification,
      fields: [properties.id],
      references: [propertyVerification.propertyId],
    },
    createdByAdmin: {
      relation: "one",
      table: adminUsers,
      fields: [properties.createdByAdminId],
      references: [adminUsers.id],
    },
    views: {
      relation: "many",
      table: propertyViews,
      fields: [properties.id],
      references: [propertyViews.propertyId],
    },
    images: {
      relation: "many",
      table: propertyImages,
      fields: [properties.id],
      references: [propertyImages.propertyId],
    },

    priceHistory: {
      relation: "many",
      table: propertyPriceHistory,
      fields: [properties.id],
      references: [propertyPriceHistory.propertyId],
    },
  },
  propertyViews: {
    property: {
      relation: "one",
      table: properties,
      fields: [propertyViews.propertyId],
      references: [properties.id],
    },
    user: {
      relation: "one",
      table: platformUsers,
      fields: [propertyViews.userId],
      references: [platformUsers.id],
    },
  },
  propertyImages: {
    property: {
      relation: "one",
      table: properties,
      fields: [propertyImages.propertyId],
      references: [properties.id],
    },
  },
  propertySeo: {
    property: {
      relation: "one",
      table: properties,
      fields: [propertySeo.propertyId],
      references: [properties.id],
    },
  },
  propertyVerificationLogs: {
    property: {
      relation: "one",
      table: properties,
      fields: [propertyVerification.propertyId],
      references: [properties.id],
    },
    verifiedBy: {
      relation: "one",
      table: adminUsers,
      fields: [propertyVerification.verifiedBy],
      references: [adminUsers.id],
    },
  },


  propertyPriceHistory: {
    property: {
      relation: "one",
      table: properties,
      fields: [propertyPriceHistory.propertyId],
      references: [properties.id],
    },
    changedBy: {
      relation: "one",
      table: platformUsers,
      fields: [propertyPriceHistory.changedBy],
      references: [platformUsers.id],
    },
  },


}
