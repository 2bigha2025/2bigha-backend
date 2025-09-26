
import { eq, sql } from "drizzle-orm";
import { db } from "../../database/connection"
import { geojsonCollections, geojsonFeatures } from '../../database/schema/geo-json'
import { v4 as uuidv4 } from "uuid";
import { geometry } from "drizzle-orm/pg-core";

export const GeoJsonService = {
    // Collections
    async getCollection(id: string) {
        try {
            return db.query.geojsonCollections.findFirst({
                where: eq(geojsonCollections.id, id),
                with: { features: true },
            });
        } catch (error) {
            throw new Error(`Failed to get collection: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    async listCollections() {
        try {
            return db.query.geojsonCollections.findMany({
                with: { features: true },
            });
        } catch (error) {
            throw new Error(`Failed to list collections: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    async createCollection(input: { name: string; description?: string; data: string }) {
        try {
            const [collection] = await db
                .insert(geojsonCollections)
                .values({
                    name: input.name,
                    description: input.description, data: []
                })
                .returning();
            return collection;
        } catch (error) {
            console.log(error)
            throw new Error(`Failed to create collection: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    async updateCollection(id: string, input: { name: string; description?: string; data: string }) {
        try {
            const [updated] = await db
                .update(geojsonCollections)
                .set({ ...input, updatedAt: new Date() })
                .where(eq(geojsonCollections.id, id))
                .returning();
            return updated;
        } catch (error) {
            throw new Error(`Failed to update collection: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    async deleteCollection(id: string) {
        try {
            await db.delete(geojsonCollections).where(eq(geojsonCollections.id, id));
            return true;
        } catch (error) {
            throw new Error(`Failed to delete collection: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    // Features
    async getFeature(id: string) {
        try {
            return db.query.geojsonFeatures.findFirst({
                where: eq(geojsonFeatures.id, id),
                with: { collection: true },
            });
        } catch (error) {
            throw new Error(`Failed to get feature: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    async listFeatures(collectionId: string) {
        try {
            return db.query.geojsonFeatures.findMany({
                where: eq(geojsonFeatures.collectionId, collectionId),
            });
        } catch (error) {
            throw new Error(`Failed to list features: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    async createFeature(input: {
        collectionId: string;
        type: string;
        properties: string;
        geometry: string;
        bounds?: string;
    }) {
        try {
            const featureData = {
                id: uuidv4(),
                collectionId: input.collectionId,
                type: input.type,
                properties: JSON.parse(input.properties),
                geometry: JSON.parse(input.geometry),
                bounds: input.bounds ? JSON.parse(input.bounds) : null,
            };

            const [feature] = await db
                .insert(geojsonFeatures)
                .values(featureData)
                .returning();
            return feature;
        } catch (error) {
            console.log(error)
            throw new Error(`Failed to create feature: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    async updateFeature(
        id: string,
        input: { type: string; properties: string; geometry: string; bounds?: string }
    ) {
        try {
            const updateData = {
                type: input.type,
                properties: JSON.parse(input.properties),
                geojson: JSON.parse(input.geometry),
                bounds: input.bounds ? JSON.parse(input.bounds) : null,
                updatedAt: new Date()
            };

            const [updated] = await db
                .update(geojsonFeatures)
                .set(updateData)
                .where(eq(geojsonFeatures.id, id))
                .returning();
            return updated;
        } catch (error) {
            throw new Error(`Failed to update feature: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    async deleteFeature(id: string) {
        try {
            await db.delete(geojsonFeatures).where(eq(geojsonFeatures.id, id));
            return true;
        } catch (error) {
            throw new Error(`Failed to delete feature: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    // Bulk operations
    async bulkCreateFeatures(features: Array<{
        collectionId: string;
        type: string;
        properties: string;
        geometry: string;
        bounds?: string;
    }>) {
        try {
            const featuresWithIds = features.map(feature => {
                // Parse geometry if it's a string, otherwise use as-is
                const geometryObj = typeof feature.geometry === 'string' ?
                    JSON.parse(feature.geometry) : feature.geometry;

                return {
                    id: uuidv4(),
                    collectionId: feature.collectionId,
                    type: feature.type,
                    properties: typeof feature.properties === 'string' ?
                        JSON.parse(feature.properties) : feature.properties,
                    geometry: geometryObj,
                    geom: sql`ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometryObj)}), 4326)`,
                    bounds: feature.bounds ? JSON.parse(feature.bounds) : null,
                };
            });

            const createdFeatures = await db
                .insert(geojsonFeatures)
                .values(featuresWithIds)
                .returning();

            return createdFeatures;
        } catch (error) {
            console.log(error)
            throw new Error(`Failed to bulk create features: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    // Spatial operations
    async findFeaturesWithinRadius(lat: number, lng: number, radiusKm: number = 100) {
        try {
            const radiusMeters = radiusKm * 1000;    // Convert km to meters
            // Raw SQL query using PostGIS ST_DWithin function
            // Ensure that the geom column is indexed with a spatial index for performance
            // Example: CREATE INDEX idx_geojson_features_geom ON geo_json_features USING GIST(geom);
            const results = await db.select()
                .from(geojsonFeatures)
                .where(sql`
                    ST_DWithin(
                        ${geojsonFeatures.geom}::geography,
                        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
                        ${radiusMeters}
                    )
                `);
            console.log(results)
            console.log(results.length);
            return results;
        } catch (error) {
            console.log(error);
            throw new Error(`Failed to find features within radius: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },

    // Import GeoJSON data
    async importGeoJsonData(collectionId: string, geoJsonData: any) {
        try {
            // Parse GeoJSON if it's a string
            const parsedData = typeof geoJsonData === 'string' ? JSON.parse(geoJsonData) : geoJsonData;

            // Validate that it's valid GeoJSON
            if (!parsedData.type || !parsedData.features) {
                throw new Error('Invalid GeoJSON format');
            }

            // Convert GeoJSON features to our feature format
            const features = parsedData.features.map((feature: any) => ({
                collectionId,
                type: feature.geometry.type,
                properties: JSON.stringify(feature.properties || {}),
                geometry: JSON.stringify(feature.geometry),
                bounds: feature.bbox ? JSON.stringify(feature.bbox) : undefined
            }));

            // Bulk create features
            return await this.bulkCreateFeatures(features);
        } catch (error) {
            throw new Error(`Failed to import GeoJSON data: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    },
};
