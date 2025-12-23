import { eq, sql, desc, getTableColumns, or, inArray, and, asc } from "drizzle-orm"
import { db } from "../../database/connection"
import * as schema from "../../database/schema/index";
import { template, broadcast, propertyGroups, lead, callLogs, campaign, chatThread, chatMessage } from "../../database/schema/crm-model";
import { adminUsers } from "../../database/schema/admin-user";
import whatsAppInstance from '../../axios-instances/whatsApp'
import { alias } from "drizzle-orm/pg-core";
// import { io } from "socket.io"
export class CrmWhatsAppService {

    // Template
    static async getAllTemplate() {
        const result = await db.select({
            ...getTableColumns(template),
            createdByName: sql`${adminUsers.firstName} || ' ' || ${adminUsers.lastName}`.as("createdByName"),
        }).from(template).leftJoin(adminUsers, eq(template.createdBy, adminUsers.id)).orderBy(desc(template.createdAt))
        return {
            result,
            message: "Template fetched successfully",
            STATUS_CODES: 200
        }
    }

    static async createTemplate(input: any, adminId: string) {
        const { name, language, category, headerFormat, header, body, footer, buttonType, buttons } = input;

        const payload: any = {
            "display_name": name,
            "language": language,
            "category": category,
            "header_format": headerFormat != "" ? headerFormat : null,
            "body": body,
            "body_text": [],
            "footer": footer != "" ? footer : null,
        }
        if (headerFormat == "TEXT" && buttonType == "") {
            payload.header = header ?? null,
                payload.header_text = []

        } else if (headerFormat == "TEXT" && buttonType == "Call To Action") {
            payload.header = header ?? null,
                payload.header_text = [],
                payload.button_type = buttonType;
            payload.buttons = buttons;
        }
        // else if (headerFormat == "IMAGE") {
        //     payload.header_format = "IMAGE",
        //     payload.header_handle = [
        //         "4::aW1hZ2UvanBlZw==:ARYc0PN9LuVNHyB_WHg9BOSpSZJcmvW4E2aEOwVKNiyR8IeKMmz9zEq_JhruDTRpHOJpye1XOLxnQuf2Iub5wUrbFLV8tEf_poHCm268UGIsOg:e:1708954652:1100908887049211:100052252050649:ARYMlozSCkupSHItxZU"
        //     ],
        //     payload.header_handle_file_url = "https://interaktprodstorage.blob.core.windows.net/mediaprodstoragecontainer/ba4308f1-a506-44d2-a8c3-17380216cf91/message_template_media/cpMI1F1pUP3S/interakt.jpg?se=2029-02-15T13%3A37%3A30Z&sp=rt&sv=2019-12-12&sr=b&sig=WdDxJ5mB%2BgjBULx92%2B6UnGbGr6S00loWQYoqqdQmWtk%3D",
        //     payload.header_handle_file_name = "interakt.jpg"
        // }

        const data = await whatsAppInstance.post("/track/templates/", payload) as { data?: any };

        const templateData = data.data ?? null;
        const result = await db.insert(template).values({
            Id: templateData.id,
            name,
            language,
            category,
            headerFormat,
            header,
            body,
            footer,
            buttonType,
            buttons,
            status: templateData.approval_status,
            waTemplateId: templateData.wa_template_id,
            createdAt: new Date(templateData.created_at_utc),
            createdBy: adminId,
        }).returning();

        const [creator] = await db.select({
            firstName: adminUsers.firstName,
            lastName: adminUsers.lastName,
        }).from(adminUsers).where(eq(adminUsers.id, adminId));

        return {
            result: {
                ...result[0],
                createdByName: creator
                    ? `${creator.firstName} ${creator.lastName}`
                    : null,
            },
            message: templateData.message,
            STATUS_CODES: 201
        }
    }

    static async syncTemplate() {

        const data = await whatsAppInstance.get(
            "/track/organization/templates?offset=0&autosubmitted_for=all&approval_status=APPROVED&variable_present=No&language=all"
        ) as { results?: { templates?: any[] } };

        const templateData = data.results?.templates || [];
        if (templateData.length === 0) {
            return {
                message: "No Template is available",
                STATUS_CODES: 200
            };
        }

        // Collect current Interakt IDs
        const interaktIds = templateData.map(t => t.id);

        // Fetch all existing DB template IDs
        const dbTemplates = await db.select({ Id: template.Id }).from(template);
        const dbIds = dbTemplates.map(t => t.Id);

        // Find templates that should be deleted
        const idsToDelete = dbIds.filter(id => !interaktIds.includes(id));

        if (idsToDelete.length > 0) {
            await db.delete(template).where(inArray(template.Id, idsToDelete));
        }


        // Prepare insert payload
        const rows = templateData.map(template => ({
            Id: template.id,
            name: template.name,
            language: template.language == 'en' ? "English" : "",
            category: template.category,
            headerFormat: template.header_format,
            header: template.header,
            body: template.body,
            footer: template.footer,
            buttonType: template.buttons ? "Call To Action" : null,
            buttons: JSON.parse(template.buttons),
            status: template.approval_status,
            waTemplateId: template.wa_template_id,
            variablePresent: template.variable_present,
            createdAt: new Date(template.created_at_utc),
        }));

        // Perform UPSERT (insert or update)
        const result = await db
            .insert(template)
            .values(rows)
            .onConflictDoUpdate({
                target: template.Id,
                set: {
                    name: sql`EXCLUDED.name`,
                    category: sql`EXCLUDED.category`,
                    language: sql`EXCLUDED.language`,
                    header: sql`EXCLUDED.header`,
                    headerFormat: sql`EXCLUDED.header_format`,
                    body: sql`EXCLUDED.body`,
                    footer: sql`EXCLUDED.footer`,
                    buttons: sql`EXCLUDED.buttons`,
                    variablePresent: sql`EXCLUDED.variable_present`,
                    status: sql`EXCLUDED.status`,
                    updatedAt: new Date(),
                },
            }).returning();

        return {
            result: result,
            deleted: idsToDelete.length,
            message: "",
            STATUS_CODES: 200
        }
    }


    // Broadcasts CRUD Operations
    static async getAllBroadcasts() {
        const sender = alias(adminUsers, "sender");
        const creator = alias(adminUsers, "creator");

        const result = await db.select({
            ...getTableColumns(broadcast),

            groupName: propertyGroups.groupName,

            senderName: sql`${sender.firstName} || ' ' || ${sender.lastName}`.as("senderName"),
            createdByName: sql`${creator.firstName} || ' ' || ${creator.lastName}`.as("createdByName"),

            campaignName: campaign.campaignName,
            templateId: campaign.templateId,
            TemplateName: campaign.TemplateName,
            campaignCreatedAt: campaign.createdAt,
        })
            .from(broadcast).leftJoin(campaign, eq(broadcast.campaignId, campaign.Id))
            .leftJoin(propertyGroups, eq(broadcast.groupId, propertyGroups.Id))
            .leftJoin(sender, eq(broadcast.sentBy, sender.id))
            .leftJoin(creator, eq(campaign.createdBy, creator.id))
            .orderBy(desc(campaign.createdAt));

        const campaignsData = this.getAllCampaign();
        const campaigns = (await campaignsData).result;

        return {
            result,
            campaigns,
            message: "Broadcast fetched successfully",
            STATUS_CODES: 200
        }
    }

    static async getAllCampaign() {
        const result = await db.select({
            ...getTableColumns(campaign),
            createdByName: sql`${adminUsers.firstName} || ' ' || ${adminUsers.lastName}`.as("createdByName"),
        }).from(campaign).leftJoin(adminUsers, eq(campaign.createdBy, adminUsers.id))
            .orderBy(desc(campaign.createdAt));

        return {
            result,
            message: "Broadcast fetched successfully",
            STATUS_CODES: 200
        }
    }

    static async getBroadcastById(id: any) {
        const result = await db.select({
            ...getTableColumns(broadcast),
            groupName: propertyGroups.groupName,
            senderName: sql`${adminUsers.firstName} || ' ' || ${adminUsers.lastName}`.as("senderName"),
        }).from(broadcast).where(eq(propertyGroups.Id, id)).leftJoin(propertyGroups, eq(broadcast.groupId, propertyGroups.Id))
            .leftJoin(adminUsers, eq(broadcast.sentBy, adminUsers.id));

        return {
            result: result[0],
            message: "Specific Broadcast fetched successfully",
            STATUS_CODES: 200
        }
    }


    static async createCampaign(input: any, adminId: string) {
        const { campaignName, TemplateName, templateId } = input;

        // 1. Create campaign
        const campaignPayload: any = {
            campaign_name: campaignName,
            campaign_type: "PublicAPI",
            template_name: TemplateName,
            language_code: "en"
        }
        const campaignData = await whatsAppInstance.post("/create-campaign/", campaignPayload) as { data?: any };

        const campaignId = campaignData.data.campaign_id;

        const result = await db.insert(campaign).values({
            Id: campaignId,
            campaignName: campaignName,
            templateId: templateId || null,
            TemplateName: TemplateName,
            createdBy: adminId,
        }).returning();

        const [creator] = await db.select({
            firstName: adminUsers.firstName,
            lastName: adminUsers.lastName,
        }).from(adminUsers).where(eq(adminUsers.id, adminId));

        return {
            result: {
                ...result[0],
                createdByName: creator
                    ? `${creator.firstName} ${creator.lastName}`
                    : null,
            },
            message: "Campaign created successfully",
            STATUS_CODES: 201
        }
    }

    static async sendBroadcastMessage(input: any, adminId: string) {
        const { TemplateName, campaignId, phoneNumbers, groupId, callStatus } = input;
        // 2. Prepare chunking
        const CHUNK_SIZE = 50; // 50 at a time (YOU CAN CHANGE THIS)
        const DELAY_BETWEEN_CHUNKS = 500; // 0.5 sec delay to avoid rate limit

        const chunks = CrmWhatsAppService.chunkArray(phoneNumbers, CHUNK_SIZE);

        console.log(`Sending ${phoneNumbers.length} messages in ${chunks.length} chunks...`);

        // 3. Process chunks safely
        for (const chunk of chunks) {
            await Promise.allSettled(
                chunk.map((phoneNumber: any) =>
                    CrmWhatsAppService.sendTemplateApi({
                        phoneNumber: CrmWhatsAppService.normalizePhone(phoneNumber),
                        TemplateName,
                        campaignId
                    })
                )
            );
            // Delay between chunks (rate limit protection)
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));
        }

        // 3. Save broadcast

        const result = await db.insert(broadcast).values({
            campaignId,
            phoneNumbers,
            groupId: groupId || null,
            callStatus: callStatus || null,
            sentBy: adminId,
        }).returning();

        // 4. Add extra fields
        const [senderName] = await db.select({
            firstName: adminUsers.firstName,
            lastName: adminUsers.lastName,
        }).from(adminUsers).where(eq(adminUsers.id, adminId));

        let groupName = null;
        if (groupId) {
            const [groupData] = await db.select({
                groupName: propertyGroups.groupName,
            }).from(propertyGroups).where(eq(propertyGroups.Id, groupId));
            groupName = groupData.groupName;
        }

        return {
            result: {
                ...result[0],
                senderName: senderName
                    ? `${senderName.firstName} ${senderName.lastName}`
                    : null,
                groupName: groupName,
            },
            message: "Broadcast send successfully",
            STATUS_CODES: 201
        }
    }

    static chunkArray(arr: any, size: any) {
        const result = [];
        for (let i = 0; i < arr.length; i += size) {
            result.push(arr.slice(i, i + size));
        }
        return result;
    }

    static normalizePhone(num: any) {
        if (!num) return null;

        let phone = num.toString().trim();

        // Clean spaces and hyphens
        phone = phone.replace(/[\s-]/g, "");

        // Already has +91 → return
        if (phone.startsWith("+91")) return phone;

        // If starts with 91 but **length is 12** → it's missing "+"
        if (phone.startsWith("91") && phone.length === 12) {
            return `+${phone}`;
        }

        // If starts with 91 but **length is 10**, treat as plain mobile
        if (phone.startsWith("91") && phone.length === 10) {
            return `+91${phone}`;
        }

        // If starts with 0 → remove leading zero
        if (phone.startsWith("0")) phone = phone.substring(1);

        // If 10-digit number → add +91
        if (phone.length === 10) {
            return `+91${phone}`;
        }

        // Default fallback
        return `+91${phone}`;
    };

    static async sendTemplateApi(input: any) {
        const { phoneNumber, TemplateName, campaignId = null } = input;

        const templatePayload: any = {
            countryCode: "",
            phoneNumber: "",
            fullPhoneNumber: phoneNumber,
            campaignId: campaignId,
            callbackData: "",
            type: "Template",
            template: {
                name: TemplateName,
                languageCode: "en"
            }
        }
        try {
            const templateData = await whatsAppInstance.post("/message/", templatePayload) as { result?: any, message?: string, id?: string };
            return templateData;
        } catch (err: any) {
            console.error("sendTemplate error:", err.response?.data || err.message);
            return { result: false, message: "error in sending message" };
        }
    }

    // whatsApp chat service

    static async getWhatsAppThreadChat(agentDetail: any) {
        let result = null;

        // return threads with last message and lead info
        if (agentDetail.roles.includes("super_admin")) {
            result = await db.select({
                ...getTableColumns(chatThread),
                clientName: sql`${schema.platformUsers.firstName} || ' ' || ${schema.platformUsers.lastName}`.as("clientName"),
                clientPhone: schema.platformUserProfiles.whatsappNumber,
            }).from(chatThread).leftJoin(lead, eq(chatThread.leadId, lead.Id))
                .leftJoin(schema.platformUsers, eq(lead.clientId, schema.platformUsers.id))
                .leftJoin(schema.platformUserProfiles, eq(schema.platformUsers.id, schema.platformUserProfiles.userId))
                .orderBy(desc(chatThread.lastMessageAt));
        } else {
            result = await db.select({
                ...getTableColumns(chatThread),
                clientName: sql`${schema.platformUsers.firstName} || ' ' || ${schema.platformUsers.lastName}`.as("clientName"),
                clientPhone: schema.platformUserProfiles.whatsappNumber,
            }).from(chatThread).leftJoin(lead, eq(chatThread.leadId, lead.Id))
                .leftJoin(schema.platformUsers, eq(lead.clientId, schema.platformUsers.id))
                .leftJoin(schema.platformUserProfiles, eq(schema.platformUsers.id, schema.platformUserProfiles.userId)).where(
                    eq(chatThread.createdBy, agentDetail.adminId)
                )
                .orderBy(desc(chatThread.lastMessageAt));
        }

        return {
            result,
            message: "WhatsApp Threads fetched successfully",
            STATUS_CODES: 200
        };
    }

    static async getWhatsAppMessages(threadId: string) {
        const result = await db.select({
            ...getTableColumns(chatMessage),
            createdByName: sql`${adminUsers.firstName} || ' ' || ${adminUsers.lastName}`.as("createdByName")
        }).from(chatMessage).leftJoin(adminUsers, eq(chatMessage.createdBy, adminUsers.id)).where(eq(chatMessage.threadId, threadId))
            .orderBy(asc(chatMessage.createdAt));

        return {
            result,
            message: "WhatsApp Messages fetched successfully",
            STATUS_CODES: 200
        };
    }


    static async sendTemplateMessage(input: any, adminId: any) {
        const { phoneNumber, templateName, leadId, templateBody, meta } = input;

        const response = await CrmWhatsAppService.sendTemplateApi({ phoneNumber, TemplateName: templateName });

        let [templateSendAlready] = await db.select().from(chatThread).where(eq(chatThread.leadId, leadId));
        let result = null;
        if (!templateSendAlready) {
            result = await db.insert(chatThread).values({
                leadId: leadId,
                lastMessage: templateBody.slice(0, 30), // limit to 1000 chars
                lastMessageAt: new Date(),
                createdBy: adminId,
            }).returning();
        } {
            // update last message
            await db.update(chatThread).set({
                lastMessage: templateBody.slice(0, 30),
                lastMessageAt: new Date(),
            }).where(eq(chatThread.Id, templateSendAlready.Id));
        }

        result = templateSendAlready || result;
        // insert DB message
        await db.insert(chatMessage).values({
            threadId: result.Id,
            leadId: leadId,
            direction: "outgoing",
            msgType: "text",
            message: templateBody,
            interaktMessageId: response.id,
            meta: meta || null,
            createdBy: adminId,
        })

        return {
            message: "Template Message sent successfully",
            STATUS_CODES: 200
        };
    }

    static async sendTextMessage(input: any, adminId: any) {
        const { threadId, message, phoneNumber } = input;
        let savedMessage = null;

        // get thread to fetch leadId
        const [thread] = await db.select().from(chatThread).where(eq(chatThread.Id, threadId));
        if (!thread) return { result: thread, message: "Send the template first from the lead", STATUS_CODES: 400 };


        // send via interakt
        const sendResp = await CrmWhatsAppService.sendTextApi({
            phoneNumber,
            message,
        });

        if (sendResp?.messageId) {

            // update thread last message
            await db.update(chatThread).set({
                lastMessage: message.slice(0, 30),
                lastMessageAt: new Date(),
            }).where(eq(chatThread.Id, threadId));

            // insert DB message
            [savedMessage] = await db.insert(chatMessage).values({
                threadId,
                leadId: thread.leadId,
                direction: "outgoing",
                msgType: "text",
                message: message,
                interaktMessageId: sendResp.messageId,
                createdBy: adminId,
            }).returning()


       
        } else {
            return sendResp;
        }
        const [createdByName] = await db.select({
            firstName: adminUsers.firstName,
            lastName: adminUsers.lastName,
        }).from(adminUsers).where(eq(adminUsers.id, adminId));

        return {
            result: {
                ...savedMessage,
                createdByName: createdByName
                    ? `${createdByName.firstName} ${createdByName.lastName}`
                    : "",
            },
            message: "Message queued for sending via CRM",
            STATUS_CODES: 200
        };

    }

    static async sendTextApi(input: any) {
        const { phoneNumber, message } = input;
        try {
            const textPayload: any = {
                "userId": "",
                "fullPhoneNumber": CrmWhatsAppService.normalizePhone(phoneNumber),
                "callbackData": "",
                "type": "Text",
                "data": {
                    "message": message
                }
            }
            const textData = await whatsAppInstance.post("/message/", textPayload) as { result?: any, message?: string, id: string };
            console.log("sendText response:", textData);
            return {
                result: textData.result,
                message: textData.message,
                messageId: textData.id
            };
        } catch (err: any) {
            console.error("sendText error:", err.response?.data || err.message);
            return { result: false, message: err.message, messageId: null };
        }
    }


    // Callback service

    static async handleMessageReceived(payload: any) {
        const { type, entity, userPhoneNumber } = payload;

        let threadDetail = null;
        let leadId = null;

        const leadResult = await db.select({ Id: schema.platformUserProfiles.userId }).from(schema.platformUserProfiles).where(eq(schema.platformUserProfiles.phone, userPhoneNumber));
        leadId = leadResult[0]?.Id;
        [threadDetail] = await db.select({ Id: chatThread.Id,createdBy:chatThread.createdBy }).from(chatThread).where(eq(chatThread.leadId, leadId));


        // Save to DB (Prisma Example)
        // await db.insert(chatMessage).values({
        //     threadId: threadDetail.Id,
        //     leadId: leadId,
        //     direction: "incoming",
        //     msgType: type.toLowerCase(),
        //     message: entity.text,
        //     interaktMessageId: entity.messageId,
        //     createdAt: entity.sendTime,
        //     createdBy: threadDetail.createdBy,
        //     // userFile:entity.userFile,
        //     // location:entity.location
        // });
    }

}

