import { eq, and, desc, asc, sql, like, gte, lte, count } from "drizzle-orm"
import { db } from "../../database/connection"
import * as schema from "../../database/schema/index"

const {
    savedProperties,
    savedPropertyCollections,
    savedPropertyCollectionItems,
    properties,
    platformUsers,
    propertyImages,
} = schema

export class SavedPropertiesService {
    // Save a property for a user
    static async saveProperty(
        userId: string,
        propertyId: string,
        category = "general",
        notes?: string,
        collectionIds?: string[],
    ) {
        try {
            // Check if property exists
            const [property] = await db.select().from(properties).where(eq(properties.id, propertyId))
            if (!property) {
                throw new Error("Property not found")
            }

            // Check if already saved
            const [existingSave] = await db
                .select()
                .from(savedProperties)
                .where(and(eq(savedProperties.userId, userId), eq(savedProperties.propertyId, propertyId)))

            let savedProperty
            let isNewSave = false

            if (existingSave) {
                // Update existing save
                ;[savedProperty] = await db
                    .update(savedProperties)
                    .set({
                        category,
                        notes,
                        isActive: true,
                        updatedAt: new Date(),
                    })
                    .where(eq(savedProperties.id, existingSave.id))
                    .returning()
            } else {
                // Create new save
                ;[savedProperty] = await db
                    .insert(savedProperties)
                    .values({
                        userId,
                        propertyId,
                        category,
                        notes,
                    })
                    .returning()
                isNewSave = true
            }


            // Add to collections if specified
            if (collectionIds && collectionIds.length > 0) {
                await this.addPropertyToCollections(savedProperty.id, collectionIds)
            }

            // Update property save count
            await this.updatePropertySaveCount(propertyId)

            return {
                success: true,
                message: isNewSave ? "Property saved successfully" : "Property save updated",
                savedProperty,
                isNewSave,
            }
        } catch (error) {
            console.error("Save property error:", error)
            return {
                success: false,
                message: `Failed to save property: ${error?.message}`,
                savedProperty: null,
                isNewSave: false,
            }
        }
    }

    // Unsave a property
    static async unsaveProperty(userId: string, propertyId: string, removeFromAllCollections = true) {
        try {
            const [existingSave] = await db
                .select()
                .from(savedProperties)
                .where(and(eq(savedProperties.userId, userId), eq(savedProperties.propertyId, propertyId)))

            if (!existingSave) {
                return {
                    success: true,
                    message: "Property was not saved",
                    wasSaved: false,
                }
            }

            // Remove from collections if requested
            if (removeFromAllCollections) {
                await db
                    .delete(savedPropertyCollectionItems)
                    .where(eq(savedPropertyCollectionItems.savedPropertyId, existingSave.id))
            }

            // Delete the saved property
            await db.delete(savedProperties).where(eq(savedProperties.id, existingSave.id))

            // Update property save count
            await this.updatePropertySaveCount(propertyId)

            return {
                success: true,
                message: "Property unsaved successfully",
                wasSaved: true,
            }
        } catch (error) {
            console.error("Unsave property error:", error)
            return {
                success: false,
                message: `Failed to unsave property: ${error.message}`,
                wasSaved: false,
            }
        }
    }

    // Get user's saved properties with filters
    static async getSavedProperties(
        userId: string,
        filters: any = {},
        limit = 20,
        offset = 0,
        sortBy = "savedAt",
        sortDirection = "DESC",
    ) {
        try {
            let query = db
                .select({
                    savedProperty: savedProperties,
                    property: properties,
                    propertyImage: propertyImages,
                    seo: schema.propertySeo
                })
                .from(savedProperties)
                .innerJoin(properties, eq(savedProperties.propertyId, properties.id))
                .innerJoin(schema.propertySeo, eq(properties.id, schema.propertySeo.propertyId))
                .leftJoin(propertyImages, and(eq(propertyImages.propertyId, properties.id), eq(propertyImages.isMain, true)))
                .where(and(eq(savedProperties.userId, userId), eq(savedProperties.isActive, true)))

            // Apply filters
            const conditions = [eq(savedProperties.userId, userId), eq(savedProperties.isActive, true)]

            if (filters.category) {
                conditions.push(eq(savedProperties.category, filters.category))
            }

            if (filters.propertyType) {
                conditions.push(eq(properties.propertyType, filters.propertyType))
            }

            if (filters.listingType) {
                conditions.push(eq(properties.listingType, filters.listingType))
            }

            if (filters.minPrice) {
                conditions.push(gte(properties.price, filters.minPrice))
            }

            if (filters.maxPrice) {
                conditions.push(lte(properties.price, filters.maxPrice))
            }

            if (filters.city) {
                conditions.push(like(properties.city, `%${filters.city}%`))
            }

            if (filters.state) {
                conditions.push(like(properties.state, `%${filters.state}%`))
            }

            if (filters.savedAfter) {
                conditions.push(gte(savedProperties.savedAt, new Date(filters.savedAfter)))
            }

            if (filters.savedBefore) {
                conditions.push(lte(savedProperties.savedAt, new Date(filters.savedBefore)))
            }

            if (filters.collectionId) {
                // Join with collection items to filter by collection
                query = query
                    .innerJoin(savedPropertyCollectionItems, eq(savedPropertyCollectionItems.savedPropertyId, savedProperties.id))
                    .where(and(...conditions, eq(savedPropertyCollectionItems.collectionId, filters.collectionId)))
            } else {
                query = query.where(and(...conditions))
            }

            // Apply sorting
            const sortColumn =
                sortBy === "savedAt"
                    ? savedProperties.savedAt
                    : sortBy === "price"
                        ? properties.price
                        : sortBy === "createdAt"
                            ? properties.createdAt
                            : savedProperties.savedAt

            const sortFn = sortDirection === "DESC" ? desc : asc
            query = query.orderBy(sortFn(sortColumn))

            // Get total count
            const [{ totalCount }] = await db
                .select({ totalCount: count() })
                .from(savedProperties)
                .where(and(...conditions))

            // Get paginated results
            const results = await query.limit(limit).offset(offset)

            // Get user's collections
            const collections = await this.getUserCollections(userId)
            return {
                properties: results.map((result) => ({
                    ...result.savedProperty,
                    property: {
                        ...result.property,
                        mainImage: result.propertyImage,
                    },
                    seo : {
                        ...result.seo,
                    }
                })),
                totalCount,
                hasMore: offset + limit < totalCount,
                collections,
            }
        } catch (error) {
            console.error("Get saved properties error:", error)
            throw new Error(`Failed to get saved properties: ${error.message}`)
        }
    }

    // Check if property is saved by user
    static async isPropertySaved(userId: string, propertyId: string) {
        const [result] = await db
            .select({ count: count() })
            .from(savedProperties)
            .where(
                and(
                    eq(savedProperties.userId, userId),
                    eq(savedProperties.propertyId, propertyId),
                    eq(savedProperties.isActive, true),
                ),
            )

        return result.count > 0
    }

    // Get user's collections
    static async getUserCollections(userId: string, includeEmpty = false, limit = 50, offset = 0) {
        let query = db
            .select({
                collection: savedPropertyCollections,
                propertyCount: count(savedPropertyCollectionItems.id),
            })
            .from(savedPropertyCollections)
            .leftJoin(
                savedPropertyCollectionItems,
                eq(savedPropertyCollectionItems.collectionId, savedPropertyCollections.id),
            )
            .where(and(eq(savedPropertyCollections.userId, userId), eq(savedPropertyCollections.isActive, true)))
            .groupBy(savedPropertyCollections.id)
            .orderBy(asc(savedPropertyCollections.sortOrder), desc(savedPropertyCollections.createdAt))

        if (!includeEmpty) {
            query = query.having(sql`count(${savedPropertyCollectionItems.id}) > 0`)
        }

        const results = await query.limit(limit).offset(offset)

        return results.map((result) => ({
            ...result.collection,
            propertyCount: result.propertyCount,
        }))
    }

    // Create a new collection
    static async createCollection(userId: string, input: any) {
        const [collection] = await db
            .insert(savedPropertyCollections)
            .values({
                userId,
                name: input.name,
                description: input.description,
                color: input.color || "#3B82F6",
                icon: input.icon || "bookmark",
                isDefault: input.isDefault || false,
                isPublic: input.isPublic || false,
            })
            .returning()

        return collection
    }

    // Update collection
    static async updateCollection(collectionId: string, userId: string, input: any) {
        const [collection] = await db
            .update(savedPropertyCollections)
            .set({
                ...input,
                updatedAt: new Date(),
            })
            .where(and(eq(savedPropertyCollections.id, collectionId), eq(savedPropertyCollections.userId, userId)))
            .returning()

        return collection
    }

    // Delete collection
    static async deleteCollection(collectionId: string, userId: string) {
        // First remove all items from collection
        await db.delete(savedPropertyCollectionItems).where(eq(savedPropertyCollectionItems.collectionId, collectionId))

        // Then delete the collection
        await db
            .delete(savedPropertyCollections)
            .where(and(eq(savedPropertyCollections.id, collectionId), eq(savedPropertyCollections.userId, userId)))

        return true
    }

    // Add property to collections
    static async addPropertyToCollections(savedPropertyId: string, collectionIds: string[]) {
        if (collectionIds.length === 0) return

        const items = collectionIds.map((collectionId) => ({
            collectionId,
            savedPropertyId,
        }))

        await db.insert(savedPropertyCollectionItems).values(items).onConflictDoNothing()
    }

    // Get saved property statistics
    static async getSavedPropertyStats(userId: string, timeframe = "all") {
        try {
            // Get total saved count
            const [{ totalSaved }] = await db
                .select({ totalSaved: count() })
                .from(savedProperties)
                .where(and(eq(savedProperties.userId, userId), eq(savedProperties.isActive, true)))

            // Get total collections count
            const [{ totalCollections }] = await db
                .select({ totalCollections: count() })
                .from(savedPropertyCollections)
                .where(and(eq(savedPropertyCollections.userId, userId), eq(savedPropertyCollections.isActive, true)))

            // Get category counts
            const categoryCounts = await db
                .select({
                    category: savedProperties.category,
                    count: count(),
                })
                .from(savedProperties)
                .where(and(eq(savedProperties.userId, userId), eq(savedProperties.isActive, true)))
                .groupBy(savedProperties.category)
                .orderBy(desc(count()))

            // Get recent saves (last 10)
            const recentSaves = await db
                .select()
                .from(savedProperties)
                .where(and(eq(savedProperties.userId, userId), eq(savedProperties.isActive, true)))
                .orderBy(desc(savedProperties.savedAt))
                .limit(10)

            return {
                totalSaved,
                totalCollections,
                categoryCounts: categoryCounts.map((c) => ({
                    category: c.category || "general",
                    count: c.count,
                })),
                recentSaves,
                topCategories: categoryCounts.slice(0, 5).map((c) => c.category || "general"),
                savingTrend: [], // TODO: Implement trend calculation
            }
        } catch (error) {
            console.error("Get saved property stats error:", error)
            throw new Error(`Failed to get statistics: ${error.message}`)
        }
    }

    // Update property save count (for analytics)
    static async updatePropertySaveCount(propertyId: string) {
        const [{ saveCount }] = await db
            .select({ saveCount: count() })
            .from(savedProperties)
            .where(and(eq(savedProperties.propertyId, propertyId), eq(savedProperties.isActive, true)))

        // Update the property record with save count
        await db
            .update(properties)
            .set({
                // Assuming we add a saveCount field to properties table
                updatedAt: new Date(),
            })
            .where(eq(properties.id, propertyId))

        return saveCount
    }

    // Bulk save properties
    static async saveMultipleProperties(userId: string, propertyIds: string[], category = "general") {
        const results = []

        for (const propertyId of propertyIds) {
            const result = await this.saveProperty(userId, propertyId, category)
            results.push(result)
        }

        return results
    }

    // Bulk unsave properties
    static async unsaveMultipleProperties(userId: string, propertyIds: string[]) {
        const results = []

        for (const propertyId of propertyIds) {
            const result = await this.unsaveProperty(userId, propertyId)
            results.push(result)
        }

        return results
    }

    // Mark saved property as viewed
    static async markSavedPropertyViewed(savedPropertyId: string, userId: string) {
        const [savedProperty] = await db
            .update(savedProperties)
            .set({
                lastViewedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(and(eq(savedProperties.id, savedPropertyId), eq(savedProperties.userId, userId)))
            .returning()

        return savedProperty
    }

    // Get public collections for discovery
    static async getPublicCollections(limit = 20, offset = 0) {
        const results = await db
            .select({
                collection: savedPropertyCollections,
                user: platformUsers,
                propertyCount: count(savedPropertyCollectionItems.id),
            })
            .from(savedPropertyCollections)
            .innerJoin(platformUsers, eq(savedPropertyCollections.userId, platformUsers.id))
            .leftJoin(
                savedPropertyCollectionItems,
                eq(savedPropertyCollectionItems.collectionId, savedPropertyCollections.id),
            )
            .where(and(eq(savedPropertyCollections.isPublic, true), eq(savedPropertyCollections.isActive, true)))
            .groupBy(savedPropertyCollections.id, platformUsers.id)
            .orderBy(desc(count(savedPropertyCollectionItems.id)))
            .limit(limit)
            .offset(offset)

        return results.map((result) => ({
            ...result.collection,
            user: result.user,
            propertyCount: result.propertyCount,
        }))
    }
}
