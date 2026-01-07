export const propertyManagementTypedefs = `#graphql

type PlanDetails {
  id: ID
  planName: String
  description: String
  billingCycle: String
  durationInDays: Int
  visitsAllowed: Int
  pricePerVisit: Float
}

type PropertyVisit {
  id: ID!
  propertyId: ID!
  visitedBy: String
  notes: String
  status: String
  createdAt: Date
  updatedAt: Date
  media: [VisitMediaItem!]
}

type VisitMediaItem {
  id: ID!
  mediaUrl: String!
  mediaType: String!
  capturedAt: Date
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

type AdminUser {
  adminId: ID!
  firstName: String
  lastName: String
  email: String!
  phone: String
  department: String
  employeeId: String
  avatar: String
}

type AssignmentDetails {
  userPropertyId: ID!
  property: Property
  user: userdata
  agent: AdminUser
  assignedBy: AdminUser
  assignedAt: Date
  startDate: Date
  endDate: Date
}

type AssignmentResponse {
  success: Boolean!
  message: String!
  previousAgent: String
  data: UserProperty
}

type PropertyLocation {
  name: String
  address: String
  city: String
  district: String
  state: String
  pinCode: String
  country: String
  centerPoint: String
  boundary: String
  geoJson: JSON
  calculatedArea: Float
}

type FieldAgentProperty {
  userPropertyId: ID!
  propertyId: ID!
  property: PropertyLocation
  images: [PropertyImage!]
  planDetails: PlanDetails!
  visitsRemaining: Int
  visitsUsed: Int
  startDate: Date
  endDate: Date
  status: String
  assignedAt: Date
  owner: userdata
}

type FieldAgentPropertyResult {
  meta: meta!
  data: [FieldAgentProperty!]!
}

type VisitHistoryResult {
  meta: meta!
  data: [PropertyVisit!]!
}

type VisitMediaUploadResponse {
  success: Boolean!
  message: String!
  uploadedCount: Int
  failedCount: Int
  media: [VisitMediaItem!]
}

type MarkVisitResponse {
  success: Boolean!
  message: String!
  visitId: ID!
  data: JSON
}

type AgentDashboardStats {
  totalAssignedProperties: Int!
  totalVisitsCompleted: Int!
  totalMediaUploaded: Int!
  propertiesWithPendingVisits: Int!
  totalVisitsAllocated: Int!
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
     userId: String
  }

input assignPropertyToAgentInput {
  userPropertyId: String!
  agentId: String!
}

input reassignPropertyToAgentInput {
  userPropertyId: String!
  newAgentId: String!
}

input unassignPropertyFromAgentInput {
  userPropertyId: String!
}

input markPropertyVisitInput {
  userPropertyId: String!
  notes: String
  visitDate: Date
}

input uploadVisitMediaInput {
  visitId: String!
  mediaFiles: [Upload!]!
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
  getAllManagedProperties(page: Int, limit: Int, searchTerm:String, billingCycle: String, planName: String, status: String): UserPropertyResult
  getPropertyAssignmentDetails(userPropertyId: String!): AssignmentDetails
  getAssignedProperties(page: Int, limit: Int): FieldAgentPropertyResult
  getAssignedPropertyDetails(userPropertyId: String!): FieldAgentProperty
  getPropertyVisitHistory(userPropertyId: String!, page: Int, limit: Int): VisitHistoryResult
  getVisitMedia(visitId: String!): [VisitMediaItem!]
  getAgentDashboardStats: AgentDashboardStats
}

type Mutation {
  createManagedPropertyByUser(
    input: createManagedPropertyInput!
  ): managedPropertyResponse!
  assignPropertyToAgent(input: assignPropertyToAgentInput!): AssignmentResponse!
  reassignPropertyToAgent(input: reassignPropertyToAgentInput!): AssignmentResponse!
  unassignPropertyFromAgent(input: unassignPropertyFromAgentInput!): AssignmentResponse!
  markPropertyVisit(input: markPropertyVisitInput!): MarkVisitResponse!
  uploadVisitMedia(input: uploadVisitMediaInput!): VisitMediaUploadResponse!
}
`;