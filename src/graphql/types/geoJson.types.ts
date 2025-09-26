export const geoJsonTypeDefs = `#graphql
  # Blog Types
#graphql

# GeoJSON Collection
type GeoJsonCollection {
  id: ID!
  name: String!
  description: String
  data: String! # Raw GeoJSON string
  createdAt: Date!
  updatedAt: Date!
  features: [GeoJsonFeature!]!
}

# GeoJSON Feature
type GeoJsonFeature {
  id: ID!
  collectionId: ID!
  type: String! # Point, LineString, Polygon, etc.
  properties: JSON # JSON string
  geometry: JSON# JSON string
  bounds: String      # Optional bounding box
  createdAt: Date!
  updatedAt: Date!
  collection: GeoJsonCollection!
}

# Input Types
input GeoJsonCollectionInput {
  name: String!
  description: String
  data: String!
}

input GeoJsonFeatureInput {
  collectionId: ID!
  type: String!
  properties: JSON!
  geometry: JSON!
  bounds: JSON
}

# Queries
extend type Query {
  getGeoJsonCollection(id: ID!): GeoJsonCollection
  listGeoJsonCollections: [GeoJsonCollection!]!
  getGeoJsonFeature(id: ID!): GeoJsonFeature
  listGeoJsonFeatures(collectionId: ID!): [GeoJsonFeature!]!
  findGeoJsonFeaturesWithinRadius(lat: Float!, lng: Float!, radiusKm: Float!): [GeoJsonFeature!]!
}

# Mutations
extend type Mutation {
  createGeoJsonCollection(input: GeoJsonCollectionInput!): GeoJsonCollection!
  createGeoJsonFeature(input: GeoJsonFeatureInput!): GeoJsonFeature!
  updateGeoJsonCollection(id: ID!, input: GeoJsonCollectionInput!): GeoJsonCollection!
  updateGeoJsonFeature(id: ID!, input: GeoJsonFeatureInput!): GeoJsonFeature!
  deleteGeoJsonCollection(id: ID!): Boolean!
  deleteGeoJsonFeature(id: ID!): Boolean!
  bulkCreateGeoJsonFeatures(input: [GeoJsonFeatureInput!]!): [GeoJsonFeature!]!
  importGeoJsonData(collectionId: ID!, geoJsonData: String!): [GeoJsonFeature!]!
}

` 