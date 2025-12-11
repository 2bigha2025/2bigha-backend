export const crmWhatsAppTypeDefs = `#graphql

# Template
type Template{
    Id:ID
    name: String
    language: String
    category: String
    headerFormat: String
    header: String
    body: String
    footer: String
    buttonType: String
    buttons: JSON
    status: String
    waTemplateId: String
    variablePresent: String
    createdBy: ID
    createdByName: String
    createdAt: Date
    updatedAt: Date
}

type TemplateResponse{
    result: [Template]
    deleted: Int
    message:String
    STATUS_CODES:Int
}

input CreateTemplateInput{
    name:String
    language:String
    category:String
    headerFormat:String
    header:String
    body:String
    footer:String
    buttonType:String
    buttons:JSON
}

type CreateTemplateResponse{
    result: Template
    message:String
    STATUS_CODES:Int
}


# Broadcast
type Campaign{
    Id:ID
    campaignName:String
    templateId:ID
    TemplateName:String
    createdBy:ID
    createdByName:String
    createdAt:Date
}

type Broadcast{
    Id:ID
    campaignId:ID
    campaignName:String
    phoneNumbers:JSON
    templateId:ID
    TemplateName:String
    groupId: ID
    callStatus:String
    sentAt:Date
    createdAt:Date
    sentBy:ID
    senderName:String
    createdByName:String
    groupName:String
}


input CreateBroadcastInput{
    templateId:ID
    TemplateName:String!
    campaignId:ID!
    phoneNumbers:JSON
    groupId: ID
    callStatus:String
}

input CreateCampaignInput{
    templateId:ID
    campaignName:String!
    TemplateName:String!
}

type CreateBroadcastResponse{
    result: Broadcast
    message: String
    STATUS_CODES: Int
}
type BroadcastResponse{
    result: [Broadcast]
    campaigns: [Campaign]
    message: String
    STATUS_CODES: Int
}
type CampaignResponse{
    result: [Campaign]
    message: String
    STATUS_CODES: Int
}

type ResponseMessage {
    message: String
    STATUS_CODES: Int
}

# WhatsApp Chat
input SendTemplateInput{
    phoneNumber:String
    templateName:String
    leadId:ID
    templateBody:String
    meta: JSON
}

type WhatsAppThread{
    Id:ID
    leadId:ID
    lastMessage:String
    lastMessageAt:Date
    unread:Int
    clientPhone:String
    clientName:String
    createdAt:Date
}

type WhatsAppThreadResponse{
    result: [WhatsAppThread]
    message:String
    STATUS_CODES:Int
}

type WhatsAppMessage{
    Id: String
    threadId: String
    leadId: String
    direction: String
    msgType: String
    message: String
    meta: JSON
    createdBy: String
    createdAt: Date
    createdByName: String
}

type WhatsAppMessageResponse{
    result:[WhatsAppMessage]
    message:String
    STATUS_CODES:Int
}

input SendTextInput{
    threadId:ID
    phoneNumber:String
    message:String
}


type SendTextMessageResponse{
    result:WhatsAppMessage
    message:String
    STATUS_CODES:Int
}

extend type Query {
    getAllTemplate: TemplateResponse

    getAllBroadcasts: BroadcastResponse
    getAllCampaign: CampaignResponse
    getBroadcastById(id:ID!):CreateBroadcastResponse

    getWhatsAppThreadChat: WhatsAppThreadResponse
    getWhatsAppMessages(threadId:ID!): WhatsAppMessageResponse
}

extend type Mutation{
    createTemplate(input: CreateTemplateInput): CreateTemplateResponse
    syncTemplate: TemplateResponse

    createCampaign(input: CreateCampaignInput):CreateBroadcastResponse
    sendBroadcast(input: CreateBroadcastInput): CreateBroadcastResponse

    sendTemplateMessage(input: SendTemplateInput): ResponseMessage
    sendTextMessage(input: SendTextInput): SendTextMessageResponse
}
`;