import { GraphQLError } from "graphql"
import { AdminContext } from "./auth.resolvers";
import { CrmService } from "../services/crm.service";

export const crmResolver = {
   Query: {
      // getLeadById: async (_: any, { id }: { id: string }) => {

      // },
      //   getAllLead: async (_: any, args: { status?: string, page: number, limit?: number }) => {
      //    const { status, page, limit } = args
      //    try {
      //       const leads = await CrmService.getAllLeads(status, page, limit)
      //       console.log(leads);
      //       return leads;
      //    } catch (error) {
      //       throw new GraphQLError(`Failed to get leads: ${(error as Error).message}`, {
      //          extensions: { code: "INTERNAL_ERROR" },
      //       })
      //    }
      // },
      getAllLead: async (_: any,) => {
         try {
            const leads = await CrmService.getAllLeads()
            return leads;
         } catch (error) {
            throw new GraphQLError(`Failed to get leads: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }
      },


      // Group Resolvers
      getAllGroup: async (_: any) => {
         try {
            const groups = await CrmService.getAllGroup()
            return groups;
         } catch (error) {
            throw new GraphQLError(`Failed to get groups: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }
      },
      getGroupById: async (_: any, { id }: any) => {
         try {
            const group = await CrmService.getGroupById(id)
            console.log(group);
            return group;
         } catch (error) {
            throw new GraphQLError(`Failed to get group: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }
      }
      ,

      // Broadcast Resolvers
      getAllBroadcasts: async (_: any) => {
         try {
            const broadcast = await CrmService.getAllBroadcasts()
            console.log(broadcast);
            return broadcast;
         } catch (error) {
            throw new GraphQLError(`Failed to get broadcast: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }
      }
      ,
      getBroadcastById: async (_: any, { id }: any) => {
         try {
            const broadcast = await CrmService.getBroadcastById(id)
            console.log(broadcast);
            return broadcast;
         } catch (error) {
            throw new GraphQLError(`Failed to get broadcast: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }
      }

   }
   ,
   Mutation: {
      createLead: async (_: any, { input }: any, context: AdminContext) => {
         if (!context.admin?.adminId) {
            throw new GraphQLError("Authentication required", {
               extensions: { code: "UNAUTHENTICATED" },
            })
         }
         try {
            const data = await CrmService.createLead(input, context.admin.adminId);
            return data;
         } catch (error) {
            console.log(error);
            throw new GraphQLError(`Failed to create Lead: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }

      }
      ,
      createLeadProperty: async (_: any, { input }: any, context: AdminContext) => {
         if (!context.admin?.adminId) {
            throw new GraphQLError("Authentication required", {
               extensions: { code: "UNAUTHENTICATED" },
            })
         }
         try {
            const data = await CrmService.createLead(input, context.admin.adminId);
            return data;
         } catch (error) {
            console.log(error);
            throw new GraphQLError(`Failed to create Lead: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }

      }
      ,
      createGroup: async (_: any, { input }: any, context: AdminContext) => {
         if (!context.admin?.adminId) {
            throw new GraphQLError("Authentication required", {
               extensions: { code: "UNAUTHENTICATED" },
            })
         }
         try {
            const data = await CrmService.createGroup(input, context.admin.adminId);
            console.log("create group resolver", data);
            return data;
         } catch (error) {
            console.log(error);
            throw new GraphQLError(`Failed to create Lead: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }

      },
      updateGroup: async (_: any, { id, input }: any, context: AdminContext) => {
         if (!context.admin?.adminId) {
            throw new GraphQLError("Authentication required", {
               extensions: { code: "UNAUTHENTICATED" },
            })
         }
         try {
            const data = await CrmService.updateGroup(id, input);
            return data;
         } catch (error) {
            console.log(error);
            throw new GraphQLError(`Failed to create Lead: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }

      },
      updateActiveGroup: async (_: any, { id, input }: any, context: AdminContext) => {
         if (!context.admin?.adminId) {
            throw new GraphQLError("Authentication required", {
               extensions: { code: "UNAUTHENTICATED" },
            })
         }
         try {
            const data = await CrmService.updateActiveGroup(id, input);
            return data;
         } catch (error) {
            console.log(error);
            throw new GraphQLError(`Failed to create Lead: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }
      }
      ,
      deleteGroup: async (_: any, { id }: any, context: AdminContext) => {
         if (!context.admin?.adminId) {
            throw new GraphQLError("Authentication required", {
               extensions: { code: "UNAUTHENTICATED" },
            })
         }
         try {
            const data = await CrmService.deleteGroup(id);
            return data;
         } catch (error) {
            console.log(error);
            throw new GraphQLError(`Failed to create Lead: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }

      }

      ,
      createBroadcast: async (_: any, { input }: any, context: AdminContext) => {
         if (!context.admin?.adminId) {
            throw new GraphQLError("Authentication required", {
               extensions: { code: "UNAUTHENTICATED" },
            })
         }
         try {
            const data = await CrmService.createBroadcast(input, context.admin.adminId);
            return data;
         } catch (error) {
            console.log(error);
            throw new GraphQLError(`Failed to create Lead: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }

      },
      updateBroadcast: async (_: any, { id, input }: any, context: AdminContext) => {
         if (!context.admin?.adminId) {
            throw new GraphQLError("Authentication required", {
               extensions: { code: "UNAUTHENTICATED" },
            })
         }
         try {
            const data = await CrmService.updateBroadcast(id, input);
            return data;
         } catch (error) {
            console.log(error);
            throw new GraphQLError(`Failed to create Lead: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }

      }
      ,
      deleteBroadcast: async (_: any, { id }: any, context: AdminContext) => {
         if (!context.admin?.adminId) {
            throw new GraphQLError("Authentication required", {
               extensions: { code: "UNAUTHENTICATED" },
            })
         }
         try {
            const data = await CrmService.deleteBroadcast(id);
            return data;
         } catch (error) {
            console.log(error);
            throw new GraphQLError(`Failed to create Lead: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }

      }
   }
}