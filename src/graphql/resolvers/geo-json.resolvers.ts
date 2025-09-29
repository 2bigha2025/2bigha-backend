import { GeoJsonService } from "../services/geo-json.service";

export const geoJsonResolvers = {
    Query: {
        getGeoJsonCollection: (_: any, { id }: { id: string }) =>
            GeoJsonService.getCollection(id),

        listGeoJsonCollections: () => GeoJsonService.listCollections(),

        listGeoJsonCollectionsWithFeatureCount: (
            _: any,
            {
                input: {
                    page = 1,
                    limit = 10,
                    search,
                    sortBy = 'name',
                    sortOrder = 'asc'
                } = {}
            }: {
                input?: {
                    page?: number;
                    limit?: number;
                    search?: string;
                    sortBy?: 'name' | 'createdAt';
                    sortOrder?: 'asc' | 'desc';
                }
            }
        ) => GeoJsonService.listCollectionsWithFeatureCount({
            page,
            limit,
            search,
            sortBy,
            sortOrder
        }),

        getGeoJsonFeature: (_: any, { id }: { id: string }) =>
            GeoJsonService.getFeature(id),

        getFeaturesByCollectionId: (_: any, { collectionId }: { collectionId: string }) =>
            GeoJsonService.listFeatures(collectionId),

        listGeoJsonFeatures: (
            _: any,
            {
                input: {
                    page = 1,
                    limit = 10,
                    search,
                    sortBy = 'createdAt',
                    sortOrder = 'desc'
                } = {}
            }: {
                input?: {
                    page?: number;
                    limit?: number;
                    search?: string;
                    sortBy?: 'createdAt' | 'type' | 'updatedAt';
                    sortOrder?: 'asc' | 'desc';
                }
            }
        ) => GeoJsonService.listFeaturesWithPagination({ page, limit, search, sortBy, sortOrder }),

        findGeoJsonFeaturesWithinRadius: (
            _: any,
            { lat, lng, radiusKm }: { lat: number; lng: number; radiusKm: number }
        ) => GeoJsonService.findFeaturesWithinRadius(lat, lng, radiusKm),
    },

    Mutation: {
        // Create collection from file upload and process features
        uploadGeoJsonFile: async (
            _: any,
            {
                collectionName,
                description,
                file,
            }: { file: any; collectionName: string; description?: string }
        ) => {
            try {
                console.log(collectionName, description, file);

                // console.log(geoJsonData)
                // // Create new collection
                const collection = await GeoJsonService.createCollection({
                    name: collectionName,
                    description: description,
                    data: file,
                });
                console.log(collection);

                const features = await GeoJsonService.importGeoJsonData(
                    collection.id,
                    file
                );

                return {
                    success: true,
                    collection,
                    featuresCount: features.length,
                };
            } catch (error) {
                console.log(error);
                return {
                    success: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : "Failed to process GeoJSON file",
                };
            }
        },

        createGeoJsonCollection: (_: any, { input }: any) =>
            GeoJsonService.createCollection(input),

        updateGeoJsonCollection: (_: any, { id, input }: any) =>
            GeoJsonService.updateCollection(id, input),

        deleteGeoJsonCollection: async (_: any, { id }: { id: string }) => {
            try {
                // Get the collection and its features before deletion
                const collection = await GeoJsonService.getCollection(id);
                if (!collection) {
                    throw new Error('Collection not found');
                }

                const features = await GeoJsonService.listFeatures(id);

                // Delete the collection (this will cascade delete all features)
                await GeoJsonService.deleteCollection(id);

                return {
                    success: true,
                    message: `Successfully deleted collection '${collection.name}' and ${features.length} features`,
                    deletedFeatures: features.length
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to delete collection'
                };
            }
        },

        createGeoJsonFeature: (_: any, { input }: any) =>
            GeoJsonService.createFeature(input),

        updateGeoJsonFeature: (_: any, { id, input }: any) =>
            GeoJsonService.updateFeature(id, input),

        deleteGeoJsonFeature: (_: any, { id }: { id: string }) =>
            GeoJsonService.deleteFeature(id),

        updateAllCollectionFeatures: async (
            _: any,
            { collectionId, input }: { collectionId: string; input: any }
        ) => {
            try {
                const features = await GeoJsonService.listFeatures(collectionId);
                const updatePromises = features.map((feature) =>
                    GeoJsonService.updateFeature(feature.id, { ...input, collectionId })
                );

                await Promise.all(updatePromises);
                return {
                    success: true,
                    message: `Updated ${features.length} features in collection`,
                    featuresCount: features.length,
                };
            } catch (error) {
                return {
                    success: false,
                    message:
                        error instanceof Error
                            ? error.message
                            : "Failed to update features",
                    featuresCount: 0,
                };
            }
        },

        toggleFeatureStatus: async (_: any, { id }: { id: string }) => {
            try {
                const feature = await GeoJsonService.getFeature(id);
                if (!feature) {
                    throw new Error('Feature not found');
                }
                const updatedFeature = await GeoJsonService.updateFeature(id, {
                    type: feature.type,
                    properties: JSON.stringify(feature.properties),
                    geometry: JSON.stringify(feature.geometry),
                    bounds: feature.bounds ? JSON.stringify(feature.bounds) : undefined
                });
                return {
                    success: true,
                    feature: updatedFeature
                };
            } catch (error) {
                return {
                    success: false,
                    error:
                        error instanceof Error
                            ? error.message
                            : "Failed to toggle feature status",
                };
            }
        },

        // Bulk operations for adding multiple GeoJSON features
        bulkCreateGeoJsonFeatures: (_: any, { input }: { input: any[] }) =>
            GeoJsonService.bulkCreateFeatures(input),

        // Import GeoJSON data from file or raw data
        importGeoJsonData: (
            _: any,
            { collectionId, geoJsonData }: { collectionId: string; geoJsonData: any }
        ) => GeoJsonService.importGeoJsonData(collectionId, geoJsonData),
    },

    // Relations
    GeoJsonCollection: {
        features: (parent: any) => GeoJsonService.listFeatures(parent.id),
    },

    GeoJsonFeature: {
        collection: (parent: any) =>
            GeoJsonService.getCollection(parent.collectionId),
    },
};
