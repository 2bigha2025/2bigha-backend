import { GraphQLError } from "graphql";
import { PropertyService } from "../services/property.services";
import { AdminContext } from "./auth.resolvers";
import { PlatformUserService } from "../../user/user.services";
import { logError } from "../../utils/logger";

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
      { input }: { input: { page: number; limit: number; searchTerm?: string;} }
    ) => {
      const results = await PropertyService.getProperties(
        input.page,
        input.limit,
        input.searchTerm
      );

      return results;
    },
    getPropertyBySlug: async (
      _: any,
      { input }: { input: { slug: string; } }
  ) => {
      const results = await PropertyService.getPropertyBySlug(
          input.slug
      );

      return results;
  },

  
  getUser: async (_: any, { id }: { id: string }) => {
    try {
        const user = await PlatformUserService.findUserById(id);
        if (!user) {
            throw new GraphQLError("User not found", {
                extensions: { code: "NOT_FOUND" },
            });
        }

        return {
            id: user.id.toString(),

            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            isActive: user.isActive,

            createdAt: user.createdAt.toISOString(),
            profile: user.profile
                ? {
                    id: user.profile.id.toString(),
                    bio: user.profile.bio,
                    phone : user.profile.phone,
                    avatar: user.profile.avatar,
                    city: user.profile.city,
                    state: user.profile.state,
                    specializations: user.profile.specializations,
                    serviceAreas: user.profile.serviceAreas,
                    languages: user.profile.languages,
                    experience: user.profile.experience,
                    rating: user.profile.rating,
                    totalReviews: user.profile.totalReviews,
                }
                : null,
        };
    } catch (error) {
        logError("Failed to get user", error as Error, { id });
        throw new GraphQLError("Failed to get user", {
            extensions: { code: "INTERNAL_ERROR" },
        });
    }
},
    getPendingApprovalProperties: async (
      _: any,
      { input }: { input: { page: number; limit: number; searchTerm?: string; availablilityStatus?:"MANAGED"} }
    ) => {
      const results = await PropertyService.getPendingApprovalProperties(
        input.page,
        input.limit,
        input.searchTerm, // pass searchTerm here
        input.availablilityStatus
      );

      console.log(results);

      return results;
    },
    getRejectedProperties: async (
      _: any,
      { input }: { input: { page: number; limit: number; searchTerm?: string;availablilityStatus?:"MANAGED" } }
    ) => {
      const results = await PropertyService.getRejectedProperties(
        input.page,
        input.limit,
        input.searchTerm,
        input.availablilityStatus
      );

      console.log(results);

      return results;
    },

    getApprovedProperties: async (
      _: any,
      { input }: { input: { page: number; limit: number; searchTerm?: string;availablilityStatus?:"MANAGED" } }
    ) => {
      const results = await PropertyService.getApprovedProperties(
        input.page,
        input.limit,
        input.searchTerm,
        input.availablilityStatus
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
    updateProperty: async (
      _: any,
      { id, input }: { id: string; input: any },
      context: AdminContext
    ) => {
      if (!context.admin) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      try {
        // Service expects listingId to match DB column used in WHERE clause
        const payload = { ...input, propertyId: id };
        const updated = await PropertyService.updateProperty(
          payload,
          context.admin.adminId,
          "published"
        );
        return updated;
      } catch (error) {
        console.error("Update property error:", error);
        throw new GraphQLError("Failed to update property", {
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
