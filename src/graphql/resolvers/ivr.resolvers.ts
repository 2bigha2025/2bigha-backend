import { KommunoService } from "../services/kommuno.service";
import { GraphQLError } from "graphql"
import { AdminContext } from "./auth.resolvers";

export const ivrResolvers = {
    Mutation: {
        makeKommunoCall: async (_: any, { input }: any, context: AdminContext) => {
            if (!context.admin?.adminId) {
                throw new GraphQLError("Authentication required", {
                    extensions: { code: "UNAUTHENTICATED" },
                })
            }

            try {
                const { sessionId, data } = await KommunoService.clickToCall(input,context.admin?.adminId);
                return {
                    success: true,
                    sessionId:sessionId[0].sessionId,
                    message: "Call initiated successfully",
                    data,
                };
            } catch (error: any) {
                console.error("Kommuno Call Error:", error.message);
                throw new GraphQLError(`Failed to create call logs: ${(error as Error).message}`, {
                    extensions: { code: "INTERNAL_ERROR" },
                })
            }
        },
    },
};
