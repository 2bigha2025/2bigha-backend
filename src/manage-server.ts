import express from "express";
import http from "http";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import dotenv from "dotenv";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { constraintDirective } from "graphql-constraint-directive";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { graphqlUploadExpress } from "graphql-upload";
import { platformUserTypeDefs } from "./user/user.types";
import { platformUserResolvers } from "./user/user.resolvers";
import { getSession } from "./config/auth";
dotenv.config();
interface MyContext {
    token?: string;
    admin?: {
        adminId: string;
        email: string;  
        roles: string[];
    };
}
const startServer = async () => {
    const app = express();
    const httpServer = http.createServer(app);
    // ✅ Build schema with constraint directive    
    const schema = makeExecutableSchema({
           typeDefs: [platformUserTypeDefs],
           resolvers: [platformUserResolvers]
    });
    await constraintDirective()(schema);
    const server = new ApolloServer<MyContext>({
        schema,
        plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    });
    await server.start();
    // ✅ Middleware order matters
    app.use(cors());
    app.use(express.json({ limit: "100mb" }));
    app.use(express.urlencoded({ limit: "100mb", extended: true }));
    app.use(
        graphqlUploadExpress({ maxFileSize: 100 * 1024 * 1024, maxFiles: 10 })
    );
    app.use(
        "/graphql",
        expressMiddleware(server, {
            context: async ({ req }) => {
                const token =
                    req.headers.authorization?.replace('Bearer ', '') || req.headers.token
                let user = null
                if (token) {
                    const session = getSession(token as string)
                    if (session) {
                        user = {
                            userId: session.userId,
                            email: session.email,
                            roles: session.role.split(','),
                        }
                    }
                }

                return { token, user, req }
            },
        })
    );
    const PORT = process.env.PORT || 5002;
    httpServer.listen(PORT, () => {
        console.log(`🚀Management Server ready at http://localhost:${PORT}/graphql`);
    });
}
startServer().catch((error) => {
    console.error("Failed to start server:", error);
});
