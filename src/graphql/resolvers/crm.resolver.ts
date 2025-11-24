import { GraphQLError } from "graphql";
import { AdminContext } from "./auth.resolvers";
import { CrmService } from "../services/crm.service";

export const crmResolver = {
   Query: {
      getLeadById: async (_: any, { id }: any) => {
         try {
            const leads = await CrmService.getLeadById(id)
            return leads;
         } catch (error) {
            throw new GraphQLError(`Failed to get lead: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }
      },
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
      getAllLead: async (_: any,__:any,context:AdminContext) => {
         try {
            if (!context.admin?.adminId) {
               throw new GraphQLError("Authentication required", {
                  extensions: { code: "UNAUTHENTICATED" },
               })
            }

            const leads = await CrmService.getAllLeads(context.admin)
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
            return broadcast;
         } catch (error) {
            throw new GraphQLError(`Failed to get broadcast: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }
      },
      // call logs
      getAllCallLogs: async (_: any,) => {
         try {
            const calls = await CrmService.getAllCallLogs()
            return calls;
         } catch (error) {
            throw new GraphQLError(`Failed to get call logs: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }
      }
      ,
      getCallSummary: async (_: any,) => {
         try {
            const calls = await CrmService.getCallSummary()
            return calls;
         } catch (error) {
            throw new GraphQLError(`Failed to get call agent performance summary: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }
      }
      ,
      getCallAgentCallLogs: async (_: any, __: any, context: AdminContext) => {
         try {
            if (!context.admin?.adminId) {
               throw new GraphQLError("Authentication required", {
                  extensions: { code: "UNAUTHENTICATED" },
               })
            }
            const calls = await CrmService.getCallAgentCallLogs(context.admin?.adminId, context.admin?.phone)
            return calls;
         } catch (error) {
            throw new GraphQLError(`Failed to get calls: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }
      }
      ,
      getCallAgentSummary: async (_: any, __: any, context: AdminContext) => {
         try {
            if (!context.admin?.adminId) {
               throw new GraphQLError("Authentication required", {
                  extensions: { code: "UNAUTHENTICATED" },
               })
            }
            const calls = await CrmService.getCallAgentSummary(context.admin?.adminId)
            return calls;
         } catch (error) {
            throw new GraphQLError(`Failed to get call agent summary: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }
      }
      ,
      getCallAgentPerformanceSummary: async (_: any,) => {
         try {
            const calls = await CrmService.getCallAgentPerformanceSummary()
            return calls;
         } catch (error) {
            throw new GraphQLError(`Failed to get call agent performance summary: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }
      },
      getSpecificCallAgentPerformance: async (_: any, { id }: any) => {
         try {
            const performance = await CrmService.getSpecificCallAgentPerformance(id)
            return performance;
         } catch (error) {
            throw new GraphQLError(`Failed to get agent performance: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }
      },
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

      },
      updateLead: async (_: any, { id, input }: any, context: AdminContext) => {
         if (!context.admin?.adminId) {
            throw new GraphQLError("Authentication required", {
               extensions: { code: "UNAUTHENTICATED" },
            })
         }
         try {
            const data = await CrmService.updateLead(id, input);
            return data;
         } catch (error) {
            console.log(error);
            throw new GraphQLError(`Failed to create Lead: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }

      }
      ,
      bulkImportLead: async (_: any, { input }: any, context: AdminContext) => {
         if (!context.admin?.adminId) {
            throw new GraphQLError("Authentication required", {
               extensions: { code: "UNAUTHENTICATED" },
            })
         }
         try {
            const data = await CrmService.bulkImportLead(input, context.admin.adminId);
            return data;
         } catch (error) {
            console.log(error);
            throw new GraphQLError(`Failed to import Lead: ${(error as Error).message}`, {
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

    // Broadcast Mutations
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
      ,
       bulkImportCallLogs: async (_: any, { input }: any, context: AdminContext) => {
         if (!context.admin?.adminId) {
            throw new GraphQLError("Authentication required", {
               extensions: { code: "UNAUTHENTICATED" },
            })
         }
         try {
            const data = await CrmService.bulkImportCallLogs(input, context.admin.adminId);
            return data;
         } catch (error) {
            console.log(error);
            throw new GraphQLError(`Failed to import Lead: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }

      },
      updateCallStatus: async (_: any, { id, input }: any) => {
         try {
            const data = await CrmService.updateCallStatus(id, input);
            return data;
         } catch (error) {
            console.log(error);
            throw new GraphQLError(`Failed to update call status: ${(error as Error).message}`, {
               extensions: { code: "INTERNAL_ERROR" },
            })
         }

      }
      ,
    },
  };
