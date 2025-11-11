// import fetch from "node-fetch";
import { db } from "../../database/connection";
import { kommunoConfig } from "../../config/kommuno";
import { callLogs } from "../../database/schema/crm-model";

export class KommunoService {
    static async clickToCall(input: any, adminId: string) {
        const { leadId, clientId, customerNumber, agentNumber} = input;
        
        const sessionId = await db.insert(callLogs).values({
            leadId: leadId,
            clientId: clientId,
            AgentId: adminId,
        }).returning({
            sessionId: callLogs.Id,
        });

        // const sessionId = Date.now().toString();
        // create call logs with client and agent ids
        const response = await fetch(`${kommunoConfig.domain}/kcrm/clickToCallWithLiveStatus`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                accesskey: kommunoConfig.accessKey,
                accesstoken: kommunoConfig.accessToken,
            },
            body: JSON.stringify({
                smeId: kommunoConfig.smeId,
                sessionId,
                customerNumber,
                agentNumber,
                recordingFlag:1,
                pilotNumber:kommunoConfig.virtualNumber,
            }),
        });

        if (!response.ok) {
            throw new Error(`Kommuno API Error: ${response.status}`);
        }

        const data = await response.json();
        console.log("Inserted call log with sessionId:", data);

        return { sessionId, data };
    }
}
