import { GraphQLError } from "graphql";
import { AdminContext } from "./auth.resolvers";
import { FarmService } from "../services/farm.service";
import { PlatformUserContext } from "../../user/user.resolvers";

export const farmResolvers = {
  Query: {
    getFarms: async (
      _: any,
      { input }: { input: { page: number; limit: number; searchTerm?: string } }
    ) => {
      const results = await FarmService.getFarms(
        input.page,
        input.limit,
        input.searchTerm
      );
      return results;
    },

    // getFarmsByUser: async (
    //   _: any,
    //   { input }: { input: { userId: string; page: number; limit: number } }
    // ) => {
    //   const results = await FarmService.getFarmsByUser(
    //     input.userId,
    //     input.page,
    //     input.limit
    //   );
    //   return results;
    // },

    getFarmById: async (_: any, { id }: { id: string }) => {
      try {
        const result = await FarmService.getFarmById(id);

        return {
          ...result.property,
          seo: result.seo,
          images: result.images,
          owner: result.owner,
        };
      } catch (error) {
        console.error("❌ Resolver error in getFarmById:", error);
        throw new Error("Unable to fetch farm details");
      }
    },
    getPendingApprovalFarms: async (
      _: any,
      { input }: { input: { page: number; limit: number; searchTerm?: string } }
    ) => {
      const results = await FarmService.getPendingApprovalFarms(
        input.page,
        input.limit,
        input.searchTerm
      );
      return results;
    },

    getRejectedFarms: async (
      _: any,
      { input }: { input: { page: number; limit: number; searchTerm?: string } }
    ) => {
      const results = await FarmService.getRejectedFarms(
        input.page,
        input.limit,
        input.searchTerm
      );
      return results;
    },

    getApprovedFarms: async (
      _: any,
      { input }: { input: { page: number; limit: number; searchTerm?: string } }
    ) => {
      const results = await FarmService.getApprovedFarms(
        input.page,
        input.limit,
        input.searchTerm
      );
      return results;
    },

    getFarmsPostedByAdmin: async (
      _: any,
      {
        input,
      }: {
        input: {
          page: number;
          limit: number;
          searchTerm?: string;
          approvalstatus?: "APPROVED" | "REJECTED" | "PENDING";
        };
      },
      context: AdminContext
    ) => {
      if (!context.admin) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const results = await FarmService.getFarmsPostedByAdmin(
        context.admin.adminId,
        input.page,
        input.limit,
        input.approvalstatus,
        input.searchTerm
      );

      return results;
    },

    getFarmsTotals: async (
      _: any,
      { state, district }: { state?: string; district?: string }
    ) => {
      const totals = await FarmService.getFarmsTotals(state, district);
      return totals;
    },

    getTopFarms: async (
      _: any,
      { input }: { input: { userId?: string; page:number ,limit: number } }
    ) => {
      try {
        const properties = await FarmService.getTopFarms(
          input?.userId,
          input.page,
          input.limit
        );
        
      // console.log("properties : " , properties);
        return properties;
      } catch (error) {
        console.error("❌ Resolver error in topFarms:", error);
        throw new Error("Unable to fetch top farms");
      }
    },

    getNewFarms: async (
      _: any,
      { input }: { input: { searchTerm?:string,  page:number ,limit: number } }
    ) => {
      try {
        const properties = await FarmService.getNewFarms(
          input.page,
          input.limit,
          input.searchTerm
        );
        
      // console.log("properties : " , properties);
        return properties;
      } catch (error) {
        console.error("❌ Resolver error in NewFarms:", error);
        throw new Error("Unable to fetch New farms");
      }
    },
  },

  Mutation: {
    createFarmByAdmin: async (
      _: any,
      { input }: { input: any },
      context: AdminContext
    ) => {
      if (!context.admin) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      try {
        const farm = await FarmService.createFarmByAdmin(
          { ...input },
          context.admin.adminId,
          "published"
        );
        return farm;
      } catch (error) {
        console.error("Create farm error:", error);
        throw new GraphQLError("Failed to create farm", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    createFarmByUser: async (
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
        const property = await FarmService.createFarmByUser(
          input,
          context.user.userId
        );
        return property;
      } catch (error) {
        if (error instanceof GraphQLError) {
          throw error; // This is crucial!
        }
        // Handle other errors
        throw new GraphQLError("Failed to create property", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    updateFarmSeo: async (
      _: any,
      { input }: { input: any },
      context: AdminContext
    ) => {
      if (!context.admin) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      try {
        const updatedSeo = await FarmService.updateSeoFarm(input);
        return updatedSeo;
      } catch (error: any) {
        console.error("❌ Failed to update SEO for farm:", error);
        throw new GraphQLError(error.message || "SEO update failed", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
  },
};
