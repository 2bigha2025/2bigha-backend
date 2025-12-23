import { PropertyManagementService } from "../services/property-management.service"
import { GraphQLError } from "graphql";
import { PropertyService } from "../services/property.services";
import { PlatformUserContext } from "../../user/user.resolvers";
import { AdminContext } from "./auth.resolvers";
export const PropertyManagementResolver = {
  Query:{

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
        { page, limit , searchTerm }: { page: number, limit:number ,searchTerm?:string },
        context: AdminContext
    ) => {

        if (!context?.admin?.adminId) {
            throw new GraphQLError("Not authenticated", {
                extensions: { code: "UNAUTHENTICATED" },
            });
        }
        const result = await PropertyManagementService.getAllManagedProperties(page,limit,searchTerm)
        console.log(result, "It is from resolver")
        return {
            meta: result.meta,
            data: result.rows
        }
    }

  },
  Mutation:{
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
    }

  }

}