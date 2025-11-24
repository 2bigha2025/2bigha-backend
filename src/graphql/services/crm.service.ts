import { GraphQLError } from "graphql"
import { eq, sql, desc, getTableColumns, or, inArray } from "drizzle-orm"
import { db } from "../../database/connection"
import * as schema from "../../database/schema/index";
import { PropertyService } from "./property.services";
import { propertyMeta, lead, callLogs, propertyGroups, broadcast } from "../../database/schema/crm-model";
import { adminUsers } from "../../database/schema/admin-user";
import _ from "lodash";

const CHUNK_SIZE = 1000;
export class CrmService {

    // Leads CRUD Operations
    static async createLead(input: any, adminId: string) {
        const { leadSource, leadType, clientId, groupId } = input;

        const existing = await db
            .select()
            .from(lead)
            .where(eq(lead.clientId, clientId));
        if (existing.length != 0) {
            throw new GraphQLError("Client Already Exist", {
                extensions: { code: "FORBIDDEN" },
            })
        }

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
                groupName: creator ? creator.groupName : null
            },
            message: "Lead created successfully",
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


    static async bulkImportLead(input: any[], adminId: string) {
        let inserted = 0;
        let duplicateRows: any[] = [];

        await db.transaction(async (tx) => {
            for (let i = 0; i < input.length; i += CHUNK_SIZE) {
                const chunk = input.slice(i, i + CHUNK_SIZE);

                // Dedupe inside file by email and phone
                const uniqueChunk1 = _.uniqBy(
                    chunk,
                    (row) => row.email?.trim() || crypto.randomUUID()
                );

                const uniqueChunk = _.uniqBy(
                    uniqueChunk1,
                    (row) => row.phone?.trim() || crypto.randomUUID()
                );

                // Extract emails & phones
                const emails = uniqueChunk.map(r => r.email).filter(Boolean);
                const phones = uniqueChunk.map(r => r.phone).filter(Boolean);

                // Fetch existing users
                const existingUsers = await tx
                    .select({
                        id: schema.platformUsers.id,
                        email: schema.platformUsers.email,
                        phone: schema.platformUserProfiles.phone
                    })
                    .from(schema.platformUsers)
                    .leftJoin(
                        schema.platformUserProfiles,
                        eq(schema.platformUsers.id, schema.platformUserProfiles.userId)
                    )
                    .where(
                        or(
                            inArray(schema.platformUsers.email, emails),
                            inArray(schema.platformUserProfiles.phone, phones)
                        )
                    );

                const existingUserMap = new Map();
                for (const u of existingUsers) {
                    existingUserMap.set(u.email ?? u.phone, u.id);
                }

                const userInsertData: any[] = [];
                const profileInsertData: any[] = [];
                const leadInsertData: any[] = [];

                for (const row of uniqueChunk) {
                    let userId: string | null = null;

                    // Try locating existing user by email or phone
                    if (row.email && existingUserMap.has(row.email)) {
                        userId = existingUserMap.get(row.email);
                    } else if (row.phone && existingUserMap.has(row.phone)) {
                        userId = existingUserMap.get(row.phone);
                    }

                    // If user DOES NOT exist → create new user
                    if (!userId) {
                        userId = crypto.randomUUID();

                        userInsertData.push({
                            id: userId,
                            firstName: row.firstName,
                            lastName: row.lastName,
                            role: row.role || "USER",
                            email: row.email || null,
                            createdByAdminId: adminId,
                        });

                        profileInsertData.push({
                            userId,
                            phone: row.phone || null,
                            whatsappNumber: row.whatsappNumber || null,
                            address: row.address || null,
                            city: row.city || null,
                            state: row.state || null,
                            country: row.country || null,
                            pincode: row.pincode || null,
                            website: row.website || null,
                        });
                    }

                    // STEP-2: Check if Lead Exists for this userId
                    const existingLeadRows = await tx
                        .select()
                        .from(lead)
                        .where(eq(lead.clientId, userId))
                    const existingLead = existingLeadRows[0];

                    if (existingLead) {
                        duplicateRows.push({
                            name: row.firstName,
                            email: row.email,
                            phone: row.phone,
                        });
                        continue;
                    }

                    // Insert new lead (existing or new user)
                    leadInsertData.push({
                        id: crypto.randomUUID(),
                        leadType: row.leadType,
                        leadSource: row.leadSource,
                        groupId: null,
                        clientId: userId,
                        createdBy: adminId,
                    });
                }

                // Insert new users
                if (userInsertData.length > 0) {
                    await tx.insert(schema.platformUsers).values(userInsertData);
                }

                // Insert user profiles
                if (profileInsertData.length > 0) {
                    await tx.insert(schema.platformUserProfiles).values(profileInsertData);
                }

                // Insert leads
                if (leadInsertData.length > 0) {
                    await tx.insert(lead).values(leadInsertData);
                    inserted += leadInsertData.length;
                }
            }
        });

        return {
            inserted,
            duplicatesInDB: duplicateRows.length,
            duplicateRows,
            duplicatesInFile: input.length - inserted,
            message: "Lead import completed",
            STATUS_CODES: 200
        };
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

    static async getAllLeads(agentDetail: any) {

        if (agentDetail.roles.includes("super_admin")) {
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
                          SELECT ${callLogs.createdAt} 
                          FROM ${callLogs}
                            WHERE ${callLogs.leadId} = ${lead.Id}
                          ORDER BY ${callLogs.createdAt} DESC
                          LIMIT 1
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
                feedback: sql`
                        (
                          SELECT ${callLogs.feedback} 
                          FROM ${callLogs}
                            WHERE ${callLogs.leadId} = ${lead.Id}
                          ORDER BY ${callLogs.createdAt} DESC
                          LIMIT 1
                        )
                        `.as("feedback"),
                followUp: sql`
                        (
                          SELECT ${callLogs.followUp} 
                          FROM ${callLogs}
                            WHERE ${callLogs.leadId} = ${lead.Id}
                          ORDER BY ${callLogs.createdAt} DESC
                          LIMIT 1
                        )
                        `.as("followUp"),
            }).from(lead).leftJoin(adminUsers, eq(lead.createdBy, adminUsers.id)).leftJoin(schema.platformUsers, eq(lead.clientId, schema.platformUsers.id)).leftJoin(schema.platformUserProfiles, eq(lead.clientId, schema.platformUserProfiles.userId)).leftJoin(propertyGroups, eq(lead.groupId, propertyGroups.Id))
                .orderBy(desc(lead.createdAt))

            return {
                result,
                message: "Lead fetched successfully",
                STATUS_CODES: 200
            }
        } else {
            return CrmService.getLeadById(agentDetail.adminId);
        }

    };

    static async getLeadById(id: any) {

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
        }).from(lead).leftJoin(adminUsers, eq(lead.createdBy, adminUsers.id)).leftJoin(schema.platformUsers, eq(lead.clientId, schema.platformUsers.id)).leftJoin(schema.platformUserProfiles, eq(lead.clientId, schema.platformUserProfiles.userId)).leftJoin(propertyGroups, eq(lead.groupId, propertyGroups.Id)).where(eq(lead.createdBy, id))
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
    static async getAllCallLogs() {
        const result = await db.select({
            ...getTableColumns(callLogs),
            clientName: sql`${schema.platformUsers.firstName} || ' ' || ${schema.platformUsers.lastName}`.as("clientName"),
            // clientNumber: schema.platformUserProfiles.phone,
            agentName: sql`${adminUsers.firstName} || ' ' || ${adminUsers.lastName}`.as("agentName"),
            // agentNumber: adminUsers.phone,
        }).from(callLogs).leftJoin(adminUsers, eq(callLogs.AgentId, adminUsers.id)).leftJoin(schema.platformUsers, eq(callLogs.clientId, schema.platformUsers.id)).leftJoin(schema.platformUserProfiles, eq(callLogs.clientId, schema.platformUserProfiles.userId))
            .orderBy(desc(callLogs.createdAt));

        return {
            result,
            message: "Call Logs fetched successfully",
            STATUS_CODES: 200
        }
    }

    static async getCallSummary() {
        const result = await db.execute(sql`
  SELECT
      COUNT(*) FILTER (WHERE call_type = 'INCOMING') AS "totalIncomingCalls",
      COUNT(*) FILTER (WHERE call_type = 'OUTGOING') AS "totalOutgoingCalls",
      COUNT(*) FILTER (WHERE status = 'CONNECTED') AS "totalConnectedCalls",

      COUNT(*) FILTER (
        WHERE call_type = 'INCOMING'
        AND DATE(created_at) = CURRENT_DATE
      ) AS "todayIncomingCalls",

      COUNT(*) FILTER (
        WHERE call_type = 'OUTGOING'
        AND DATE(created_at) = CURRENT_DATE
      ) AS "todayOutgoingCalls",

      COUNT(*) FILTER (
        WHERE status = 'CONNECTED'
        AND DATE(created_at) = CURRENT_DATE
      ) AS "todayConnectedCalls",

      COUNT(DISTINCT client_id) FILTER (
        WHERE call_type = 'OUTGOING'
        AND DATE(created_at) = CURRENT_DATE
      ) AS "todayUniqueClientsCalled",

      COUNT(DISTINCT agent_id) FILTER (
        WHERE call_type = 'INCOMING'
        AND DATE(created_at) = CURRENT_DATE
      ) AS "todayUniqueAgentsCalled"

  FROM call_logs;
`);
        return {
            result: result[0],
            message: "Call Summary fetched successfully",
            STATUS_CODES: 200
        }

    }

    static async getCallAgentCallLogs(agentId: string, agentNumber: string) {
        const result = await db.select({
            ...getTableColumns(callLogs),
            clientName: sql`${schema.platformUsers.firstName} || ' ' || ${schema.platformUsers.lastName}`.as("clientName"),
            // clientNumber: schema.platformUserProfiles.phone,
            agentName: sql`${adminUsers.firstName} || ' ' || ${adminUsers.lastName}`.as("agentName"),
            // agentNumber: adminUsers.phone,
        }).from(callLogs).leftJoin(adminUsers, eq(callLogs.AgentId, adminUsers.id)).leftJoin(schema.platformUsers, eq(callLogs.clientId, schema.platformUsers.id)).leftJoin(schema.platformUserProfiles, eq(callLogs.clientId, schema.platformUserProfiles.userId)).where(
            or(
                eq(callLogs.AgentId, agentId),
                eq(callLogs.agentNumber, agentNumber)
            ))
            .orderBy(desc(callLogs.createdAt));

        return {
            result,
            message: "Call Logs fetched successfully",
            STATUS_CODES: 200
        }

    }

    static async getCallAgentSummary(agentId: string) {
        const result = await db.execute(sql`
  SELECT
      COUNT(*) FILTER (WHERE call_type = 'INCOMING' AND agent_id = ${agentId}) AS "totalIncomingCalls",
      COUNT(*) FILTER (WHERE call_type = 'OUTGOING' AND agent_id = ${agentId}) AS "totalOutgoingCalls",
      COUNT(*) FILTER (WHERE status = 'CONNECTED' AND agent_id = ${agentId}) AS "totalConnectedCalls",

      COUNT(*) FILTER (
        WHERE call_type = 'INCOMING'
        AND agent_id = ${agentId}
        AND DATE(created_at) = CURRENT_DATE
      ) AS "todayIncomingCalls",

      COUNT(*) FILTER (
        WHERE call_type = 'OUTGOING'
        AND agent_id = ${agentId}
        AND DATE(created_at) = CURRENT_DATE
      ) AS "todayOutgoingCalls",

      COUNT(*) FILTER (
        WHERE status = 'CONNECTED'
        AND agent_id = ${agentId}
        AND DATE(created_at) = CURRENT_DATE
      ) AS "todayConnectedCalls",

      -- UNIQUE AGENTS WHO GOT INCOMING CALLS TODAY FROM DIFFERENT CLIENT
      COUNT(DISTINCT client_id) FILTER (
        WHERE call_type = 'INCOMING'
        AND agent_id = ${agentId}
        AND DATE(created_at) = CURRENT_DATE
      ) AS "todayUniqueAgentsCalled"

  FROM call_logs;
`);

        return {
            result: result[0],
            message: "Call Summary fetched successfully",
            STATUS_CODES: 200
        }

    }

    static async getCallAgentPerformanceSummary() {
        const result = await db.execute(sql`
    SELECT
      au.id AS "adminId",
      au.first_name AS "firstName",
      au.last_name AS "lastName",

      COALESCE(l.lead_count, 0)         AS "leadCount",
      COALESCE(p.property_count, 0)     AS "propertyCount",
      COALESCE(c.total_calls, 0)        AS "totalCalls",
      COALESCE(c.todays_calls, 0)       AS "todaysCalls",
      COALESCE(c.todays_connected, 0)   AS "todaysConnected"

    FROM admin_users au
    INNER JOIN admin_user_roles aur 
        ON aur.user_id = au.id
    INNER JOIN admin_roles ar 
        ON ar.id = aur.role_id

    LEFT JOIN (
        SELECT created_by, COUNT(DISTINCT id) AS lead_count
        FROM lead
        GROUP BY created_by
    ) l ON l.created_by = au.id

    LEFT JOIN (
        SELECT 
            l.created_by, 
            COUNT(DISTINCT pm.property_id) AS property_count
        FROM property_meta pm
        JOIN lead l ON pm.lead_id = l.id
        GROUP BY l.created_by
    ) p ON p.created_by = au.id

    LEFT JOIN (
        SELECT
            agent_id,
            COUNT(*) AS total_calls,
            COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS todays_calls,
            COUNT(*) FILTER (
                WHERE DATE(created_at) = CURRENT_DATE 
                AND status = 'CONNECTED'
            ) AS todays_connected
        FROM call_logs
        GROUP BY agent_id
    ) c ON c.agent_id = au.id

    WHERE ar.name = 'Calling Agent' OR ar.name = 'Super Administrator'
    ORDER BY au.first_name;
`);

        return {
            result,
            message: "Call Agent Performance fetched successfully",
            STATUS_CODES: 200
        }
    }

    static async getSpecificCallAgentPerformance(agentId: string) {
        const result = await db.execute(sql`
  SELECT
    au.id   AS "adminId",
    au.first_name AS "firstName",
    au.last_name  AS "lastName",
    ar.name       AS "role",

    -- LEADS
    COALESCE(l.total_leads, 0)    AS "totalLeads",
    COALESCE(l.today_leads, 0)    AS "todayLeads",
    COALESCE(l.lead_source_website, 0)    AS "leadSourceWebsite",
    COALESCE(l.lead_source_media, 0)    AS "leadSourceMedia",
    COALESCE(l.lead_source_referral, 0)    AS "leadSourceReferral",
    COALESCE(l.lead_source_direct_call, 0)    AS "leadSourceDirectCall",

    -- PROPERTIES
    COALESCE(p.total_properties, 0) AS "totalProperties",
    COALESCE(p.today_properties, 0) AS "todayProperties",

    -- CALLS
    COALESCE(c.total_calls, 0)        AS "totalCalls",
    COALESCE(c.today_calls, 0)        AS "todayCalls",
    COALESCE(c.today_connected, 0)    AS "todayConnected",
    COALESCE(c.today_missed, 0)       AS "todayMissed",
    COALESCE(c.total_missed, 0)       AS "totalMissed",
    COALESCE(c.today_busy, 0)         AS "todayBusy",
    COALESCE(c.total_connected, 0)    AS "totalConnected",

    COALESCE(c.not_answered, 0)       AS "notAnswered",
    COALESCE(c.busy, 0)               AS "totalBusy",
    COALESCE(c.wrong_number, 0)       AS "wrongNumber",
    COALESCE(c.callback_schedule, 0)  AS "callbackSchedule",
    COALESCE(c.interested, 0)         AS "interested",
    COALESCE(c.not_interested, 0)     AS "notInterested",
    COALESCE(c.callback_later, 0)     AS "callbackLater",
    COALESCE(c.invalid_number, 0)     AS "invalidNumber",
    COALESCE(c.left_message, 0)       AS "leftMessage",
    COALESCE(c.other, 0)              AS "other",

    -- >>> NEW: LEADS LAST WEEK (RETURN ARRAY)
    COALESCE(lw.leads_last_week, '[]') AS "leadsLastWeek",

    -- >>> NEW: CALLS LAST WEEK (RETURN ARRAY)
    COALESCE(cw.calls_last_week, '[]') AS "callsLastWeek"

  FROM admin_users au
  INNER JOIN admin_user_roles aur ON aur.user_id = au.id
  INNER JOIN admin_roles ar        ON ar.id = aur.role_id

  -- LEADS SUMMARY
  LEFT JOIN (
    SELECT
      created_by,
      COUNT(id) AS total_leads,
      COUNT(id) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS today_leads,
      COUNT(*) FILTER (WHERE lead_source = 'Website') AS lead_source_website,
      COUNT(*) FILTER (WHERE lead_source IN ('Facebook','Instagram','YouTube')) AS lead_source_media,
      COUNT(*) FILTER (WHERE lead_source = 'Referral') AS lead_source_referral,
      COUNT(*) FILTER (WHERE lead_source = 'Direct Call') AS lead_source_direct_call
    FROM lead
    GROUP BY created_by
  ) l ON l.created_by = au.id

  -- PROPERTIES SUMMARY
  LEFT JOIN (
    SELECT
      ld.created_by,
      COUNT(pm.property_id) AS total_properties,
      COUNT(pm.property_id) FILTER (WHERE DATE(ld.created_at) = CURRENT_DATE) AS today_properties
    FROM property_meta pm
    JOIN lead ld ON pm.lead_id = ld.id
    GROUP BY ld.created_by
  ) p ON p.created_by = au.id

  -- CALL LOG SUMMARY
  LEFT JOIN (
    SELECT
      agent_id,
      COUNT(*) AS total_calls,
      COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS today_calls,
      COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE AND status = 'MISSED CALLED') AS today_missed,
      COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE AND status = 'CONNECTED') AS today_connected,
      COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE AND status = 'BUSY') AS today_busy,
      COUNT(*) FILTER (WHERE status = 'CONNECTED') AS total_connected,
      COUNT(*) FILTER (WHERE status = 'MISSED CALLED') AS total_missed,

      COUNT(*) FILTER (WHERE status = 'NOT ANSWERED') AS not_answered,
      COUNT(*) FILTER (WHERE status = 'BUSY') AS busy,
      COUNT(*) FILTER (WHERE status = 'WRONG NUMBER') AS wrong_number,
      COUNT(*) FILTER (WHERE status = 'CALLBACK SCHEDULED') AS callback_schedule,
      COUNT(*) FILTER (WHERE status = 'INTERESTED') AS interested,
      COUNT(*) FILTER (WHERE status = 'NOT INTERESTED') AS not_interested,
      COUNT(*) FILTER (WHERE status = 'CALL BACK LATER') AS callback_later,
      COUNT(*) FILTER (WHERE status = 'INVALID NUMBER') AS invalid_number,
      COUNT(*) FILTER (WHERE status = 'LEFT MESSAGE') AS left_message,
      COUNT(*) FILTER (WHERE status = 'OTHER') AS other
    FROM call_logs
    GROUP BY agent_id
  ) c ON c.agent_id = au.id

  -- >>> WEEKLY LEADS (ZERO-FILLED)
LEFT JOIN (
  WITH days AS (
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '6 days',
      CURRENT_DATE,
      '1 day'
    )::date AS day
  ),
  lead_counts AS (
    SELECT
      created_by,
      DATE(created_at) AS day,
      COUNT(*) AS count
    FROM lead
    WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
    GROUP BY created_by, DATE(created_at)
  )
  SELECT
    au.id AS created_by,
    JSON_AGG(
      JSON_BUILD_OBJECT(
        'date', d.day,
        'count', COALESCE(lc.count, 0)
      ) ORDER BY d.day
    ) AS leads_last_week
  FROM admin_users au
  CROSS JOIN days d
  LEFT JOIN lead_counts lc
    ON lc.day = d.day
   AND lc.created_by = au.id
  GROUP BY au.id
) lw ON lw.created_by = au.id


  -- >>> WEEKLY CALLS (JSON ARRAY)
  -- >>> WEEKLY CALLS (ZERO-FILLED)
LEFT JOIN (
  WITH days AS (
    SELECT generate_series(
      CURRENT_DATE - INTERVAL '6 days',
      CURRENT_DATE,
      '1 day'
    )::date AS day
  ),
  call_counts AS (
    SELECT
      agent_id,
      DATE(created_at) AS day,
      COUNT(*) AS count
    FROM call_logs
    WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
    GROUP BY agent_id, DATE(created_at)
  )
  SELECT
    au.id AS agent_id,
    JSON_AGG(
      JSON_BUILD_OBJECT(
        'date', d.day,
        'count', COALESCE(cc.count, 0)
      ) ORDER BY d.day
    ) AS calls_last_week
  FROM admin_users au
  CROSS JOIN days d
  LEFT JOIN call_counts cc
    ON cc.day = d.day
   AND cc.agent_id = au.id
  GROUP BY au.id
) cw ON cw.agent_id = au.id

  WHERE au.id = ${agentId}
  LIMIT 1;
`);

        return {
            result: result[0],
            message: "Call Agent Performance fetched successfully",
            STATUS_CODES: 200
        }
    }

    static parseValidDate(value: any): Date | undefined {
        if (!value || typeof value !== "string") return undefined;

        const trimmed = value.trim();
        if (!trimmed) return undefined;

        // Check for DD/MM/YYYY format
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
            const [d, m, y] = trimmed.split("/").map(Number);
            const date = new Date(y, m - 1, d);
            return isNaN(date.getTime()) ? undefined : date;
        }

        const d = new Date(trimmed);
        return isNaN(d.getTime()) ? undefined : d;
    }

    static async bulkImportCallLogs(input: any[], adminId: string) {

        await db.transaction(async (tx) => {
            for (let i = 0; i < input.length; i += CHUNK_SIZE) {

                const chunk = input.slice(i, i + CHUNK_SIZE);

                // Extract phone numbers for batch lookup
                const clientPhones = [...new Set(chunk.map(r => r.clientNumber).filter(Boolean))];
                const agentPhones = [...new Set(chunk.map(r => r.agentNumber).filter(Boolean))];

                // Fetch clients (users) by phone — single DB call
                const clientUsers = await tx
                    .select({
                        userId: schema.platformUserProfiles.userId,
                        phone: schema.platformUserProfiles.phone
                    })
                    .from(schema.platformUserProfiles)
                    .where(inArray(schema.platformUserProfiles.phone, clientPhones));

                const clientMap = new Map();
                clientUsers.forEach(u => clientMap.set(u.phone, u.userId));

                // Fetch agents by phone — single DB call
                const agents = await tx
                    .select({
                        userId: schema.adminUsers.id,
                        phone: schema.adminUsers.phone
                    })
                    .from(schema.adminUsers)
                    .where(inArray(schema.adminUsers.phone, agentPhones));

                const agentMap = new Map();
                agents.forEach(a => agentMap.set(a.phone, a.userId));

                // Fetch leads for ALL clientIds — single DB call
                const allClientIds = [...new Set(clientUsers.map(c => c.userId))];

                const leads = await tx
                    .select({
                        id: lead.Id,
                        clientId: lead.clientId
                    })
                    .from(lead)
                    .where(inArray(lead.clientId, allClientIds));

                const leadMap = new Map();
                leads.forEach(l => leadMap.set(l.clientId, l.id));

                // Build final call logs payload
                const logsToInsert = [];

                for (const row of chunk) {
                    const clientNumber = row.clientNumber;
                    const agentNumber = row.agentNumber;

                    const clientId = clientMap.get(clientNumber) || null;
                    const AgentId = agentMap.get(agentNumber) || null;

                    const leadId = clientId ? leadMap.get(clientId) || null : null;

                    logsToInsert.push({
                        leadId,
                        status: row.status,
                        createdAt: CrmService.parseValidDate(row.createdAt),
                        followUp: CrmService.parseValidDate(row.followUp),
                        feedback: row.feedback || null,
                        clientId,
                        AgentId,
                        clientNumber: clientNumber || null,
                        agentNumber: agentNumber || null,
                        duration: String(row.duration || "0"),
                        recordingUrl: row?.recordingUrl || null,
                        callType: row.callType || null,
                        disconnectedBy: row.disconnectedBy || null,
                    });
                }

                // Bulk Insert Only Once Per Chunk
                if (logsToInsert.length > 0) {
                    await tx.insert(callLogs).values(logsToInsert);
                }
            }
        });

        return {
            message: "Call Logs imported successfully",
            STATUS_CODES: 200
        };
    }

    static async updateCallStatus(id: any, input: any) {
        const { callStatus, feedback, followUpDate, leadId } = input;
        console.log("input : ", id, input)
        if (id.trim()) {
            // Update directly using given ID
            await db.update(callLogs)
                .set({
                    status: callStatus,
                    feedback,
                    followUp: followUpDate
                        ? new Date(followUpDate)
                        : null
                })
                .where(eq(callLogs.Id, id));
        } else {
            // No id — find the latest call log for this leadId
            const latestRows = await db.select().from(callLogs).where(eq(callLogs.leadId, leadId))
                .orderBy(desc(callLogs.createdAt))
                .limit(1);
            const latestEntry = latestRows[0];

            if (!latestEntry) {
                return {
                    message: "No call log found for this leadId",
                    STATUS_CODES: 404
                };
            }

            // Update the latest entry
            await db.update(callLogs)
                .set({
                    status: callStatus,
                    feedback,
                    followUp: followUpDate
                        ? new Date(followUpDate)
                        : null
                })
                .where(eq(callLogs.Id, latestEntry.Id))
                .returning();
        }

        return {
            message: "CallLogs updated successfully",
            STATUS_CODES: 200
        };
    }


    // static async getCallSummaryByAgent() {
    //     const result = await db.execute(sql`
    //       SELECT
    //           agent_id,

    //           COUNT(*) FILTER (WHERE call_type = 'INCOMING') AS "totalIncomingCalls",
    //           COUNT(*) FILTER (WHERE call_type = 'OUTGOING') AS "totalOutgoingCalls",
    //           COUNT(*) FILTER (WHERE status = 'CONNECTED') AS "totalConnectedCalls",

    //           COUNT(*) FILTER (
    //             WHERE call_type = 'INCOMING' 
    //             AND DATE(created_at) = CURRENT_DATE
    //           ) AS "todayIncomingCalls",

    //           COUNT(*) FILTER (
    //             WHERE call_type = 'OUTGOING'
    //             AND DATE(created_at) = CURRENT_DATE
    //           ) AS "todayOutgoingCalls",

    //           COUNT(*) FILTER (
    //             WHERE status = 'CONNECTED'
    //             AND DATE(created_at) = CURRENT_DATE
    //           ) AS "todayConnectedCalls",

    //           COUNT(DISTINCT client_id) FILTER (
    //             WHERE call_type = 'OUTGOING'
    //             AND DATE(created_at) = CURRENT_DATE
    //           ) AS "todayUniqueClientsCalled",

    //           COUNT(DISTINCT agent_id) FILTER (
    //             WHERE call_type = 'INCOMING'
    //             AND DATE(created_at) = CURRENT_DATE
    //           ) AS "todayUniqueAgentsCalled"

    //       FROM call_logs
    //       GROUP BY agent_id;
    //     `);

    //     return {
    //         result,
    //         message: "Call Summary fetched successfully",
    //         STATUS_CODES: 200
    //     }

    // }

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
