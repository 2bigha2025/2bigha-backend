export const geoJsonTypeDefs = `#graphql
  scalar Upload
  scalar Date
  scalar JSON

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
  geometry: JSON # JSON string
  bounds: String # Optional bounding box
  isEnabled: Boolean # Feature status
  createdAt: Date!
  updatedAt: Date!
  collection: GeoJsonCollection!
}

# Response Types
type DeleteGeoJsonCollectionResponse {
  success: Boolean!
  message: String
  deletedFeatures: Int
  error: String
}

type UploadGeoJsonResponse {
  success: Boolean!
  collection: GeoJsonCollection
  featuresCount: Int
  error: String
}

type UpdateFeaturesResponse {
  success: Boolean!
  message: String!
  featuresCount: Int!
}

type ToggleFeatureResponse {
  success: Boolean!
  feature: GeoJsonFeature
  error: String
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
  isEnabled: Boolean
}

input UpdateAllFeaturesInput {
  properties: JSON
  geometry: JSON
  type: String
  isEnabled: Boolean
}

# Queries
extend type Query {
  getGeoJsonCollection(id: ID!): GeoJsonCollection
  listGeoJsonCollections: [GeoJsonCollection!]!  # <-- Gets all collections
  getGeoJsonFeature(id: ID!): GeoJsonFeature
  listGeoJsonFeatures(input: FeaturesInput!): FeaturesResponse!  # Gets all features with pagination and search
  getFeaturesByCollectionId(collectionId: ID!): [GeoJsonFeature!]!
  findGeoJsonFeaturesWithinRadius(lat: Float!, lng: Float!, radiusKm: Float!): [GeoJsonFeature!]!
  
  # Get all collections with feature count and pagination
  listGeoJsonCollectionsWithFeatureCount(input: CollectionsWithFeatureCountInput): CollectionsWithFeatureCountResponse!
}

# Input for features query with pagination and search
input FeaturesInput {
  page: Int = 1
  limit: Int = 10
  search: String
  sortBy: FeatureSortField = createdAt
  sortOrder: SortOrder = desc
}

# Input for collections with feature count query
input CollectionsWithFeatureCountInput {
  page: Int = 1
  limit: Int = 10
  search: String
  sortBy: CollectionSortField = name
  sortOrder: SortOrder = asc
}

# Enum for feature sort fields
enum FeatureSortField {
  type
  createdAt
  updatedAt
}

# Enum for collection sort fields
enum CollectionSortField {
  name
  createdAt
}

# Enum for sort order
enum SortOrder {
  asc
  desc
}

# Response type for paginated features
type FeaturesResponse {
  features: [GeoJsonFeature!]!
  pagination: PaginationInfo!
}

# Response type for collections with feature count
type CollectionsWithFeatureCountResponse {
  collections: [CollectionWithFeatureCount!]!
  pagination: PaginationInfo!
}

# Collection with feature count
type CollectionWithFeatureCount {
  id: ID!
  name: String!
  description: String
  data: String!
  createdAt: Date!
  updatedAt: Date!
  featureCount: Int!
}

# Pagination information
type PaginationInfo {
  total: Int!
  page: Int!
  limit: Int!
  totalPages: Int!
}

# Mutations
extend type Mutation {
  createGeoJsonCollection(input: GeoJsonCollectionInput!): GeoJsonCollection!
  createGeoJsonFeature(input: GeoJsonFeatureInput!): GeoJsonFeature!
  updateGeoJsonCollection(id: ID!, input: GeoJsonCollectionInput!): GeoJsonCollection!
  updateGeoJsonFeature(id: ID!, input: GeoJsonFeatureInput!): GeoJsonFeature!
  deleteGeoJsonCollection(id: ID!): DeleteGeoJsonCollectionResponse!
  deleteGeoJsonFeature(id: ID!): Boolean!
  bulkCreateGeoJsonFeatures(input: [GeoJsonFeatureInput!]!): [GeoJsonFeature!]!
  importGeoJsonData(collectionId: ID!, geoJsonData: String!): [GeoJsonFeature!]!

  # File upload mutation for GeoJSON
  uploadGeoJsonFile(file: JSON, collectionName: String!, description: String): UploadGeoJsonResponse!

  # Update all features in a collection
  updateAllCollectionFeatures(collectionId: ID!, input: UpdateAllFeaturesInput!): UpdateFeaturesResponse!

  # Toggle feature enabled/disabled status
  toggleFeatureStatus(id: ID!): ToggleFeatureResponse!
}

`