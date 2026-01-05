export const farmsTypeDefs = `#graphql
  # farm Types
  scalar Date
  scalar JSON
  scalar Upload


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
  COMPANY
}

enum ListingType{
 SALE
 LEASE
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
}

type NearestMajorCity {
  city: String
  distance: Int
  unit: String
}

input NearestMajorCityInput {
  city: String
  distance: Int
  unit: String
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

type PropertyImageVariants   {
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
  title: String
  description: String
  propertyType: PropertyType
  propertyName:String
  source:String
  status: String!
  price: Float!
  pricePerUnit: Float
  area: Float!
  areaUnit: AreaUnit!
  address: String
  city: String
  district: String
  state: String
  country: String
  latLng: String
  location: location
  boundary: JSON
  calculatedArea: Float
  geoJson: JSON
  createdByType: CreatedByType!
  images: [Image!]!
  videos: String
   listingAs: ListingAs
   listingType:ListingType
   isPriceNegotiable :Boolean
    hasGatedCommunity : Boolean
    multipleSizeOptions :Boolean
    nearestMajorCity:NearestMajorCity
    nearbyActivities :[String]
    scenicFeatures:[String]
    amenities:[String]
    ownerId:String
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
  approvedAt: Date
  rejectionReason: String
  rejectedBy: ID
  rejectedAt: String
  adminNotes: String
  lastReviewedBy: ID
  lastReviewedAt: String
  listingId : Int
  availablilityStatus: landStatus!
  waterLevel : Int
  category : String
  highwayConn : Boolean
  roadAccess: Boolean
  roadAccessDistance: Int
  roadAccessWidth : Int
  roadAccessDistanceUnit : String
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

type Properties {
  seo: Seo
  verification: Verification
  property: Property
  images: [PropertyImage]
  user: propertyUser
  createdByUser: createdByUser
  saved: Boolean
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
    FARMLAND
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


  # Farm Input Types
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
  address: String

}

input FarmDetailsSchemaInput {
  propertyName: String
  listingAs: String
  propertyType: String
  area: String
  areaUnit: String
  price: Float
  source:String
  pricePerUnit: Float
  waterLevel : Int
  landMark : [String]
  category : String
  highwayConn : Boolean
  roadAccess: Boolean
  roadAccessDistance: Int
  description: String
  roadAccessWidth : Int
  roadAccessDistanceUnit : String
  listingType: String
  isPriceNegotiable: Boolean 
  hasGatedCommunity: Boolean
  multipleSizeOptions: Boolean
  nearestMajorCity :NearestMajorCityInput
  nearbyActivities: [String] 
  scenicFeatures: [String]
  amenities: [String] 
}

input ContactDetailsInput {
  listingAs: String
  ownerName: String
  phoneNumber: String
  alternativePhone: String
}

input CoordinateInput {
  lat: Float
  lng: Float
}

 input LocationBasedFarmsInput {
  lat: Float
  lng: Float
  radius: Int
  limit: Int = 10
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

input CreateFarmsInput {
  location: LocationInput
  farmDetailsSchema: FarmDetailsSchemaInput
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

  input UpdateFarmInput {
    title: String
    description: String
    propertyType: PropertyType
    propertyName :String
    source:String
    price: Float
    area: Float
    areaUnit: AreaUnit
    bedrooms: Int
    bathrooms: Int
    floors: Int
    parking: Int
    furnished: Boolean
    
    listingType: String
    isPriceNegotiable: Boolean 
    hasGatedCommunity: Boolean 
    multipleSizeOptions: Boolean
    nearestMajorCity:NearestMajorCityInput
    nearbyActivities: [String]
    scenicFeatures: [String] 
    amenities: [String] 
    
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

input GetFarmsInput {
 userId: String
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


type PaginatedFarms {
  data: [Properties]!
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
    getFarms(input: GetFarmsInput!): PaginatedFarms
    getFarmsByUser(input: GetFarmsInput):PaginatedFarms
    getFarmById(id:String):PaginatedFarms
    getPendingApprovalFarms(input: GetFarmsInput!): PaginatedFarms
    getRejectedFarms(input: GetFarmsInput!): PaginatedFarms
    getApprovedFarms(input: GetFarmsInput!): PaginatedFarms
    getFarmsPostedByAdmin(input: GetFarmsInput!): PaginatedFarms
    # Dashboard totals
    getTopFarms(input: GetFarmsInput): PaginatedFarms
    getNewFarms(input: GetFarmsInput): PaginatedFarms
    getFarmsTotals(state: String, district: String): PropertyTotals!
    getFarmsByLocation(input:LocationBasedFarmsInput! ):[Property!]! 
  }

    # Property Mutations
  extend type Mutation {
    createFarmByAdmin(input: CreateFarmsInput!): Properties!
    createFarmByUser(input: CreateFarmsInput!): Properties!
    # updateFarms(id: ID!, input: UpdateFarmsInput!): Property!
    # deleteFarms(id: ID!): Boolean!
    updateFarmSeo(input: UpdateSeoInput!): Seo!
  }
`;
