export const userPropertyTypeDefs = `#graphql
scalar JSON
scalar Date

enum PropertyType { RESIDENTIAL COMMERCIAL }
enum AreaUnit { SQFT SQM SQYRD }
enum CreatedByType { USER ADMIN }
enum ApprovalStatus { APPROVED PENDING REJECTED }
enum ListingAs { OWNER AGENT BUILDER }

type Image {
  url: String!
  alt: String
}

type location {
  lat: Float
  lng: Float
}

input SaveUserPropertyInput {
  propertyId: String
  category: String
  notes: String
  collectionIds: [String]
}


input unsavePropertyInput {
  propertyId: String
}

type PropertyImageVariants {

  medium: String
 
}
  type PropertyImage {

  variants: PropertyImageVariants
  
}

extend type Property {
  saved: Boolean
  saveCount: Int!
}


type SavedPropertyCollection {
  id: ID!
  userId: ID!
  name: String!
  description: String
  isPublic: Boolean!
  sortOrder: Int
  createdAt: Date!
  updatedAt: Date!
  properties: [Property!]!
  user: PlatformUser

}

type SavedPropertyStats {
  totalSaved: Int!
  viewedCount: Int!
  recentlySavedCount: Int!
}



input UnsavePropertyInput {
  propertyId: String!
  removeFromAllCollections: Boolean
}

input SavedPropertyCollectionInput {
  name: String!
  description: String
  isPublic: Boolean
  sortOrder: Int
}


type PlatformUser {
  id: ID!
  uuid: String!
  email: String
  firstName: String
  lastName: String
  isActive: Boolean!
  isVerified: Boolean!
  emailVerifiedAt: String
  lastLoginAt: String
  twoFactorEnabled: Boolean!
  licenseNumber: String
  companyName: String
  businessType: String
  taxId: String
  createdAt: String!
  updatedAt: String!
  savedProperties: [Property!]!
  savedPropertyCollections: [SavedPropertyCollection!]!
  savedPropertiesCount: Int! 
}



type SavedProperty {
  id: ID!
  userId: ID!
  propertyId: ID!
  category: String
  notes: String
  savedAt: Date!
  createdAt: Date!
  updatedAt: Date!
  isActive: Boolean!
  user: PlatformUser
  property: Property
  collections: [SavedPropertyCollection!]! 
}


type savedPropertyResp {
  id: ID!
  userId: ID!
  propertyId: ID!
  category: String
  notes: String
  savedAt: Date!
  createdAt: Date!
  updatedAt: Date!
  isActive: Boolean!
  property: Property 
  seo: Seo
  images: [PropertyImage!]!
}


type savedPropertiesData {
  properties: [savedPropertyResp!]!
  hasMore: Boolean!
  collections: [SavedPropertyCollection!]!
  totalCount: Int!
}


# Input for searching by state/city
input PropertySearchByStateOrCityInput {
  page: Int = 1
  limit: Int = 5
  state: String
  city: String
  minPrice: Float
  maxPrice: Float
  landType: String
  sortBy: String
}

# Meta info for pagination
type PropertySearchMeta {
  total: Int
  page: Int
  limit: Int
  totalPages: Int
  avgPrice: Float
  minPrice: Float
  maxPrice: Float
}

# Owner info (for response)
type PropertyOwner {
  firstName: String
  lastName: String
  email: String
  phone: String
  city: String
  state: String
  avatar: String
}

# Individual property result
type PropertySearchItem {
  property: Property
  seo: Seo
  verification: Verification
  owner: PropertyOwner
  images: [PropertyImage]
}

# Main paginated response
type PropertySearchByStateOrCityResponse {
  data: [PropertySearchItem]
  meta: PropertySearchMeta
}


extend type Query {
  savedProperty(id: ID!): Property!
  savedProperties(
    filter: JSON
    limit: Int
    offset: Int
    sortBy: String
    sortDirection: String
  ): savedPropertiesData
  isPropertySaved(propertyId: ID!): Boolean!
  savedPropertyCollections(
    includeEmpty: Boolean
    limit: Int
    offset: Int
  ): [SavedPropertyCollection!]!
  savedPropertyCollection(id: ID!): SavedPropertyCollection!
  savedPropertyStats(timeframe: String): SavedPropertyStats!
  publicSavedCollections(limit: Int = 20, offset: Int = 0): [SavedPropertyCollection!]!

   # # Search Property by state or City
    propertySearchByStateOrCity(input: PropertySearchByStateOrCityInput): PropertySearchByStateOrCityResponse!
}


type unsaveResponse {
  success: Boolean!
  message: String!
  wasSaved: Boolean!
}

type savedPropertySchema {
  id: ID!
  userId: ID!
  propertyId: ID!
  category: String
  notes: String
  savedAt: Date!
  createdAt: Date!
  updatedAt: Date!
}

type saveResponse {
  success: Boolean!
  message: String!
  savedProperty: savedPropertySchema
}

extend type Mutation {
  saveProperty(input: SaveUserPropertyInput!): saveResponse
  createSavedPropertyCollection(input: SavedPropertyCollectionInput!): SavedPropertyCollection!
  unsaveProperty(input: UnsavePropertyInput!): unsaveResponse
  addPropertyToCollection(collectionId: ID!, savedPropertyId: ID!): Boolean!
  saveMultipleProperties(propertyIds: [String!]!, category: String): [Property!]!
  unsaveMultipleProperties(propertyIds: [String!]!): [Property!]!
  updateSavedProperty(id: ID!, category: String, notes: String): Property!
  updateSavedPropertyCollection(id: ID!, name: String, description: String, isPublic: Boolean): SavedPropertyCollection!
  deleteSavedPropertyCollection(id: ID!): Boolean!
  updateSavedPropertyCollectionOrder(collectionIds: [ID!]!, sortOrder: [Int!]!): [SavedPropertyCollection!]!
  updateSavedPropertyCollectionProperties(collectionId: ID!, propertyIds: [ID!]!): SavedPropertyCollection!
  deleteSavedPropertyCollectionProperties(collectionId: ID!, propertyIds: [ID!]!): SavedPropertyCollection!
  removePropertyFromCollection(collectionId: ID!, savedPropertyId: ID!): Boolean!
  addPropertiesToCollection(collectionId: ID!, savedPropertyIds: [ID!]!): Boolean!
  removePropertiesFromCollection(collectionId: ID!, savedPropertyIds: [ID!]!): Boolean!
  markSavedPropertyViewed(id: ID!): Property!

}
`;
