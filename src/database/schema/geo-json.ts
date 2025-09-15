


import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"


// GeoJSON collections table
export const geojsonCollections = pgTable("geojson_collections", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    data: text("data").notNull(), // JSON string of GeoJSON
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Individual features table for better querying
export const geojsonFeatures = pgTable("geojson_features", {
    id: uuid("id").defaultRandom().primaryKey(),
    collectionId: uuid("collection_id").references(() => geojsonCollections.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // Point, LineString, Polygon, etc.
    properties: text("properties").notNull(), // JSON string of properties
    geometry: text("geometry").notNull(), // JSON string of geometry
    bounds: text("bounds"), // JSON string of bounding box [minLng, minLat, maxLng, maxLat]
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Zod schemas for validation

