import { GraphQLError } from "graphql";
import { AdminContext } from "./auth.resolvers";
import { CrmWhatsAppService } from "../services/crm-whatsapp.service";
import { send } from "process";

export const crmWhatsAppResolver = {
    Query: {
        // Template
        getAllTemplate: async (_: any, __: any,) => {
            try {
                const template = await CrmWhatsAppService.getAllTemplate();
                return template;
            } catch (error) {
                throw new GraphQLError(`Failed to get template: ${(error as Error).message}`, {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        },

        // Broadcast
        // Broadcast Resolvers
        getAllBroadcasts: async (_: any) => {
            try {
                const broadcast = await CrmWhatsAppService.getAllBroadcasts()
                return broadcast;
            } catch (error) {
                throw new GraphQLError(`Failed to get broadcast: ${(error as Error).message}`, {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        }
        ,
        getAllCampaign: async (_: any) => {
            try {
                const campaign = await CrmWhatsAppService.getAllCampaign()
                return campaign;
            } catch (error) {
                throw new GraphQLError(`Failed to get campaign: ${(error as Error).message}`, {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        }
        ,
        getBroadcastById: async (_: any, { id }: any) => {
            try {
                const broadcast = await CrmWhatsAppService.getBroadcastById(id)
                return broadcast;
            } catch (error) {
                throw new GraphQLError(`Failed to get broadcast: ${(error as Error).message}`, {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        },

        // whatsapp chat
        getWhatsAppThreadChat: async (_: any, __: any, context: AdminContext) => {
            if (!context.admin?.adminId) {
                throw new GraphQLError("Authentication required", {
                    extensions: { code: "UNAUTHENTICATED" },
                })
            }
            try {
                const threads = await CrmWhatsAppService.getWhatsAppThreadChat(context.admin);
                return threads;
            } catch (error) {
                throw new GraphQLError(`Failed to get chat threads: ${(error as Error).message}`, {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        }
        ,

        getWhatsAppMessages: async (_: any, { threadId }: any, context: AdminContext) => {
            if (!context.admin?.adminId) {
                throw new GraphQLError("Authentication required", {
                    extensions: { code: "UNAUTHENTICATED" },
                })
            }
            try {
                const messages = await CrmWhatsAppService.getWhatsAppMessages(threadId);
                return messages;
            } catch (error) {
                throw new GraphQLError(`Failed to get chat messages: ${(error as Error).message}`, {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        }

    }
    ,
    Mutation: {
        // Template
        createTemplate: async (_: any, { input }: any, context: AdminContext) => {
            if (!context.admin?.adminId) {
                throw new GraphQLError("Authentication required", {
                    extensions: { code: "UNAUTHENTICATED" },
                })
            }
            try {
                const template = await CrmWhatsAppService.createTemplate(input, context.admin.adminId);
                return template;
            } catch (error) {
                console.log(error);
                throw new GraphQLError(`Failed to Create Template: ${(error as Error).message}`, {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }

        },

        syncTemplate: async (_: any) => {
            try {
                const template = await CrmWhatsAppService.syncTemplate();
                return template;
            } catch (error) {
                console.log(error);
                throw new GraphQLError(`Failed to Sync Template: ${(error as Error).message}`, {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }

        },

        // Broadcast
        // Broadcast Mutations
        createCampaign: async (_: any, { input }: any, context: AdminContext) => {
            if (!context.admin?.adminId) {
                throw new GraphQLError("Authentication required", {
                    extensions: { code: "UNAUTHENTICATED" },
                });
            }
            try {
                const data = await CrmWhatsAppService.createCampaign(input, context.admin.adminId);
                return data;
            } catch (error) {
                console.log(error);
                throw new GraphQLError(`Failed to create Broadcast: ${(error as Error).message}`, {
                    extensions: { code: "INTERNAL_ERROR" },
                });
            }
        },
        sendBroadcast: async (_: any, { input }: any, context: AdminContext) => {
            if (!context.admin?.adminId) {
                throw new GraphQLError("Authentication required", {
                    extensions: { code: "UNAUTHENTICATED" },
                });
            }
            try {
                const data = await CrmWhatsAppService.sendBroadcastMessage(input, context.admin.adminId);
                return data;
            } catch (error) {
                console.log(error);
                throw new GraphQLError(`Failed to create Broadcast: ${(error as Error).message}`, {
                    extensions: { code: "INTERNAL_ERROR" },
                });
            }
        },

        // Whatsapp chat
        sendTemplateMessage: async (_: any, { input }: any, context: AdminContext) => {
            if (!context.admin?.adminId) {
                throw new GraphQLError("Authentication required", {
                    extensions: { code: "UNAUTHENTICATED" },
                })
            }
            try {
                const response = await CrmWhatsAppService.sendTemplateMessage(input, context.admin.adminId);
                return response;
            } catch (error) {
                throw new GraphQLError(`Failed to send template to lead: ${(error as Error).message}`, {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        }
        ,
        sendTextMessage: async (_: any, { input }: any, context: AdminContext) => {
            if (!context.admin?.adminId) {
                throw new GraphQLError("Authentication required", {
                    extensions: { code: "UNAUTHENTICATED" },
                })
            }
            try {
                const response = await CrmWhatsAppService.sendTextMessage(input, context.admin.adminId);
                return response;
            } catch (error) {
                throw new GraphQLError(`Failed to send text message to lead: ${(error as Error).message}`, {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        }
    },
};
