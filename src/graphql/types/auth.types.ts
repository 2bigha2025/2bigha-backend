

export const authTypeDefs = `#graphql
scalar Date
scalar Upload

type Role {
  id: ID!
  name: String!
  slug: String!
  description: String
  color: String
 # Optional: if you want to link permissions to roles
}

type Permission {
  id: ID!
  name: String!
  resource: String!
  action: String!
  description: String
}
  type AuthResponse {
    success: Boolean!
    message: String!
    requiresOTP: Boolean!
    token: String
    refreshToken: String
    admin: User
  }

  type TokenVerificationResponse {
    valid: Boolean!
    admin: User
  }

  # Auth Input Types
  input AdminLoginInput {
    email: String!
    password: String!
    rememberMe: Boolean
    ipAddress: String
  }
  
   
  enum PlatformUserRole {
    OWNER
    AGENT
    USER
  }

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
    createdAt: String!
    updatedAt: String!
    profile: PlatformUserProfile
  }

  type PlatformUserProfile {
    id: ID!
    bio: String
    avatar: String
    whatsappNumber: String
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
    whatsappNumber: String
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

  input PlatformUserInput {
    email: String!
    password: String!
    firstName: String!
    lastName: String!
    role: PlatformUserRole
    profile: PlatformUserProfileInput
  }

  type PlatformAuthResponse {
    success: Boolean!
    message: String!
    token: String
    refreshToken: String
    user: PlatformUser
    requiresEmailVerification: Boolean
    requiresPhoneVerification: Boolean
  }


type User {
    id: ID!
    email: String!
    firstName: String
    lastName: String
    createdAt: String!
    updatedAt: String
    roles: [Role!]!
    permissions: [Permission!]!
}
  # Auth Queries
 type Query {
    me: User
    verifyAdminToken: TokenVerificationResponse!
  }

   enum OTPType {
    LOGIN_2FA
    PASSWORD_RESET
    EMAIL_VERIFICATION
    ACCOUNT_RECOVERY
  }
    input VerifyOTPInput {
    email: String!
    otp: String!
    type: OTPType!
    deviceId: String
    ipAddress: String
  }

  input ResendOTPInput {
    email: String!
    type: OTPType!
    ipAddress: String
  }
    input RefreshTokenInput {
    refreshToken: String!
    deviceId: String
    ipAddress: String
  }
  
  type VerifyOTPResponse {
    success: Boolean!
    message: String!
    token: String
    refreshToken: String
    admin: User
  }
   type RefreshTokenResponse {
    success: Boolean!
    token: String
    refreshToken: String
  }
type ResendOTPResponse {
    success: Boolean!
    message: String!
  }

  # Auth Mutations
   type Mutation {
    adminLogin(input: AdminLoginInput!): AuthResponse!
    adminCreateUser(input: PlatformUserInput!): PlatformAuthResponse!
     #update platform user with id
    UpdatePlatformUser(userId: ID! profiledata: ProfileDataInput): PlatformUser!
    verifyAdminOTP(input: VerifyOTPInput!): AuthResponse!
    adminLogout(token: String!): AuthResponse!
    verifyOTP(input: VerifyOTPInput!): VerifyOTPResponse!
    resendOTP(input: ResendOTPInput!): ResendOTPResponse!
    refreshToken(input: RefreshTokenInput!): RefreshTokenResponse!
  }
`;
