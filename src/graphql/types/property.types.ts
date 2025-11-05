

export const propertyTypeDefs = `#graphql
  # Property Types
  scalar Date
  scalar JSON
  scalar Upload
enum PropertyType {
  COMMERCIAL
  RESIDENTIAL
  AGRICULTURAL
  INDUSTRIAL
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

enum CreatedByType {
  ADMIN
  USER
}

enum AreaUnit {
  SQYRD
  KANAL
  MARLA
  ACRE
  BIGHAS
  SQUARE_FEET
  HECTARE
}

enum ListingAs {
  OWNER
  AGENT
  BUILDER
}

enum landStatus {
    AVAILABLE
    SOLD
}

type Seo {
  id: ID!
  propertyId: ID!
  slug: String!
  seoTitle: String!
  seoDescription: String!
  seoKeywords: String!
  createdAt: Date!
  updatedAt: Date!
}

type Verification {
  id: ID!
  propertyId: ID!
  isVerified: Boolean!
  verificationMessage: String!
  verificationNotes: String
  verifiedBy: ID
  verifiedAt: String
}

type Image {
 
  url: String
  alt: String
}

input UpdateSeoInput {
  propertyId: ID!
  slug: String!
  seoTitle: String!
  seoDescription: String!
  seoKeywords: String!
  seoScore: Int
  schema: JSON
}

type PropertyImageVariants {
  thumbnail: String
  medium: String
  large: String
  original: String
}

type PropertyImage {

  variants: PropertyImageVariants
  
}

type location {
  name: String
  address: String
}
type Property {
  id: ID!
  uuid: String
  title: String!
  description: String!
  propertyType: PropertyType!
  status: String!
  price: Float!
  pricePerUnit: Float
  area: Float!
  areaUnit: AreaUnit!
  khasraNumber: String
  murabbaNumber: String
  khewatNumber: String
  address: String
  city: String
  district: String
  state: String
  country: String
  pinCode: String
  latLng: String
  location: location
  boundary: JSON
  calculatedArea: Float
  geoJson: JSON
  createdByType: CreatedByType!
  images: [Image!]!
  videos: String
  listingAs: ListingAs!
  ownerName: String
  ownerPhone: String
  ownerWhatsapp: String
  isFeatured: Boolean!
  isVerified: Boolean!
  isActive: Boolean!
  viewCount: Int!
  inquiryCount: Int!
  createdAt: Date
  updatedAt: Date!
  publishedAt: String
  createdByAdminId: ID
  createdByUserId: ID
  approvalStatus: ApprovalStatus!
  approvalMessage: String
  approvedBy: ID
  approvedAt: String
  rejectionReason: String
  rejectedBy: ID
  rejectedAt: String
  adminNotes: String
  lastReviewedBy: ID
  lastReviewedAt: String
  listingId : Int
  availablilityStatus: landStatus!
  waterLevel : Int
  landMark : String
  category : String
  highwayConn : Boolean
  landZoning : String
  ownersCount : Int
  ownershipYes : Boolean
  soilType: String
  roadAccess: Boolean
  roadAccessDistance: Int
  highwayName: String
}

type createdByUser {
  firstName: String
  lastName: String
}
type propertyUser {
  firstName: String
   lastName: String
   email: String
 role: String
 phone: String
}
type properties {
  seo: Seo
  verification: Verification
  property: Property
  images: [PropertyImage]
  user: propertyUser
  createdByUser: createdByUser
}


  # Enums
  enum PropertyType {
    AGRICULTURAL
    COMMERCIAL
    RESIDENTIAL
    INDUSTRIAL
    VILLA
    APARTMENT
    PLOT
    FARMHOUSE
    WAREHOUSE
    OFFICE
    OTHER
  }

  enum AreaUnit {
    SQYRD
    SQFT
    SQM
    ACRE
    HECTARE
    BIGHA
    KATHA
    MARLA
    KANAL
    GUNTA
    CENT
  }


  enum ListingAs {
    PROPERTY_OWNER
    REAL_ESTATE_AGENT
    PROPERTY_DEALER
    BUILDER
  }

  # Property Input Types
 input SeoInput {
  slug: String
  seoTitle: String
  metaDescription: String
  keywords: String
  ogTitle: String
  ogDescription: String
}

input LocationInput {
  state: String
  district: String
  city: String
  pincode: String
  address: String

}

input PropertyDetailsSchemaInput {
  propertyType: String
  khasraNumber: String
  murabbaNumber: String
  khewatNumber: String
  area: String
  areaUnit: String
  totalPrice: String
  pricePerUnit: String
  ownerId: String
}

input ContactDetailsInput {
  listerType: String
  ownerName: String
  phoneNumber: String
  whatsappNumber: String
}

input CoordinateInput {
  lat: Float
  lng: Float
}

input MapCoordinateInput {
  lat: Float
  lng: Float
  type: String
  shapeId: Float
  index: Int
}

input BoundaryInput {
  type: String
  shapeId: Float
  coordinates: [CoordinateInput!]
  area: Float
}

input MarkerInput {
  lat: Float
  lng: Float
}

input MapInput {
  boundaries: JSON
  coordinates: JSON
  location: JSON

}

# Placeholder if structure is unknown; update if needed
scalar JSON

input CreatePropertyInput {

  location: LocationInput
  propertyDetailsSchema: PropertyDetailsSchemaInput
  contactDetails: ContactDetailsInput
  images: [Upload!] # or define an ImageInput type if structure is available
  map: MapInput
}


enum PropertyStatus {
  DRAFT
  PENDING
  APPROVED
  REJECTED
  FLAGGED
}

  

  input PropertyImageInput {
    imageUrl: String!
    imageType: String
    caption: String
    altText: String
    sortOrder: Int
    isMain: Boolean
  }

  input UpdatePropertyInput {
    title: String
    description: String
    propertyType: PropertyType
 
    price: Float
    area: Float
    areaUnit: AreaUnit
    bedrooms: Int
    bathrooms: Int
    floors: Int
    parking: Int
    furnished: Boolean
    
    # Indian Property Fields
    khasraNumber: String
    murabbaNumber: String
    khewatNumber: String
    
    # Location
    address: String
    city: String
    district: String
    state: String
    country: String
    pinCode: String
    coordinates: CoordinatesInput
    boundary: JSON
    geoJson: JSON
    
    # Owner Information
    listingAs: ListingAs
    ownerName: String
    ownerPhone: String
    ownerWhatsapp: String
    
    # SEO
    slug: String
    seoTitle: String
    seoDescription: String
    seoKeywords: String
    
    # Media
    images: [PropertyImageInput!]
    videos: JSON
    virtualTourUrl: String
    
    # Features
    amenityIds: [ID!]
    features: JSON
    
    # Status
    status: PropertyStatus
    isFeatured: Boolean
    isVerified: Boolean
    isActive: Boolean
  }

  input PropertyFilters {
    propertyType: PropertyType
    
    status: PropertyStatus
    minPrice: Float
    maxPrice: Float
    minArea: Float
    maxArea: Float
    areaUnit: AreaUnit
    city: String
    district: String
    state: String
    pinCode: String
    bedrooms: Int
    bathrooms: Int
    furnished: Boolean
    isFeatured: Boolean
    isVerified: Boolean
    isActive: Boolean
    amenityIds: [ID!]
    listingAs: ListingAs
  }

  input CoordinatesInput {
    lat: Float!
    lng: Float!
  }

input GetPropertiesInput {
  page: Int!
  limit: Int!
  searchTerm: String
  approvalstatus:ApprovalStatus
}
  # Property Queries
 type PaginationMeta {
  page: Int
  limit: Int
  total: Int
  totalPages: Int
}


type PaginatedProperties {
  data: [properties !]!
  meta: PaginationMeta
}




  type PropertyAnalytics {
    totalViews: Int!
    uniqueViews: Int!
    averageViewDuration: Float!
    inquiryConversionRate: Float!
    viewsByDate: [ViewsByDate!]!
    topReferrers: [ReferrerStats!]!
  }

  type ViewsByDate {
    date: String!
    views: Int!
  }

  type ReferrerStats {
    referrer: String!
    views: Int!
  }
 
  # Simple totals for dashboard
  type PropertyTotals {
    totalProperties: Int!
    totalValue: Float!
  }

  input PropertySort {
    field: PropertySortField!
    # direction: SortDirection!
  }

  enum PropertySortField {
    CREATED_AT
    UPDATED_AT
    PUBLISHED_AT
    PRICE
    AREA
    VIEW_COUNT
    INQUIRY_COUNT
    TITLE
  }


 extend type Query {
    properties(input: GetPropertiesInput!): PaginatedProperties
    getPendingApprovalProperties(input: GetPropertiesInput!): PaginatedProperties
    getRejectedProperties(input: GetPropertiesInput!): PaginatedProperties
    getApprovedProperties(input: GetPropertiesInput!): PaginatedProperties
    getPropertiesPostedByAdmin(input: GetPropertiesInput!): PaginatedProperties
    # Dashboard totals
    topProperties(limit: Int): [Property!]!
    getPropertyTotals(state: String, district: String): PropertyTotals!
    # Location and view count based queries
    # property(id: ID, uuid: String, slug: String): Property
    # featuredProperties(limit: Int): [Property!]!
    # nearbyProperties(latitude: Float!, longitude: Float!, radius: Float!, limit: Int): [Property!]!
    # propertiesCount(filter: PropertyFilters): Int!
    # propertiesInBounds(minLat: Float!, maxLat: Float!, minLng: Float!, maxLng: Float!, limit: Int): [Property!]!
    # propertiesNearPoint(lat: Float!, lng: Float!, radiusKm: Float!, limit: Int): [Property!]!
    # # Amenities
    # propertyAmenities(category: String): [PropertyAmenity!]!
    
    # # Analytics
    # propertyAnalytics(propertyId: ID!): PropertyAnalytics!
  }

    # Property Mutations
  extend type Mutation {
    createProperty(input: CreatePropertyInput!): Property!
    updateProperty(id: ID!, input: UpdatePropertyInput!): Property!
    deleteProperty(id: ID!): Boolean!
    updatePropertySeo(input: UpdateSeoInput!): Seo!
    # Status Management
    # approveProperty(id: ID!): Property!
    # rejectProperty(id: ID!, reason: String!): Property!
    # featureProperty(id: ID!): Property!
    # unfeatureProperty(id: ID!): Property!
    # verifyProperty(id: ID!): Property!
    # unverifyProperty(id: ID!): Property!
    
    # # Analytics
    # recordPropertyView(propertyId: ID!, sessionId: String, viewDuration: Int): PropertyView!
    
    # # Price Management
    # updatePropertyPrice(id: ID!, newPrice: Float!, reason: String): PropertyPriceHistory!
    
    # # Image Management
    # addPropertyImages(propertyId: ID!, images: [PropertyImageInput!]!): [PropertyImage!]!
    # removePropertyImage(imageId: ID!): Boolean!
    # setMainPropertyImage(imageId: ID!): PropertyImage!
    
    # # Amenity Management
    # createPropertyAmenity(name: String!, category: String!, icon: String, description: String): PropertyAmenity!
    # updatePropertyAmenity(id: ID!, name: String, category: String, icon: String, description: String): PropertyAmenity!
    # deletePropertyAmenity(id: ID!): Boolean!
  }
`
