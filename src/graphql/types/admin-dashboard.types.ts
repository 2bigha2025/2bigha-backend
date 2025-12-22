
export const adminDashboardTypeDefs = `#graphql
  # Admin Dashboard Types
  type AdminDashboardStats {
    totalProperties: DashboardMetric!
    pendingApprovals: DashboardMetric!
    activeListings: DashboardMetric!
    todayActivity: TodayActivity!
    recentActivities: [RecentActivity!]!
    propertyStatusDistribution: [PropertyStatusCount!]!
    monthlyTrends: [MonthlyTrend!]!
    topCities: [CityStats!]!
    agentPerformance: [AgentPerformance!]!
  }

   enum PlatformUserRole {
    OWNER
    AGENT
    USER
  }

  type PlatformUser {
    id: ID!
    email: String
    firstName: String
    lastName: String
    role: PlatformUserRole!
    isActive: Boolean!
    isVerified: Boolean!
    emailVerifiedAt: String
    lastLoginAt: String
    twoFactorEnabled: Boolean!
    createdAt: String!
    updatedAt: String!
    updatedby: String
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
    
  input PlatformUserProfileInput {
    bio: String
    avatar: Upload 
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
  }


  type DashboardMetric {
    value: Int!
    change: Float! # percentage change
    changeType: ChangeType!
    previousValue: Int!
  }

  type TodayActivity {
    views: Int!
    inquiries: Int!
    responseRate: Float! # percentage
    newListings: Int!
    approvals: Int!
    rejections: Int!
  }

  type RecentActivity {
    id: String!
    type: ActivityType!
    title: String!
    description: String!
    timestamp: Date!
    user: String
    propertyId: String
    status: String
  }

  type PropertyStatusCount {
    status: String!
    count: Int!
    percentage: Float!
    change: Float!
  }

  type MonthlyTrend {
    month: String!
    year: Int!
    properties: Int!
    inquiries: Int!
    approvals: Int!
    revenue: Float!
  }

  type CityStats {
    city: String!
    state: String!
    totalProperties: Int!
    averagePrice: Float!
    growth: Float!
    inquiries: Int!
  }

  type AgentPerformance {
    agentId: String!
    agentName: String!
    company: String
    totalListings: Int!
    approvedListings: Int!
    pendingListings: Int!
    totalInquiries: Int!
    responseRate: Float!
    averageResponseTime: Float! # in hours
    rating: Float
    revenue: Float!
  }

  # Enums
  enum ChangeType {
    INCREASE
    DECREASE
    NEUTRAL
  }

  enum ActivityType {
    PROPERTY_CREATED
    PROPERTY_APPROVED
    PROPERTY_REJECTED
    INQUIRY_RECEIVED
    INQUIRY_RESPONDED
    USER_REGISTERED
    PAYMENT_RECEIVED
    PROPERTY_VIEWED
  }

  # Input Types
  input AdminDashboardFilters {
    dateRange: DateRangeInput
    cities: [String!]
    states: [String!]
    propertyTypes: [String!]
    agentIds: [String!]
  }

  input DateRangeInput {
    startDate: Date!
    endDate: Date!
  }

 

  input ProfileDataInput {
    firstName: String,
    lastName: String,
    role: PlatformUserRole,
    email: String,
    phone: String,
    address: String,
    avatar: Upload,
}

  # Queries
  extend type Query {
    # Get comprehensive admin dashboard statistics
    adminDashboardStats(
      filters: AdminDashboardFilters
    ): AdminDashboardStats!
    # Search agents by name, phone, or email with pagination
    SearchAgentByNamePhone(
      limit: Int = 10
      page: Int = 1
      searchTerm: String!
    ): SearchUsersResult!
    #Get all platform users with pagination
    GetAllPlatformUsers(
      limit: Int = 10
      page: Int = 1
      searchTerm: String
    ): SearchUsersResult! 
    # Get real-time dashboard metrics
    realTimeDashboardMetrics: AdminDashboardStats!
    # Get detailed activity feed
    adminActivityFeed(
      limit: Int = 50
      offset: Int = 0
      activityTypes: [ActivityType!]
      dateRange: DateRangeInput
    ): [RecentActivity!]!

    # Get agent performance analytics
    agentPerformanceAnalytics(
      agentIds: [String!]
      dateRange: DateRangeInput
      limit: Int = 20
    ): [AgentPerformance!]!

    # Get property analytics
    propertyAnalytics(
      filters: AdminDashboardFilters
    ): PropertyAnalytics!
  }

  type PropertyAnalytics {
    totalViews: Int!
    uniqueVisitors: Int!
    conversionRate: Float!
    averageTimeOnSite: Float!
    topPerformingProperties: [PropertyPerformance!]!
    geographicDistribution: [GeographicData!]!
  }

  type PropertyPerformance {
    propertyId: String!
    title: String!
    views: Int!
    inquiries: Int!
    conversionRate: Float!
    revenue: Float!
  }

  type GeographicData {
    region: String!
    properties: Int!
    inquiries: Int!
    averagePrice: Float!
    growth: Float!
  }

  # Search results wrapper for platform users
  type SearchUsersResult {
    data: [PlatformUser!]!
    meta: SearchMeta!
  }

  type SearchMeta {
    page: Int!
    limit: Int!
    totalPages: Int!
  }
`
