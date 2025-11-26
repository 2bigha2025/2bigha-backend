// # src/graphql/types/ivr.ts

export const ivrTypeDefs = `#graphql

type KommunoResponse {
  success: Boolean!
  sessionId: String
  message: String
  data: JSON
}

input KommunoCallInput {
    clientId: ID!
    leadId: ID!
    customerNumber: String!
    agentNumber: String!
}

extend type Mutation {
  makeKommunoCall(input: KommunoCallInput!): KommunoResponse
}

`