import { relations, sql, } from "drizzle-orm";
import { customType, jsonb, pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

// Custom geometry type for PostGIS
const geometry = customType<{ data: unknown }>({
    dataType() {
        return "geometry";
    },
});

// Collections table
export const geojsonCollections = pgTable("geo_json_collectionss", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    data: jsonb("data").notNull(), // Store full FeatureCollection if needed
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Features table
export const geojsonFeatures = pgTable("json_featuress", {
    id: uuid("id").defaultRandom().primaryKey(),
    collectionId: uuid("collection_id").references(() => geojsonCollections.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // Point, LineString, Polygon, etc.
    properties: jsonb("properties").notNull(), // Properties object
    geometry: jsonb("geometry").notNull(),
    geom: geometry("geom"),
    bounds: jsonb("bounds"), // Store bbox as JSON array
    isApproved: boolean("is_approved").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Relations
export const geojsonCollectionsRelations = relations(geojsonCollections, ({ many }) => ({
    features: many(geojsonFeatures),
}));

export const geojsonFeaturesRelations = relations(geojsonFeatures, ({ one }) => ({
    collection: one(geojsonCollections, {
        fields: [geojsonFeatures.collectionId],
        references: [geojsonCollections.id],
    }),
}));
