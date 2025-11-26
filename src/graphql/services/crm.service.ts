import { eq, and, sql, desc, getTableColumns, between, inArray } from "drizzle-orm"
import { db } from "../../database/connection"
import * as schema from "../../database/schema/index";
import { PropertyService } from "./property.services";
import { propertyMeta, lead, callLogs, propertyGroups, broadcast } from "../../database/schema/crm-model";
import { adminUsers } from "../../database/schema/admin-user";

export class CrmService {

    // Leads CRUD Operations
    static async createLead(input: any, adminId: string) {
        const { leadSource, leadType, clientId, groupId } = input;
        const leadResult = await db.insert(lead).values({
            leadSource: leadSource,
            leadType: leadType,
            clientId: clientId,
            createdBy: adminId,
            groupId: groupId,
        }).returning();

        const [creator] = await db.select({
            adminFirstName: adminUsers.firstName,
            adminLastName: adminUsers.lastName,
            clientFirstName: schema.platformUsers.firstName,
            clientLastName: schema.platformUsers.lastName,
            groupName: propertyGroups.groupName,
        }).from(adminUsers).where(eq(adminUsers.id, adminId)).leftJoin(schema.platformUsers, sql`${schema.platformUsers.id} = ${leadResult[0]?.clientId}`).leftJoin(propertyGroups, sql`${propertyGroups.Id} = ${leadResult[0]?.groupId}`);

        return {
            result: {
                ...leadResult[0],
                createdByName: creator
                    ? `${creator.adminFirstName} ${creator.adminLastName}` : null,
                clientName: creator
                    ? `${creator.clientFirstName} ${creator.clientLastName}`
                    : null,
                groupName: creator? creator.groupName:null
            },
            message: "Lead fetched successfully",
            STATUS_CODES: 200
        };
    }

     static async updateLead(id: any, input: any) {
        const { leadSource, leadType, groupId } = input;
        await db.update(lead).set({
            leadSource: leadSource,
            leadType: leadType,
            groupId: groupId,
        }).where(eq(lead.Id, id))

        return {
            message: "Lead updated successfully",
            STATUS_CODES: 200
        }
    }

    static async createLeadProperty(input: any, adminId: string) {
        const { lead, property, propertyMetaData, callLogs } = input;

        //  PropResult: any = {};
        let propResult = await PropertyService.createProperty(property, adminId, "draft");

        const metaResult = await db.insert(propertyMeta).values({
            propertyId: propResult?.id ?? null,
            leadId: lead.Id,
            groupId: propertyMetaData?.groupId ?? null,
            assignedTo: propertyMetaData?.assignedTo ?? null,
            assignedBy: adminId,
        })

        const callStatus = await db.insert(callLogs).values({
            leadId: lead.Id,
            feedback: callLogs.feedback,
            followUp: callLogs.followUp,
            clientId: lead.clientId,
            AgentId: adminId,
        })

        return {
            message: "Group fetched successfully",
            STATUS_CODES: 200
        };

    }

    static async getAllLeads() {

        const result = await db.select({
            ...getTableColumns(lead),
            clientName: sql`${schema.platformUsers.firstName} || ' ' || ${schema.platformUsers.lastName}`.as("clientName"),
            createdByName: sql`${adminUsers.firstName} || ' ' || ${adminUsers.lastName}`.as("createdByName"),
            adminNumber: adminUsers.phone,
            email: schema.platformUsers.email,
            phone: schema.platformUserProfiles.phone,
            whatsappNumber: schema.platformUserProfiles.whatsappNumber,
            groupName: propertyGroups.groupName,
            address: sql`
                    COALESCE(${schema.platformUserProfiles.address}, '') || ' ' ||
                    COALESCE(${schema.platformUserProfiles.city}, '') || ' ' ||
                    COALESCE(${schema.platformUserProfiles.state}, '') || ' ' ||
                    COALESCE(${schema.platformUserProfiles.country}, '') || ' ' ||
                    COALESCE(${schema.platformUserProfiles.pincode}, '')
                    `.as("address"),
            propertyCount: sql`
                    (
                      SELECT COUNT(*) 
                      FROM ${propertyMeta} 
                      WHERE ${propertyMeta.leadId} = ${lead.Id}
                    )
                    `.as("propertyCount"),
            lastCallAt: sql`
                    (
                      SELECT MAX(${callLogs.createdAt}) 
                      FROM ${callLogs}
                        WHERE ${callLogs.leadId} = ${lead.Id}
                    )
                    `.as("lastCallAt"),
            callStatus: sql`
                    (
                      SELECT ${callLogs.status} 
                      FROM ${callLogs}
                        WHERE ${callLogs.leadId} = ${lead.Id}
                      ORDER BY ${callLogs.createdAt} DESC
                      LIMIT 1
                    )
                    `.as("callStatus"),
        }).from(lead).leftJoin(adminUsers, eq(lead.createdBy, adminUsers.id)).leftJoin(schema.platformUsers, eq(lead.clientId, schema.platformUsers.id)).leftJoin(schema.platformUserProfiles, eq(lead.clientId, schema.platformUserProfiles.userId)).leftJoin(propertyGroups, eq(lead.groupId, propertyGroups.Id))
            .orderBy(desc(lead.createdAt))

        return {
            result,
            message: "Lead fetched successfully",
            STATUS_CODES: 200
        }
    };


    // Groups CRUD Operations
    static async getAllGroup() {
        const result = await db.select({
            ...getTableColumns(propertyGroups),
            createdByName: sql`${adminUsers.firstName} || ' ' || ${adminUsers.lastName}`.as("createdByName"),
        }).from(propertyGroups).leftJoin(adminUsers, eq(propertyGroups.createdBy, adminUsers.id)).orderBy(desc(propertyGroups.createdAt))
        return {
            result,
            message: "Group fetched successfully",
            STATUS_CODES: 200
        }
    }

    static async getGroupById(id: any) {
        const result = await db.select({
            ...getTableColumns(propertyGroups),
            createdByName: sql`${adminUsers.firstName} || ' ' || ${adminUsers.lastName}`.as("createdByName"),
        }).from(propertyGroups).leftJoin(adminUsers, eq(propertyGroups.createdBy, adminUsers.id)).where(eq(propertyGroups.Id, id));
        return {
            result: result[0],
            message: "Specific Group fetched successfully",
            STATUS_CODES: 200
        }
    }

    static async createGroup(input: any, adminId: string) {
        const { groupName, groupIcon, isAvailable } = input;
        const result = await db.insert(propertyGroups).values({
            groupName: groupName,
            groupIcon,
            isAvailable,
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
            message: "Group created successfully",
            STATUS_CODES: 201
        }
    }

    static async updateGroup(id: any, input: any) {
        const { groupName, groupIcon, isAvailable } = input;
        const result = await db.update(propertyGroups).set({
            groupName: groupName,
            groupIcon,
            isAvailable,
        }).where(eq(propertyGroups.Id, id))
            .returning();;
        return {
            result: result[0],
            message: "Group updated successfully",
            STATUS_CODES: 200
        }
    }

    static async updateActiveGroup(id: any, input: any) {
        const { isAvailable } = input;
        await db.update(propertyGroups).set({
            isAvailable,
        }).where(eq(propertyGroups.Id, id))

        return {
            message: "Group Status updated successfully",
            STATUS_CODES: 200
        }
    }

    static async deleteGroup(id: string) {
        await db.delete(propertyGroups).where(eq(propertyGroups.Id, id))
        return {
            message: "Group deleted successfully",
            STATUS_CODES: 200
        }
    }


    // Broadcasts CRUD Operations
    static async getAllBroadcasts() {
        const result = await db.select({
            ...getTableColumns(broadcast),
            groupName: propertyGroups.groupName,
            senderName: sql`${adminUsers.firstName} || ' ' || ${adminUsers.lastName}`.as("senderName"),
        }).from(broadcast).leftJoin(propertyGroups, eq(broadcast.groupId, propertyGroups.Id))
            .leftJoin(adminUsers, eq(broadcast.sentBy, adminUsers.id))
            .orderBy(desc(broadcast.createdAt));
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

    static async createBroadcast(input: any, adminId: string) {
        const { campaignName, connectionNumber, TemplateName, groupId, callStatus } = input;
        const result = await db.insert(broadcast).values({
            campaignName, connectionNumber, TemplateName, groupId, callStatus, sentBy: adminId,
        }).returning();

        const [senderName] = await db.select({
            firstName: adminUsers.firstName,
            lastName: adminUsers.lastName,
        }).from(adminUsers).where(eq(adminUsers.id, adminId));

        const [groupName] = await db.select({
            groupName: propertyGroups.groupName,
        }).from(propertyGroups).where(eq(propertyGroups.Id, groupId));

        return {
            result: {
                ...result[0],
                senderName: senderName
                    ? `${senderName.firstName} ${senderName.lastName}`
                    : null,
                groupName: groupName ? groupName.groupName : null,
            },
            message: "Broadcast created successfully",
            STATUS_CODES: 201
        }
    }

    static async updateBroadcast(id: any, input: any) {
        const { campaignName, connectionNumber, TemplateName, groupId, callStatus } = input;
        const result = await db.update(broadcast).set({
            campaignName, connectionNumber, TemplateName, groupId, callStatus,
        }).where(eq(broadcast.Id, id))
            .returning();;
        return {
            result: result[0],
            message: "Broadcast updated successfully",
            STATUS_CODES: 200
        }
    }

    static async deleteBroadcast(id: string) {
        await db.delete(broadcast).where(eq(broadcast.Id, id))
        return {
            message: "Broadcast deleted successfully",
            STATUS_CODES: 200
        }
    }


    // CallLogs CRUD Operations

    static async createCallLogs(input: any, adminId: string) {
        const { groupName, groupIcon, isAvailable } = input;
        const result = await db.insert(propertyGroups).values({
            groupName: groupName,
            groupIcon,
            isAvailable,
            createdBy: adminId,
        }).returning();
        return {
            result: result[0],
            message: "Group created successfully",
            STATUS_CODES: 201
        }
    }

    static async getAllCallLogs() {
        const result = await db.select({
            ...getTableColumns(callLogs),
            clientName: sql`${schema.platformUsers.firstName} || ' ' || ${schema.platformUsers.lastName}`.as("clientName"),
            clientNumber: schema.platformUserProfiles.phone,
            agentName: sql`${adminUsers.firstName} || ' ' || ${adminUsers.lastName}`.as("agentName"),
            agentNumber: adminUsers.phone,            
        }).from(callLogs).leftJoin(adminUsers, eq(callLogs.AgentId, adminUsers.id)).leftJoin(schema.platformUsers, eq(callLogs.clientId, schema.platformUsers.id)).leftJoin(schema.platformUserProfiles, eq(callLogs.clientId, schema.platformUserProfiles.userId))
            .orderBy(desc(callLogs.createdAt));
        return {
            result,
            message: "Call Logs fetched successfully",
            STATUS_CODES: 200
        }
    }

    // static async createCallLogs(input: any, adminId: string) {
    //     const { groupName, groupIcon, isAvailable } = input;
    //     const result = await db.insert(propertyGroups).values({
    //         groupName: groupName,
    //         groupIcon,
    //         isAvailable,
    //         createdBy: adminId,
    //     }).returning();
    //     return {
    //         result: result[0],
    //         message: "Group created successfully",
    //         STATUS_CODES: 201
    //     }
    // }
}
