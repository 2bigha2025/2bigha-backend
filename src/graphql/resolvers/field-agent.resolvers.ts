import { FieldAgentService } from "../services/field-agent.service";
import { GraphQLError } from "graphql";
import { AdminContext } from "./auth.resolvers";

/**
 * Field Agent Resolver
 * Handles field agent operations like viewing assigned properties,
 * marking visits, and uploading visit media
 */
export const FieldAgentResolver = {
  Query: {
    /**
     * Get all properties assigned to the field agent
     * Includes pagination, property details, plan info, and visit stats
     */
    getAssignedProperties: async (
      _: any,
      { page = 1, limit = 10 }: { page?: number; limit?: number },
      context: AdminContext
    ) => {
      if (!context?.admin?.adminId) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      try {
        const result = await FieldAgentService.getAssignedProperties(
          context.admin.adminId,
          page,
          limit
        );
        return result;
      } catch (error) {
        console.error("❌ Error fetching assigned properties:", error);
        throw new GraphQLError(
          error instanceof Error ? error.message : "Failed to fetch assigned properties",
          {
            extensions: { code: "INTERNAL_ERROR" },
          }
        );
      }
    },

    /**
     * Get detailed information about a specific assigned property
     */
    getAssignedPropertyDetails: async (
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
        const result = await FieldAgentService.getAssignedPropertyDetails(
          context.admin.adminId,
          userPropertyId
        );
        return result;
      } catch (error) {
        console.error("❌ Error fetching property details:", error);
        throw new GraphQLError(
          error instanceof Error ? error.message : "Failed to fetch property details",
          {
            extensions: { code: "INTERNAL_ERROR" },
          }
        );
      }
    },

    /**
     * Get visit history for a specific assigned property
     */
    getPropertyVisitHistory: async (
      _: any,
      {
        userPropertyId,
        page = 1,
        limit = 20,
      }: { userPropertyId: string; page?: number; limit?: number },
      context: AdminContext
    ) => {
      if (!context?.admin?.adminId) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      try {
        const result = await FieldAgentService.getPropertyVisitHistory(
          context.admin.adminId,
          userPropertyId,
          page,
          limit
        );
        return result;
      } catch (error) {
        console.error("❌ Error fetching visit history:", error);
        throw new GraphQLError(
          error instanceof Error ? error.message : "Failed to fetch visit history",
          {
            extensions: { code: "INTERNAL_ERROR" },
          }
        );
      }
    },

    /**
     * Get all media files uploaded for a specific visit
     */
    getVisitMedia: async (
      _: any,
      { visitId }: { visitId: string },
      context: AdminContext
    ) => {
      if (!context?.admin?.adminId) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      try {
        const media = await FieldAgentService.getVisitMedia(visitId);
        return media;
      } catch (error) {
        console.error("❌ Error fetching visit media:", error);
        throw new GraphQLError(
          error instanceof Error ? error.message : "Failed to fetch visit media",
          {
            extensions: { code: "INTERNAL_ERROR" },
          }
        );
      }
    },

    /**
     * Get field agent dashboard statistics
     */
    getAgentDashboardStats: async (
      _: any,
      __: any,
      context: AdminContext
    ) => {
      if (!context?.admin?.adminId) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      try {
        const stats = await FieldAgentService.getAgentDashboardStats(
          context.admin.adminId
        );
        return stats;
      } catch (error) {
        console.error("❌ Error fetching dashboard stats:", error);
        throw new GraphQLError(
          error instanceof Error ? error.message : "Failed to fetch dashboard statistics",
          {
            extensions: { code: "INTERNAL_ERROR" },
          }
        );
      }
    },
  },

  Mutation: {
    /**
     * Mark a property visit (create new visit record)
     * Automatically decrements visitsRemaining and increments visitsUsed
     */
    markPropertyVisit: async (
      _: any,
      { input }: { input: { userPropertyId: string; notes?: string; visitDate?: string } },
      context: AdminContext
    ) => {
      if (!context?.admin?.adminId) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      try {
        const result = await FieldAgentService.markPropertyVisit({
          agentId: context.admin.adminId,
          userPropertyId: input.userPropertyId,
          notes: input.notes,
          visitDate: input.visitDate ? new Date(input.visitDate) : undefined,
        });

        return {
          success: result.success,
          message: result.message,
          visitId: result.visitId,
          data: result.data,
        };
      } catch (error) {
        console.error("❌ Error marking property visit:", error);
        throw new GraphQLError(
          error instanceof Error ? error.message : "Failed to mark property visit",
          {
            extensions: { code: "INTERNAL_ERROR" },
          }
        );
      }
    },

    /**
     * Upload media files for a property visit
     * Supports images and videos
     */
    uploadVisitMedia: async (
      _: any,
      { input }: { input: { visitId: string; mediaFiles: any[] } },
      context: AdminContext
    ) => {
      if (!context?.admin?.adminId) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      try {
        // Resolve file uploads
        const resolvedFiles = await Promise.all(
          input.mediaFiles.map(async (file: any) => {
            if (file.promise) {
              return await file.promise;
            }
            return file;
          })
        );

        const result = await FieldAgentService.uploadVisitMedia({
          agentId: context.admin.adminId,
          visitId: input.visitId,
          mediaFiles: resolvedFiles,
        });

        return {
          success: result.success,
          message: result.message,
          uploadedCount: result.uploadedCount,
          failedCount: result.failedCount,
          media: result.media,
        };
      } catch (error) {
        console.error("❌ Error uploading visit media:", error);
        throw new GraphQLError(
          error instanceof Error ? error.message : "Failed to upload visit media",
          {
            extensions: { code: "INTERNAL_ERROR" },
          }
        );
      }
    },
  },
};
