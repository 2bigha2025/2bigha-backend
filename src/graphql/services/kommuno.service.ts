// import fetch from "node-fetch";
import { db } from "../../database/connection";
import { kommunoConfig } from "../../config/kommuno";
import { callLogs } from "../../database/schema/crm-model";
import { eq } from "drizzle-orm"
import * as schema from "../../database/schema/index";
import { adminUsers } from "../../database/schema/admin-user";
import kommunoInstance from "../../axios-instances/kommuno";

export class KommunoService {
    static async clickToCall(input: any, adminId: string) {
        const { leadId, clientId, customerNumber, agentNumber } = input;
        const sessionId = await db.insert(callLogs).values({
            leadId: leadId,
            clientId: clientId,
            AgentId: adminId,
        }).returning({
            sessionId: callLogs.Id,
        });

        // create call logs with client and agent ids
        const body = {
            smeId: kommunoConfig.smeId,
            sessionId: sessionId[0].sessionId,
            customerNumber,
            agentNumber,
            recordingFlag: 1,
            pilotNumber: kommunoConfig.virtualNumber,
        };

        console.log('>>>>>>>body>>>>>',body)

        const data = await kommunoInstance.post("/kcrm/clickToCallWithLiveStatus", body);
        console.log('>>>>>>>>data>>>>>',data)

        return { sessionId, data };
    }

    static async handleLiveEvent(payload: any) {
        const {
            live_event,
            session_id,
            from,
            call_direction,
            agent_details,
            date_time
        } = payload;

        const systemAgentId = agent_details?.agent_id || null;
        const agentNumber = agent_details?.agent_number || null;
        const clientNumber = from || null;
        let agentId = null;
        let clientId = null;
        if (call_direction === "INCOMING") {
            agentId = await db.select({ Id: adminUsers.id }).from(adminUsers).where(eq(adminUsers.phone, agentNumber));
            clientId = await db.select({ Id: schema.platformUserProfiles.userId }).from(schema.platformUserProfiles).where(eq(schema.platformUserProfiles.phone, clientNumber));
        }

        const callId = session_id;

        // Check if log already exists
        const existing = await db
            .select()
            .from(callLogs)
            .where(eq(callLogs.Id, callId));

        if (existing.length === 0) {
            // INSERT NEW CALL ENTRY
            await db.insert(callLogs).values({
                Id: callId,
                duration: null,
                systemStatus: live_event === "evt_popup" ? "CONNECTED" : "RINGING",
                disconnectedBy: null,
                longCode: null,
                callType: call_direction,
                recordingUrl: null,
                createdAt: new Date(date_time),
                clientId: clientId ? clientId[0]?.Id : null, // unknown yet
                AgentId: agentId ? agentId[0]?.Id : null,
                clientNumber: clientNumber,
                agentNumber: agentNumber,
            });
        } else {
            // UPDATE STATUS ONLY
            await db
                .update(callLogs)
                .set({
                    systemStatus: live_event === "evt_popup" ? "CONNECTED" : "RINGING",
                    AgentId: systemAgentId
                })
                .where(eq(callLogs.Id, callId));
        }
    }

    static async handleCompletedCall(payload: any) {
        const { call_details, recording_details, customer_details, agent_details } = payload;

        const callId = call_details.session_id;

        await db
            .update(callLogs)
            .set({
                clientNumber: customer_details.customer_number,
                agentNumber: agent_details.agent_number,
                duration: String(call_details.duration),
                systemStatus: call_details.overall_call_status,  // "patched" / "notpatched"
                disconnectedBy: call_details.disconnected_by,
                callType: call_details.call_direction,
                longCode: call_details.longcode,
                recordingUrl: recording_details?.recording_path || null,
                createdAt: new Date(call_details.start_date_time)
            })
            .where(eq(callLogs.Id, callId));
    }
}

