import { GraphQLError } from "graphql";
import { PropertyService } from "../services/property.services";
import { AdminContext } from "./auth.resolvers";

export interface Context {
  user?: {
    userId: number;
    email: string;
    role: string;
  };
  req: any;
}

export const propertyResolvers = {
  Query: {
    properties: async (
      _: any,
      { input }: { input: { page: number; limit: number; searchTerm?: string } }
    ) => {
      const results = await PropertyService.getProperties(
        input.page,
        input.limit,
        input.searchTerm
      );

      return results;
    },
    getPendingApprovalProperties: async (
      _: any,
      { input }: { input: { page: number; limit: number; searchTerm?: string } }
    ) => {
      const results = await PropertyService.getPendingApprovalProperties(
        input.page,
        input.limit,
        input.searchTerm // pass searchTerm here
      );

      console.log(results);

      return results;
    },
    getRejectedProperties: async (
      _: any,
      { input }: { input: { page: number; limit: number; searchTerm?: string } }
    ) => {
      const results = await PropertyService.getRejectedProperties(
        input.page,
        input.limit,
        input.searchTerm
      );

      console.log(results);

      return results;
    },

    getApprovedProperties: async (
      _: any,
      { input }: { input: { page: number; limit: number; searchTerm?: string } }
    ) => {
      const results = await PropertyService.getApprovedProperties(
        input.page,
        input.limit,
        input.searchTerm
      );

      console.log(results);

      return results;
    },

    getPropertiesPostedByAdmin: async (
      _: any,
      {
        input,
      }: { input: { page: number; limit: number; searchTerm?: string; approvalstatus?: "APPROVED" | "REJECTED" | "PENDING" } },
      context: AdminContext
    ) => {
      if (!context.admin) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      const results = await PropertyService.getPropertiesPostedByAdmin(
        context?.admin?.adminId,
        input.page,
        input.limit,
        input?.approvalstatus ,
        input?.searchTerm
      );

      return results;
    },

    getPropertyTotals: async (
      _: any,
      { state, district }: { state?: string; district?: string }
    ) => {
      const totals = await PropertyService.getPropertyTotals(state, district);
      return totals;
    },

    topProperties: async () => {
      try {
        const properties = await PropertyService.getTopProperties('',5);

        return properties.map((entry) => ({
          ...entry.property,
          seo: entry.seo,
          images: entry.images,
          user: entry.user,
        }));
      } catch (error) {
        console.error("❌ Resolver error in topProperties:", error);
        throw new Error("Unable to fetch top properties");
      }
    },
  },

  Mutation: {
    createProperty: async (
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
        const property = await PropertyService.createProperty(
          input,
          context.admin.adminId,
          "published"
        );

        return property;
      } catch (error) {
        console.error("Create property error:", error);
        throw new GraphQLError("Failed to create property", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
    updatePropertySeo: async (
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
        const updatedSeo = await PropertyService.updateSeoProperty(input);
        return updatedSeo;
      } catch (error: any) {
        console.error("❌ Failed to update SEO:", error);
        throw new GraphQLError(error.message || "SEO update failed", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
  },
};
