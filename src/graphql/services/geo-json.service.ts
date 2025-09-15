
import { eq, desc, like } from "drizzle-orm"
import type { FeatureCollection, BBox } from "geojson"
import { db } from "../../database/connection"
import { geojsonCollections, geojsonFeatures } from '../../database/schema/geo-json'
// Collection operations
export async function createCollection(data: Omit<NewGeojsonCollection, "id" | "createdAt" | "updatedAt">) {
    const [collection] = await db
        .insert(geojsonCollections)
        .values({
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        .returning()
    return collection
}

export async function getCollections() {
    return await db.select().from(geojsonCollections).orderBy(desc(geojsonCollections.createdAt))
}

export async function getCollectionById(id: number) {
    const [collection] = await db.select().from(geojsonCollections).where(eq(geojsonCollections.id, id))
    return collection
}

export async function updateCollection(id: number, data: Partial<Omit<NewGeojsonCollection, "id" | "createdAt">>) {
    const [collection] = await db
        .update(geojsonCollections)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(geojsonCollections.id, id))
        .returning()
    return collection
}

export async function deleteCollection(id: number) {
    await db.delete(geojsonCollections).where(eq(geojsonCollections.id, id))
}

export async function searchCollections(query: string) {
    return await db
        .select()
        .from(geojsonCollections)
        .where(like(geojsonCollections.name, `%${query}%`))
        .orderBy(desc(geojsonCollections.createdAt))
}

// Feature operations
export async function createFeature(data: Omit<NewGeojsonFeature, "id" | "createdAt">) {
    const [feature] = await db
        .insert(geojsonFeatures)
        .values({
            ...data,
            createdAt: new Date(),
        })
        .returning()
    return feature
}

export async function getFeaturesByCollection(collectionId: number) {
    return await db
        .select()
        .from(geojsonFeatures)
        .where(eq(geojsonFeatures.collectionId, collectionId))
        .orderBy(desc(geojsonFeatures.createdAt))
}

export async function updateFeature(id: number, data: Partial<Omit<NewGeojsonFeature, "id" | "createdAt">>) {
    const [feature] = await db.update(geojsonFeatures).set(data).where(eq(geojsonFeatures.id, id)).returning()
    return feature
}

export async function deleteFeature(id: number) {
    await db.delete(geojsonFeatures).where(eq(geojsonFeatures.id, id))
}

// Utility functions for GeoJSON processing
export function calculateBounds(geometry: any): BBox | null {
    if (!geometry || !geometry.coordinates) return null

    let minLng = Number.POSITIVE_INFINITY,
        minLat = Number.POSITIVE_INFINITY,
        maxLng = Number.NEGATIVE_INFINITY,
        maxLat = Number.NEGATIVE_INFINITY

    const processCoordinates = (coords: any) => {
        if (Array.isArray(coords[0])) {
            coords.forEach(processCoordinates)
        } else {
            const [lng, lat] = coords
            minLng = Math.min(minLng, lng)
            maxLng = Math.max(maxLng, lng)
            minLat = Math.min(minLat, lat)
            maxLat = Math.max(maxLat, lat)
        }
    }

    processCoordinates(geometry.coordinates)

    return [minLng, minLat, maxLng, maxLat]
}

export async function saveGeoJSONCollection(name: string, description: string, geojson: FeatureCollection) {
    // Create the collection
    const collection = await createCollection({
        name,
        description,
        data: JSON.stringify(geojson),
    })

    // Save individual features for better querying
    if (geojson.features && collection) {
        for (const feature of geojson.features) {
            const bounds = calculateBounds(feature.geometry)
            await createFeature({
                collectionId: collection.id,
                type: feature.geometry.type,
                properties: JSON.stringify(feature.properties || {}),
                geometry: JSON.stringify(feature.geometry),
                bounds: bounds ? JSON.stringify(bounds) : null,
            })
        }
    }

    return collection
}

export async function getGeoJSONCollection(id: number): Promise<FeatureCollection | null> {
    const collection = await getCollectionById(id)
    if (!collection) return null

    try {
        return JSON.parse(collection.data) as FeatureCollection
    } catch {
        return null
    }
}
