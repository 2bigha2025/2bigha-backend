

export const propertyApprovalEnhancedTypeDefs = `#graphql
  # Enhanced Property Approval Types
  type PropertyWithNotifications {
    id: ID!

  }

#   type NotificationResult {
#     emailSent: Boolean!
#     smsSent: Boolean!
#     errors: [String!]!
#   }

#   type BulkActionResult {
#     propertyId: ID!
#     success: Boolean!
#     property: PropertyWithNotifications
#     error: String
#   }

#   type BulkActionSummary {
#     total: Int!
#     successful: Int!
#     failed: Int!
#     emailsSent: Int!
#     smsSent: Int!
#   }

#   type BulkActionResponse {
#     results: [BulkActionResult!]!
#     notificationResults: BulkNotificationResult!
#     summary: BulkActionSummary!
#   }

#   type BulkNotificationResult {
#     totalSent: Int!
#     emailsSent: Int!
#     smsSent: Int!
#     errors: [String!]!
#   }

  # Enhanced Input Types
  input PropertyApprovalInput {
    propertyId: ID!
    message: String
    adminUserId: ID
    adminNotes: String
    reason: String
  }

#   input BulkPropertyActionInput {
#     propertyIds: [ID!]!
#     action: ApprovalAction!
#     message: String
#     adminNotes: String
#     reason: String
#   }

  # Enhanced Queries
  extend type Query {
    # Enhanced property queries with notification support
    pendingApprovalPropertiesEnhanced(limit: Int, offset: Int): [PropertyWithNotifications!]!
    # propertyApprovalStatistics: ApprovalStatistics!
    
    # # Property approval history with notifications
    # propertyApprovalHistoryWithNotifications(propertyId: ID!, limit: Int, offset: Int): [PropertyApprovalHistoryWithNotifications!]!
  }

  # Enhanced Mutations
  extend type Mutation {
    # Enhanced approval actions with automatic notifications
    approveProperty(input: PropertyApprovalInput!): PropertyWithNotifications!
    rejectProperty(input: PropertyApprovalInput!): PropertyWithNotifications!
    verifyProperty(input: PropertyApprovalInput!): PropertyWithNotifications!
    # flagProperty(input: PropertyApprovalInput!): PropertyWithNotifications!
    
  }

  # Enhanced History Type
#   type PropertyApprovalHistoryWithNotifications {
#     id: ID!
#     propertyId: ID!
#     action: ApprovalAction!
#     previousStatus: String
#     newStatus: String!
#     message: String
#     adminNotes: String
#     reason: String
#     createdAt: Date!
#     admin: AdminUser
#     notificationsSent: Boolean!
#     emailDelivered: Boolean
#     smsDelivered: Boolean
#   }
`
