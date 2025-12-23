export const propertyManagementTypedefs = `#graphql

type PlanDetails {
  id: ID
  planName: String
  description: String
  billingCycle: String
  durationInDays: Int
  visitsAllowed: Int
}

type PropertyVisit {
  id: ID!
  date: String
  status:String,
  visitedBy:String,
  visitedAt:Date
}

type PropertyVisitMedia {
  id: ID!
  mediaUrl: String
  mediaType: String
}

type userdata{
    userId:String,
    firstName: String,
    lastName: String,
    phone:String,
    email:String
}

  type meta {
    page:Int
    limit:Int
    total:Int
    totalPages:Int
  }
  type UserProperty {
  userPropertyId: ID!
  visitsRemaining: Int
  visitsUsed: Int
  property: Property
  images: [PropertyImage!]
  planDetails: PlanDetails!
  visits: [PropertyVisit!]
  visitMedia: [PropertyVisitMedia!]
  user:userdata
}


type UserPropertyResult {
  meta: meta!
  data: [UserProperty!]!
}


input createManagedPropertyInput {
     planId: Int!,
     PropertyType: PropertyType!,
     title: String!,
     description: String,
     state: String!,
     district: String!,
     flag:String!,
     city: String!,
     Area: Float!,
     pincode:Int
     AreaUnit: AreaUnit!,
     images: [Upload!],
  }

  type managedPropertyResponse {
  property: ManagedProperty
  images: [PropertyImage]
  }

  type ManagedProperty {
  id: ID!
  uuid: String
  title: String!
  description: String!
  propertyType: PropertyType!
  status: String!
  area: Float!
  areaUnit: AreaUnit!
  address: String
  city: String
  district: String
  state: String
  country: String
  pinCode: String
  landType : String
  createdByType: CreatedByType!
  images: [Image!]!
  videos: String
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
}

type Query {
  getManagedProeprtiesByUser(page: Int, limit: Int): UserPropertyResult
  getManagedUserPropertiesID(property_id: String): UserProperty
  getAllManagedProperties(page: Int, limit: Int, searchTerm:String): UserPropertyResult
}

type Mutation {
  createManagedPropertyByUser(
    input: createManagedPropertyInput!
  ): managedPropertyResponse!
}
`;