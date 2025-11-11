export const platformUserTypeDefs = `#graphql

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

type Seo {
  id: ID!
  propertyId: ID!
  slug: String!
  seoTitle: String!
  seoDescription: String!
  seoKeywords: String!
  createdAt: String!
  updatedAt: String!
  schema: JSON
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
  coordinates: MapCoordinate
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

  isFeatured: Boolean!
  isVerified: Boolean!
  isActive: Boolean!
  viewCount: Int!
  inquiryCount: Int!
  createdAt: Date!
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
  saved: Boolean
  listingId : Int
  landZoning : String
  ownersCount : Int
  waterLevel : Int
  category : String
  highwayConn : Boolean
  ownershipYes : Boolean
  soilType: String
  roadAccess: Boolean
  roadAccessDistance: Int
  landMark: String
  landMarkName: String
  landType : String
  roadAccessWidth : Int
  roadAccessDistanceUnit : String
 
}
type properties {
  seo: Seo
  property: Property
  images: [PropertyImage]
  saved : Boolean
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


type PaginationMeta {
  page: Int
  limit: Int
  total: Int
  totalPages: Int
}
type owner {


  firstName: String
  lastName: String
  phone: String
  avatar : String
  role : String
}

type properties {
 seo: Seo
  verification: Verification
  property: Property
  images: [PropertyImage]
  owner: owner

}

type PaginatedProperties {
  data: [properties!]!
  meta: PaginationMeta
}

input GetPropertiesInput {
  page: Int!
  limit: Int!
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
  waterLevel : Int
  landMark : [String]
  category : String
  highwayConn : Boolean
  landZoning : String
  ownersCount : Int
  ownershipYes : Boolean
  soilType: String,
  roadAccess: Boolean,
  roadAccessDistance: Int,
  description: String,
  landMarkName: JSON
  roadAccessWidth : Int
  roadAccessDistanceUnit : String
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

  

  # Platform User Types
  type PlatformUser {
    id: ID!
    uuid: String!
    email: String
    firstName: String
    lastName: String
    role: PlatformUserRole!
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
    profile: PlatformUserProfile
  }

  type PlatformUserProfile {
    id: ID!
    bio: String
    avatar: String
    phone: String
    address: String
    city: String
    state: String
    country: String
    pincode: String
    website: String
    socialLinks: JSON
    preferences: JSON
    specializations: JSON
    serviceAreas: JSON
    languages: JSON
    experience: Int
    rating: Int
    totalReviews: Int
    createdAt: String!
    updatedAt: String!
  }

  # Enums
  enum PlatformUserRole {
    OWNER
    AGENT
    USER
  }

  # Auth Response Types
  type PlatformAuthResponse {
    success: Boolean!
    message: String!
    token: String
    refreshToken: String
    user: PlatformUser
    requiresEmailVerification: Boolean
    requiresPhoneVerification: Boolean
  }

  type PhoneOTPResponse {
    success: Boolean!
    message: String!
    otpSent: Boolean!
    expiresIn: Int
    remainingAttempts: Int
  }

  type GoogleAuthResponse {
    success: Boolean!
    message: String!
    token: String
    refreshToken: String
    user: PlatformUser
    isNewUser: Boolean!
  }
    input PlatformUserProfileInput {
    bio: String
    avatar: Upload
    phone: String
    address: String
    city: String
    state: String
    country: String
    pincode: String
    languages: JSON
    experience: Int
    rating: Int
    totalReviews: Int
  }

  # Input Types
  input PlatformUserSignupInput {
    email: String!
    password: String
    firstName: String
    lastName: String
    role: PlatformUserRole
    profile:PlatformUserProfileInput
    agreeToTerms: Boolean!
  }

  input PlatformUserLoginInput {
    email: String!
    password: String!
    rememberMe: Boolean
    deviceId: String
  }

  input PhoneLoginInput {
    phone: String!
    deviceId: String
  }

  input VerifyPhoneOTPInput {
    phone: String!
    otp: String!
    deviceId: String
  }

  input GoogleAuthInput {
    googleToken: String!
    deviceId: String
  }

  input UpdateProfileInput {
    firstName: String
    lastName: String
    bio: String
    phone: String
    address: String
    city: String
    state: String
    country: String
    pincode: String
    website: String
    socialLinks: JSON
    preferences: JSON
    specializations: JSON
    serviceAreas: JSON
    languages: JSON
    experience: Int
  }

    type EnhancedProfile {
    basicInfo: BasicInfo!
    addressInfo: AddressInfo
    onlinePresence: OnlinePresence
    professionalInfo: ProfessionalInfo
    accountInfo: AccountInfo!
  }
  type SeoPage {
    title: String!
    description: String
    keywords: String
    image: String
    status: String!
    schemaType: String
    schemaDescription: String
  
  }


  # Custom Scalar
  scalar JSON

  # Queries
    input inputGetPropertyBySlug {
    slug:String!
    }

 type homePageSeo {
   
    siteTitle: String!
    metaDescription: String
    keywords: String
    ogTitle: String
    ogDescription: String
    ogImage: String
   
  }
 input LocationBasedPropertiesInput {
  lat: Float
  lng: Float
  radius: Int
  limit: Int = 10
}

input ViewCountPropertiesInput {
  limit: Int = 10
  minViewCount: Int
}   

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

}
  type Query {
    getHomePageSeo:homePageSeo
     getPropertyBySlug(input: inputGetPropertyBySlug!):properties 
    getEnhancedProfile: EnhancedProfile
    getTopProperties: [properties]
    # Get current user profile
    me: PlatformUser
         getSeoPageByUrl(url: String!): SeoPage
    # Get user by ID
    getUser(id: ID!): PlatformUser
    getPropertiesByLocation(input: LocationBasedPropertiesInput!): [properties!]!
    getPropertiesByViewCount(input: ViewCountPropertiesInput!): [properties!]!
    # Search users (agents/owners)
    searchUsers(
      query: String
      role: PlatformUserRole
      city: String
      state: String
      specializations: [String]
      limit: Int = 20
      offset: Int = 0
    ): [PlatformUser!]!
    
    # Get user profile by UUID
    getUserProfile(uuid: String!): PlatformUser

    getPropertiesByUser(input: GetPropertiesInput!): PaginatedProperties!
      findGeoJsonFeaturesWithinRadius(lat: Float!, lng: Float!, radiusKm: Float!): [GeoJsonFeature!]!
  }
   input UpdateBasicInfoInput {
    firstName: String
    lastName: String
    email: String
    phone: String
    bio: String
    avatar: String
  }
    # Online Presence Input
  input SocialLinksInput {
    linkedin: String
    twitter: String
    facebook: String
    instagram: String
    youtube: String
  }

  input UpdateOnlinePresenceInput {
    website: String
    socialLinks: SocialLinksInput
  }

  # Professional Information Input
  input UpdateProfessionalInfoInput {
    experience: Int
    specializations: [String!]
    languages: [String!]
    serviceAreas: [String!]
  }

   # Address Information Input
  input UpdateAddressInfoInput {
    address: String
    state: String
    city: String
    country: String
    pincode: String
    location: String
  }
  type userProfile {
    id: ID
  }

   # Enhanced Profile Types
  type BasicInfo {
    firstName: String
    lastName: String
    email: String!
    phone: String
    bio: String
    avatar: String
  }

  type AddressInfo {
    address: String
    city: String
    state: String
    country: String
    pincode: String
    location: String
  }

  type OnlinePresence {
    website: String
    socialLinks: JSON
  }

  type ProfessionalInfo {
    experience: Int
    specializations: JSON
    languages: JSON
    serviceAreas: JSON
    rating: Int
    totalReviews: Int
  }

  type AccountInfo {
    id: ID!
  
    role: PlatformUserRole!
    isActive: Boolean!
    isVerified: Boolean!
    emailVerifiedAt: String
    lastLoginAt: String
    twoFactorEnabled: Boolean!
    licenseNumber: String
    companyName: String
    businessType: String
    createdAt: String!
    updatedAt: String!
  }


  # Mutations
  type Mutation {
    # User Registration
    signupUser(input: PlatformUserSignupInput!): PlatformAuthResponse!
    
    # Email/Password Login
    loginUser(input: PlatformUserLoginInput!): PlatformAuthResponse!
    
    # Phone OTP Login
    requestPhoneOTP(input: PhoneLoginInput!): PhoneOTPResponse!
    verifyPhoneOTP(input: VerifyPhoneOTPInput!): PlatformAuthResponse!
    
    # Google OAuth Login
    googleAuth(input: GoogleAuthInput!): GoogleAuthResponse!
    
    # Profile Management
    updateProfile(input: UpdateProfileInput!): PlatformUser!
    
    # Email Verification
    sendEmailVerification: PlatformAuthResponse!
    verifyEmail(token: String!): PlatformAuthResponse!
    
    # Password Management
    requestPasswordReset(email: String!): PlatformAuthResponse!
    resetPassword(token: String!, newPassword: String!): PlatformAuthResponse!
    changePassword(currentPassword: String!, newPassword: String!): PlatformAuthResponse!
    
    # Account Management
    deactivateAccount: PlatformAuthResponse!
    deleteAccount(password: String!): PlatformAuthResponse!
    
    # Logout
    logout: PlatformAuthResponse!

    createPropertyByUser(input: CreatePropertyInput!): properties!


       # Profile Management - New Specific APIs
    updateBasicInfo(input: UpdateBasicInfoInput!): EnhancedProfile!
    updateAddressInfo(input: UpdateAddressInfoInput!): EnhancedProfile!
    updateOnlinePresence(input: UpdateOnlinePresenceInput!): EnhancedProfile!
    updateProfessionalInfo(input: UpdateProfessionalInfoInput!): EnhancedProfile!
    
  }
`;
