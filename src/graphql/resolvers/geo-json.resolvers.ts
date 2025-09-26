import { GeoJsonService } from "../services/geo-json.service";


export const geoJsonResolvers = {
    Query: {
        getGeoJsonCollection: (_: any, { id }: { id: string }) =>
            GeoJsonService.getCollection(id),

        listGeoJsonCollections: () => GeoJsonService.listCollections(),

        getGeoJsonFeature: (_: any, { id }: { id: string }) =>
            GeoJsonService.getFeature(id),

        listGeoJsonFeatures: (_: any, { collectionId }: { collectionId: string }) =>
            GeoJsonService.listFeatures(collectionId),

        findGeoJsonFeaturesWithinRadius: (_: any, { lat, lng, radiusKm }: { lat: number; lng: number; radiusKm: number }) =>
            GeoJsonService.findFeaturesWithinRadius(lat, lng, radiusKm),
    },

    Mutation: {
        createGeoJsonCollection: (_: any, { input }: any) =>
            GeoJsonService.createCollection(input),

        updateGeoJsonCollection: (_: any, { id, input }: any) =>
            GeoJsonService.updateCollection(id, input),

        deleteGeoJsonCollection: (_: any, { id }: { id: string }) =>
            GeoJsonService.deleteCollection(id),

        createGeoJsonFeature: (_: any, { input }: any) =>
            GeoJsonService.createFeature(input),

        updateGeoJsonFeature: (_: any, { id, input }: any) =>
            GeoJsonService.updateFeature(id, input),

        deleteGeoJsonFeature: (_: any, { id }: { id: string }) =>
            GeoJsonService.deleteFeature(id),

        // Bulk operations for adding multiple GeoJSON features
        bulkCreateGeoJsonFeatures: (_: any, { input }: { input: any[] }) =>
            GeoJsonService.bulkCreateFeatures(input),

        // Import GeoJSON data from file or raw data
        importGeoJsonData: (_: any, { collectionId, geoJsonData }: { collectionId: string; geoJsonData: any }) =>
            GeoJsonService.importGeoJsonData(collectionId, geoJsonData),
    },

    // Relations
    GeoJsonCollection: {
        features: (parent: any) => GeoJsonService.listFeatures(parent.id),
    },

    GeoJsonFeature: {
        collection: (parent: any) => GeoJsonService.getCollection(parent.collectionId),
    },
};
