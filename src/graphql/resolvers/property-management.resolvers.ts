import { PropertyManagementService } from "../services/property-management.service"
import { GraphQLError } from "graphql";
import { PropertyService } from "../services/property.services";
import { PlatformUserContext } from "../../user/user.resolvers";
import { AdminContext } from "./auth.resolvers";
export const PropertyManagementResolver = {
    Query: {

        getManagedProeprtiesByUser: async (
            _: any,
            { page, limit }: { page: number, limit: number },
            context: PlatformUserContext
        ) => {
            if (!context?.user?.userId) {
                throw new GraphQLError("Not authenticated", {
                    extensions: { code: "UNAUTHENTICATED" },
                });
            }
            const result = await PropertyManagementService.getUserProperties(context.user.userId, page, limit)
            return {
                meta: result.meta,
                data: result.rows
            }


        },


        getManagedUserPropertiesID: async (
            _: any,
            { property_id }: { property_id: string },
            context: PlatformUserContext
        ) => {

            if (!context?.user?.userId) {
                throw new GraphQLError("Not authenticated", {
                    extensions: { code: "UNAUTHENTICATED" },
                });
            }
            const result = await PropertyManagementService.getUserPropertiesById(context.user.userId, property_id)
            console.log(result, "It is from resolver")
            return result
        },
        getAllManagedProperties: async (
            _: any,
            { page, limit, searchTerm, billingCycle, planName, status }: { page: number, limit: number, searchTerm?: string, billingCycle?: string, planName?: string, status?: string },
            context: AdminContext
        ) => {

            if (!context?.admin?.adminId) {
                throw new GraphQLError("Not authenticated", {
                    extensions: { code: "UNAUTHENTICATED" },
                });
            }
            const result = await PropertyManagementService.getAllManagedProperties(page, limit, searchTerm, billingCycle, planName, status)
            console.log(result, "It is from resolver")
            return {
                meta: result.meta,
                data: result.rows
            }
        },
        getPropertyAssignmentDetails: async (
              _: any,
              { userPropertyId }: { userPropertyId: string },
              context: AdminContext
            ) => {
              if (!context?.admin?.adminId) {
                throw new GraphQLError("Not authenticated", {
                  extensions: { code: "UNAUTHENTICATED" },
                });
              }
        
              try {
                const assignmentDetails =
                  await PropertyManagementService.getPropertyAssignmentDetails(
                    userPropertyId
                  );
                return assignmentDetails;
              } catch (error) {
                console.error("❌ Error fetching assignment details:", error);
                throw new GraphQLError("Failed to fetch assignment details", {
                  extensions: {
                    code: "INTERNAL_ERROR",
                    message: error instanceof Error ? error.message : String(error),
                  },
                });
              }
            },

    },
    Mutation: {
        createManagedPropertyByUser: async (
            _: any,
            { input }: { input: any },
            context: PlatformUserContext
        ) => {
            if (!context.user) {
                throw new GraphQLError("Not authenticated", {
                    extensions: { code: "UNAUTHENTICATED" },
                });
            }

            try {
                const property = await PropertyService.createPropertyByUser(
                    input,
                    context.user.userId
                );
                console.log(property);
                return property;
            } catch (error) {
                console.log(error)
                console.error("Create property error:", error);
                throw new GraphQLError("Failed to create property", {
                    extensions: { code: "INTERNAL_ERROR" },
                });
            }
        },

        assignPropertyToAgent: async (
            _: any,
            { input }: { input: { userPropertyId: string; agentId: string } },
            context: AdminContext
        ) => {
            if (!context?.admin?.adminId) {
                throw new GraphQLError("Not authenticated", {
                    extensions: { code: "UNAUTHENTICATED" },
                });
            }

            try {
                const result = await PropertyManagementService.assignPropertyToAgent({
                    userPropertyId: input.userPropertyId,
                    agentId: input.agentId,
                    assignedByAdminId: context.admin.adminId,
                });

                return {
                    success: result.success,
                    message: result.message,
                    data: result.data,
                };
            } catch (error) {
                console.error("❌ Error assigning property to agent:", error);
                throw new GraphQLError("Failed to assign property to agent", {
                    extensions: {
                        code: "INTERNAL_ERROR",
                        message: error instanceof Error ? error.message : String(error),
                    },
                });
            }
        },
        reassignPropertyToAgent: async (
              _: any,
              { input }: { input: { userPropertyId: string; newAgentId: string } },
              context: AdminContext
            ) => {
              if (!context?.admin?.adminId) {
                throw new GraphQLError("Not authenticated", {
                  extensions: { code: "UNAUTHENTICATED" },
                });
              }
        
              try {
                const result =
                  await PropertyManagementService.reassignPropertyToAgent({
                    userPropertyId: input.userPropertyId,
                    newAgentId: input.newAgentId,
                    reassignedByAdminId: context.admin.adminId,
                  });
        
                return {
                  success: result.success,
                  message: result.message,
                  previousAgent: result.previousAgent,
                  data: result.data,
                };
              } catch (error) {
                console.error("❌ Error reassigning property to agent:", error);
                throw new GraphQLError("Failed to reassign property to agent", {
                  extensions: {
                    code: "INTERNAL_ERROR",
                    message: error instanceof Error ? error.message : String(error),
                  },
                });
              }
            },
          unassignPropertyFromAgent: async (
                _: any,
                { input }: { input: { userPropertyId: string } },
                context: AdminContext
              ) => {
                if (!context?.admin?.adminId) {
                  throw new GraphQLError("Not authenticated", {
                    extensions: { code: "UNAUTHENTICATED" },
                  });
                }
          
                try {
                  const result =
                    await PropertyManagementService.unassignPropertyFromAgent({
                      userPropertyId: input.userPropertyId,
                      unassignedByAdminId: context.admin.adminId,
                    });
          
                  return {
                    success: result.success,
                    message: result.message,
                    previousAgent: result.previousAgent,
                    data: result.data,
                  };
                } catch (error) {
                  console.error("❌ Error unassigning property from agent:", error);
                  throw new GraphQLError("Failed to unassign property from agent", {
                    extensions: {
                      code: "INTERNAL_ERROR",
                      message: error instanceof Error ? error.message : String(error),
                    },
                  });
                }
              },  

    }

}