import { GraphQLError } from "graphql"
import { SavedPropertiesService } from '../services/saved-properties.service'
import { requirePlatformUser } from '../../utils/auth-helpers'

interface Context {
    user?: {
        userId: string
        email: string
        role: string
    }
    admin?: any
}

export const savedPropertiesResolvers = {
    Query: {
        savedProperties: async (
            _: any,
            { filter, limit = 20, offset = 0, sortBy = "savedAt", sortDirection = "DESC" }: any,
            context: Context,
        ) => {
            const user = requirePlatformUser(context)

            return await SavedPropertiesService.getSavedProperties(
                user.userId,
                filter,
                limit,
                offset,
                sortBy,
                sortDirection,
            )
        },

        savedProperty: async (_: any, { id }: { id: string }, context: Context) => {
            const user = requirePlatformUser(context)

            // Get saved property and verify ownership
            const savedProperty = await SavedPropertiesService.getSavedPropertyById(
                id,
                user.userId,
            )

            if (!savedProperty) {
                throw new GraphQLError("Saved property not found", {
                    extensions: { code: "NOT_FOUND" },
                })
            }

            return savedProperty
        },

        isPropertySaved: async (_: any, { propertyId }: { propertyId: string }, context: Context) => {
            const user = requirePlatformUser(context)

            return await SavedPropertiesService.isPropertySaved(user.userId, propertyId)
        },

        savedPropertyCollections: async (
            _: any,
            { includeEmpty = false, limit = 50, offset = 0 }: any,
            context: Context,
        ) => {
            const user = requirePlatformUser(context)

            return await SavedPropertiesService.getUserCollections(user.userId, includeEmpty, limit, offset)
        },

        savedPropertyCollection: async (_: any, { id }: { id: string }, context: Context) => {
            const user = requirePlatformUser(context)

            const collection = await SavedPropertiesService.getCollectionById(
                id,
                user.userId,
            )

            if (!collection) {
                throw new GraphQLError("Collection not found", {
                    extensions: { code: "NOT_FOUND" },
                })
            }

            return collection
        },

        savedPropertyStats: async (_: any, { timeframe = "all" }: { timeframe?: string }, context: Context) => {
            const user = requirePlatformUser(context)

            return await SavedPropertiesService.getSavedPropertyStats(user.userId, timeframe)
        },

        publicSavedCollections: async (_: any, { limit = 20, offset = 0 }: any) => {
            return await SavedPropertiesService.getPublicCollections(limit, offset)
        },
        propertySearchByStateOrCity: async (_, { input }) => {
              const { state, city, page = 1, limit = 5 } = input;
        
              const result = await SavedPropertiesService.searchPropertyByStateOrCity(page, limit, state, city);
        
              return {
                data: result.data,
                meta: result.meta,
              };
            },
    },

    Mutation: {
        saveProperty: async (_: any, { input }: { input: any }, context: Context) => {
            const user = requirePlatformUser(context)
            try {
                const result = await SavedPropertiesService.saveProperty(
                    user.userId,
                    input.propertyId,
                    input.category,
                    input.notes,
                    input.collectionIds?.map((id: string) => id),
                )
                return result
            } catch (error) {
                console.error("Save property error:", error)
                throw new GraphQLError("Failed to save property", {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        },

        unsaveProperty: async (_: any, { input }: { input: any }, context: Context) => {
            const user = requirePlatformUser(context)

            try {
                const result = await SavedPropertiesService.unsaveProperty(
                    user.userId,
                    input.propertyId,
                    input.removeFromAllCollections,
                )

                return result
            } catch (error) {
                console.error("Unsave property error:", error)
                throw new GraphQLError("Failed to unsave property", {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        },

        saveMultipleProperties: async (_: any, { propertyIds, category = "general" }: any, context: Context) => {
            const user = requirePlatformUser(context)

            try {
                const results = await SavedPropertiesService.saveMultipleProperties(
                    user.userId,
                    propertyIds.map((id: string) => id),
                    category,
                )

                return results
            } catch (error) {
                console.error("Save multiple properties error:", error)
                throw new GraphQLError("Failed to save properties", {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        },

        unsaveMultipleProperties: async (_: any, { propertyIds }: { propertyIds: string[] }, context: Context) => {
            const user = requirePlatformUser(context)

            try {
                const results = await SavedPropertiesService.unsaveMultipleProperties(
                    user.userId,
                    propertyIds.map((id) => id),
                )

                return results
            } catch (error) {
                console.error("Unsave multiple properties error:", error)
                throw new GraphQLError("Failed to unsave properties", {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        },

        updateSavedProperty: async (_: any, { id, category, notes }: any, context: Context) => {
            const user = requirePlatformUser(context)

            try {
                const savedProperty = await SavedPropertiesService.updateSavedProperty(
                    id,
                    user.userId,
                    {
                        category,
                        notes,
                    },
                )

                if (!savedProperty) {
                    throw new GraphQLError("Saved property not found", {
                        extensions: { code: "NOT_FOUND" },
                    })
                }

                return savedProperty
            } catch (error) {
                console.error("Update saved property error:", error)
                if (error instanceof GraphQLError) throw error
                throw new GraphQLError("Failed to update saved property", {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        },

        createSavedPropertyCollection: async (_: any, { input }: { input: any }, context: Context) => {
            const user = requirePlatformUser(context)

            try {
                const collection = await SavedPropertiesService.createCollection(user.userId, input)
                return collection
            } catch (error) {
                console.error("Create collection error:", error)
                throw new GraphQLError("Failed to create collection", {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        },

        updateSavedPropertyCollection: async (_: any, { id, input }: { id: string; input: any }, context: Context) => {
            const user = requirePlatformUser(context)

            try {
                const collection = await SavedPropertiesService.updateCollection(
                    id,
                    user.userId,
                    input,
                )

                if (!collection) {
                    throw new GraphQLError("Collection not found", {
                        extensions: { code: "NOT_FOUND" },
                    })
                }

                return collection
            } catch (error) {
                console.error("Update collection error:", error)
                if (error instanceof GraphQLError) throw error
                throw new GraphQLError("Failed to update collection", {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        },

        deleteSavedPropertyCollection: async (_: any, { id }: { id: string }, context: Context) => {
            const user = requirePlatformUser(context)

            try {
                const success = await SavedPropertiesService.deleteCollection(id, user.userId)
                return success
            } catch (error) {
                console.error("Delete collection error:", error)
                throw new GraphQLError("Failed to delete collection", {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        },

        addPropertyToCollection: async (_: any, { collectionId, savedPropertyId }: any, context: Context) => {
            const user = requirePlatformUser(context)

            try {
                await SavedPropertiesService.addPropertyToCollections(savedPropertyId, [
                    collectionId,
                ])
                return true
            } catch (error) {
                console.error("Add property to collection error:", error)
                throw new GraphQLError("Failed to add property to collection", {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        },

        removePropertyFromCollection: async (_: any, { collectionId, savedPropertyId }: any, context: Context) => {
            const user = requirePlatformUser(context)

            try {
                await SavedPropertiesService.removePropertyFromCollection(
                    collectionId,
                    Number.parseInt(savedPropertyId),
                    user.userId,
                )
                return true
            } catch (error) {
                console.error("Remove property from collection error:", error)
                throw new GraphQLError("Failed to remove property from collection", {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        },

        addPropertiesToCollection: async (_: any, { collectionId, savedPropertyIds }: any, context: Context) => {
            const user = requirePlatformUser(context)

            try {
                await SavedPropertiesService.addPropertyToCollections(
                    collectionId,
                    savedPropertyIds.map((id: string) => id),
                )
                return true
            } catch (error) {
                console.error("Add properties to collection error:", error)
                throw new GraphQLError("Failed to add properties to collection", {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        },

        removePropertiesFromCollection: async (_: any, { collectionId, savedPropertyIds }: any, context: Context) => {
            const user = requirePlatformUser(context)

            try {
                for (const savedPropertyId of savedPropertyIds) {
                    await SavedPropertiesService.removePropertyFromCollection(
                        collectionId,
                        savedPropertyId,
                        user.userId,
                    )
                }
                return true
            } catch (error) {
                console.error("Remove properties from collection error:", error)
                throw new GraphQLError("Failed to remove properties from collection", {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        },

        markSavedPropertyViewed: async (_: any, { id }: { id: string }, context: Context) => {
            const user = requirePlatformUser(context)

            try {
                const savedProperty = await SavedPropertiesService.markSavedPropertyViewed(
                    id,
                    user.userId,
                )

                if (!savedProperty) {
                    throw new GraphQLError("Saved property not found", {
                        extensions: { code: "NOT_FOUND" },
                    })
                }

                return savedProperty
            } catch (error) {
                console.error("Mark saved property viewed error:", error)
                if (error instanceof GraphQLError) throw error
                throw new GraphQLError("Failed to mark property as viewed", {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        },
    },

    // Nested resolvers
    SavedProperty: {
        user: async (parent: any, _: any, context: Context) => {
            // Return user from database
            const { platformUsers } = await import("../../database/schema/index")
            const { db } = await import("../../config/database")
            const { eq } = await import("drizzle-orm")

            const [user] = await db.select().from(platformUsers).where(eq(platformUsers.id, parent.userId))
            return user
                ? {
                    ...user,
                    id: user.id.toString(),
                    role: user.role.toUpperCase(),
                    createdAt: user.createdAt.toISOString(),
                    updatedAt: user.updatedAt.toISOString(),
                }
                : null
        },

        property: async (parent: any) => {
            // Return property from database
            const { properties } = await import("../../database/schema/index")
            const { db } = await import("../../config/database")
            const { eq } = await import("drizzle-orm")

            const [property] = await db.select().from(properties).where(eq(properties.id, parent.propertyId))
            return property
                ? {
                    ...property,
                    id: property.id.toString(),
                    propertyType: property.propertyType.toUpperCase(),
                    listingType: property.listingType?.toUpperCase() || "SALE",
                    status: property.status.toUpperCase(),
                    createdAt: property.createdAt.toISOString(),
                    updatedAt: property.updatedAt.toISOString(),
                }
                : null
        },

        collections: async (parent: any) => {
            // Get collections this saved property belongs to
            const { savedPropertyCollections, savedPropertyCollectionItems } = await import("../../database/schema")
            const { db } = await import("../../config/database")
            const { eq } = await import("drizzle-orm")

            const results = await db
                .select()
                .from(savedPropertyCollections)
                .innerJoin(
                    savedPropertyCollectionItems,
                    eq(savedPropertyCollectionItems.collectionId, savedPropertyCollections.id),
                )
                .where(eq(savedPropertyCollectionItems.savedPropertyId, parent.id))

            return results.map((result) => ({
                ...result.saved_property_collections,
                id: result.saved_property_collections.id.toString(),
                userId: result.saved_property_collections.userId.toString(),
                createdAt: result.saved_property_collections.createdAt.toISOString(),
                updatedAt: result.saved_property_collections.updatedAt.toISOString(),
            }))
        },
    },

    SavedPropertyCollection: {
        user: async (parent: any) => {
            const { platformUsers } = await import("../../database/schema/index")
            const { db } = await import("../../config/database")
            const { eq } = await import("drizzle-orm")

            const [user] = await db.select().from(platformUsers).where(eq(platformUsers.id, parent.userId))
            return user
                ? {
                    ...user,
                    id: user.id.toString(),
                    role: user.role.toUpperCase(),
                    createdAt: user.createdAt.toISOString(),
                    updatedAt: user.updatedAt.toISOString(),
                }
                : null
        },

        properties: async (parent: any) => {
            const { savedProperties, savedPropertyCollectionItems } = await import("../../database/schema")
            const { db } = await import("../../config/database")
            const { eq, innerJoin } = await import("drizzle-orm")

            const results = await db
                .select()
                .from(savedProperties)
                .innerJoin(savedPropertyCollectionItems, eq(savedPropertyCollectionItems.savedPropertyId, savedProperties.id))
                .where(eq(savedPropertyCollectionItems.collectionId, parent.id))

            return results.map((result) => ({
                ...result.saved_properties,
                id: result.saved_properties.id.toString(),
                userId: result.saved_properties.userId.toString(),
                propertyId: result.saved_properties.propertyId.toString(),
                savedAt: result.saved_properties.savedAt.toISOString(),
                createdAt: result.saved_properties.createdAt.toISOString(),
                updatedAt: result.saved_properties.updatedAt.toISOString(),
            }))
        },
    },

    // Extend existing Property type
    Property: {
        saved: async (parent: any, _: any, context: Context) => {
            if (!context.user) return false
            return await SavedPropertiesService.isPropertySaved(context.user.userId.toString(), parent.id)
        },

        saveCount: async (parent: any) => {
            const { savedProperties } = await import("../../database/schema")
            const { db } = await import("../../config/database")
            const { eq, and, count } = await import("drizzle-orm")

            const [result] = await db
                .select({ count: count() })
                .from(savedProperties)
                .where(and(eq(savedProperties.propertyId, parent.id), eq(savedProperties.isActive, true)))

            return result.count
        },
    },

    // Extend existing PlatformUser type
    PlatformUser: {
        savedProperties: async (parent: any) => {
            const { savedProperties } = await import("../../database/schema")
            const { db } = await import("../../config/database")
            const { eq, and, desc } = await import("drizzle-orm")

            const results = await db
                .select()
                .from(savedProperties)
                .where(and(eq(savedProperties.userId, parent.id), eq(savedProperties.isActive, true)))
                .orderBy(desc(savedProperties.savedAt))
                .limit(10)

            return results.map((savedProperty) => ({
                ...savedProperty,
                id: savedProperty.id.toString(),
                userId: savedProperty.userId.toString(),
                propertyId: savedProperty.propertyId.toString(),
                savedAt: savedProperty.savedAt.toISOString(),
                createdAt: savedProperty.createdAt.toISOString(),
                updatedAt: savedProperty.updatedAt.toISOString(),
            }))
        },

        savedPropertyCollections: async (parent: any) => {
            const { savedPropertyCollections } = await import("../../database/schema")
            const { db } = await import("../../config/database")
            const { eq, and, asc } = await import("drizzle-orm")

            const results = await db
                .select()
                .from(savedPropertyCollections)
                .where(and(eq(savedPropertyCollections.userId, parent.id), eq(savedPropertyCollections.isActive, true)))
                .orderBy(asc(savedPropertyCollections.sortOrder))

            return results.map((collection) => ({
                ...collection,
                id: collection.id.toString(),
                userId: collection.userId.toString(),
                createdAt: collection.createdAt.toISOString(),
                updatedAt: collection.updatedAt.toISOString(),
            }))
        },

        savedPropertiesCount: async (parent: any) => {
            const { savedProperties } = await import("../../database/schema")
            const { db } = await import("../../config/database")
            const { eq, and, count } = await import("drizzle-orm")

            const [result] = await db
                .select({ count: count() })
                .from(savedProperties)
                .where(and(eq(savedProperties.userId, parent.id), eq(savedProperties.isActive, true)))

            return result.count
        },
    },
}
