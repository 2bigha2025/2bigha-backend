

// import { callStatusTypeEnum } from "../../database/schema/crm-model";

export const crmTypeDefs = `#graphql

type Lead{
    Id:ID!
    leadSource: String
    leadType: String
    clientId: ID
    clientName: String
    createdBy:ID!
    createdByName:String
    createdAt:Date!
    email: String
    phone: String
    whatsappNumber: String
    address: String
    propertyCount: Int
    lastCallAt:Date
    callStatus:String
    groupName:String
    adminNumber:String
}

type LeadData{
    Id:ID!
    leadSource: String
    leadType: String
    clientId: ID
    clientName: String
    createdBy:ID!
    createdByName:String
    createdAt:Date!
    groupName:String
}

input CreateLeadInput {
    leadSource : String
    leadType : String
    clientId : ID!
    groupId : ID
}

input UpdateLeadInput {
    leadSource : String
    leadType : String
    groupId : ID
}

input LeadIdInput {
    Id: ID!
    clientId : ID!
}


type CreateLeadResponse{
    result: LeadData
    message: String
    STATUS_CODES: Int
}

type LeadResponse{
    result: [Lead]
    message: String
    STATUS_CODES: Int
}

input CreateCallPropertyInput {
    property : CreatePropertyInput
    lead : LeadIdInput
    propertyMetaData : PropertyMetaInput
    callLogs : CreateCallInput
}


type PropertyMeta{
     Id:ID
     propertyId:ID
     leadId:ID!
     groupId:ID
     assignedTo:ID
     assignedBy:ID!
}

input CreateCallInput{
    leadId:ID!
    feedback: String
    followUp: Date
    clientId: ID!
    AgentId: ID!
}

input PropertyMetaInput{
    groupId:ID
    assignedTo:ID
}


type Broadcast{
    Id:ID!
    campaignName:String!
    connectionNumber:String!
    TemplateName:String!
    groupId: ID
    callStatus:String
    sentAt:Date!
    createdAt:Date!
    sentBy:ID!
    senderName:String
    groupName:String
}

input CreateBroadcastInput{
    campaignName:String!
    connectionNumber:String!
    TemplateName:String!
    groupId: ID
    callStatus:String
}

type CreateBroadcastResponse{
    result: Broadcast
    message: String
    STATUS_CODES: Int
}
type BroadcastResponse{
    result: [Broadcast]
    message: String
    STATUS_CODES: Int
}

type Group{
    Id:ID!
    groupName: String!
    groupIcon: String
    isAvailable: Boolean!
    createdAt: Date!
    createdBy:ID!
    createdByName:String
}

input CreateGroupInput{
    groupName: String!
    groupIcon: String
}

input CreateGroupActiveInput{
    isAvailable: Boolean 
}

type GroupResponse {
    result: [Group]
    message: String
    STATUS_CODES: Int
}

type CreateGroupResponse {
    result: Group
    message: String
    STATUS_CODES: Int
}


type CallLogs{
    Id:ID!
    leadId:ID!
    propertyId:String
    status:String
    clientId:ID!
    AgentId:ID!
    duration:String
    recordingUrl:String
    callType:String
    disconnectedBy:String
    feedback: String
    followUp: Date
    createdAt: Date!
    clientName:String
    clientNumber:String
    agentName:String
    agentNumber:String
}

type CallLogesResponse{
    result:[CallLogs]
    message:String!
    STATUS_CODES: Int!
}

type Notes{
    Id: ID!
    propertyId: ID!
    note: String
    createdAt: Date!
    createdBy:ID!
}

type Template{
    Id:ID!
    name:String!
    category:String
    status:String
    language:String
    createdBy:ID!
    createdAt:Date!
    updatedAt:Date!
}

type ResponseMessage{
    message:String!
    STATUS_CODES:Int!
}

extend type Query {
    # getLeadById(id: ID!): Lead
    getAllLead: LeadResponse

    getAllGroup: GroupResponse
    getGroupById(id:ID!):CreateGroupResponse

    getAllBroadcasts: BroadcastResponse
    getBroadcastById(id:ID!):CreateBroadcastResponse

    getAllCallLogs: CallLogesResponse

}

  extend type Mutation {
    createLead(input: CreateLeadInput!): CreateLeadResponse!
    createLeadProperty(input: CreateCallPropertyInput!): ResponseMessage
    updateLead(id: ID!, input: UpdateLeadInput!): ResponseMessage!
    
    createGroup(input: CreateGroupInput):CreateGroupResponse
    updateGroup(id: ID!, input: CreateGroupInput!): CreateGroupResponse!
    updateActiveGroup(id: ID!, input: CreateGroupActiveInput!): ResponseMessage!
    deleteGroup(id: ID!): ResponseMessage

    createBroadcast(input: CreateBroadcastInput):CreateBroadcastResponse
    updateBroadcast(id: ID!, input: CreateBroadcastInput!): CreateBroadcastResponse!
    deleteBroadcast(id: ID!): ResponseMessage
  }
`;
