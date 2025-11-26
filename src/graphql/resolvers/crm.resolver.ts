import { GraphQLError } from "graphql";
import { AdminContext } from "./auth.resolvers";
import { CrmService } from "../services/crm.service";

export const crmResolver = {
  Query: {
    // ✅ Lead Resolvers
    getAllLead: async (_: any) => {
      try {
        const leads = await CrmService.getAllLeads();
        return leads;
      } catch (error) {
        throw new GraphQLError(`Failed to get leads: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    // ✅ Group Resolvers
    getAllGroup: async (_: any) => {
      try {
        const groups = await CrmService.getAllGroup();
        return groups;
      } catch (error) {
        throw new GraphQLError(`Failed to get groups: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    getGroupById: async (_: any, { id }: any) => {
      try {
        const group = await CrmService.getGroupById(id);
        return group;
      } catch (error) {
        throw new GraphQLError(`Failed to get group: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    // ✅ Broadcast Resolvers
    getAllBroadcasts: async (_: any) => {
      try {
        const broadcasts = await CrmService.getAllBroadcasts();
        return broadcasts;
      } catch (error) {
        throw new GraphQLError(`Failed to get broadcasts: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    getBroadcastById: async (_: any, { id }: any) => {
      try {
        const broadcast = await CrmService.getBroadcastById(id);
        return broadcast;
      } catch (error) {
        throw new GraphQLError(`Failed to get broadcast: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    // ✅ Call Logs Resolver (correct placement!)
    getAllCallLogs: async (_: any) => {
      try {
        const calls = await CrmService.getAllCallLogs();
        return calls;
      } catch (error) {
        throw new GraphQLError(`Failed to get call logs: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },

  Mutation: {
    // ✅ Lead Mutations
    createLead: async (_: any, { input }: any, context: AdminContext) => {
      if (!context.admin?.adminId) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      try {
        const data = await CrmService.createLead(input, context.admin.adminId);
        return data;
      } catch (error) {
        throw new GraphQLError(`Failed to create Lead: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    createLeadProperty: async (_: any, { input }: any, context: AdminContext) => {
      if (!context.admin?.adminId) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      try {
        const data = await CrmService.createLead(input, context.admin.adminId);
        return data;
      } catch (error) {
        throw new GraphQLError(`Failed to create Lead: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    updateLead: async (_: any, { id, input }: any, context: AdminContext) => {
      if (!context.admin?.adminId) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      try {
        const data = await CrmService.updateLead(id, input);
        return data;
      } catch (error) {
        throw new GraphQLError(`Failed to update Lead: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    // ✅ Group Mutations
    createGroup: async (_: any, { input }: any, context: AdminContext) => {
      if (!context.admin?.adminId) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      try {
        const data = await CrmService.createGroup(input, context.admin.adminId);
        return data;
      } catch (error) {
        throw new GraphQLError(`Failed to create Group: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    updateGroup: async (_: any, { id, input }: any, context: AdminContext) => {
      if (!context.admin?.adminId) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      try {
        const data = await CrmService.updateGroup(id, input);
        return data;
      } catch (error) {
        throw new GraphQLError(`Failed to update Group: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    updateActiveGroup: async (_: any, { id, input }: any, context: AdminContext) => {
      if (!context.admin?.adminId) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      try {
        const data = await CrmService.updateActiveGroup(id, input);
        return data;
      } catch (error) {
        throw new GraphQLError(`Failed to update Active Group: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    deleteGroup: async (_: any, { id }: any, context: AdminContext) => {
      if (!context.admin?.adminId) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      try {
        const data = await CrmService.deleteGroup(id);
        return data;
      } catch (error) {
        throw new GraphQLError(`Failed to delete Group: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    // ✅ Broadcast Mutations
    createBroadcast: async (_: any, { input }: any, context: AdminContext) => {
      if (!context.admin?.adminId) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      try {
        const data = await CrmService.createBroadcast(input, context.admin.adminId);
        return data;
      } catch (error) {
        throw new GraphQLError(`Failed to create Broadcast: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    updateBroadcast: async (_: any, { id, input }: any, context: AdminContext) => {
      if (!context.admin?.adminId) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      try {
        const data = await CrmService.updateBroadcast(id, input);
        return data;
      } catch (error) {
        throw new GraphQLError(`Failed to update Broadcast: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    deleteBroadcast: async (_: any, { id }: any, context: AdminContext) => {
      if (!context.admin?.adminId) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      try {
        const data = await CrmService.deleteBroadcast(id);
        return data;
      } catch (error) {
        throw new GraphQLError(`Failed to delete Broadcast: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },
};
