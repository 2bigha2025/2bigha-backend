import express from 'express'
import http from 'http'
import cors from 'cors'
import dotenv from 'dotenv'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer'
import { graphqlUploadExpress } from 'graphql-upload'
import { makeExecutableSchema } from '@graphql-tools/schema'
import { constraintDirective } from 'graphql-constraint-directive'
import { platformUserTypeDefs } from "./user/user.types"
import { getSession } from './config/auth'
import { platformUserResolvers } from './user/user.resolvers'
import { mapPropertiesTypeDefs } from './graphql/types/map-properties.types'
import { mapPropertiesResolvers } from './graphql/resolvers/map-properties.resolvers'
import { blogResolvers } from './graphql/resolvers/blog.resolvers'
import { blogTypeDefs } from './graphql/types/blog.types'
import { userPropertyTypeDefs } from './graphql/types/save-user-property.types'
import { savedPropertiesResolvers } from './graphql/resolvers/saved-properties.resolvers'
import { geoJsonTypeDefs } from './graphql/types/geoJson.types'
import { geoJsonResolvers } from './graphql/resolvers/geo-json.resolvers'
import { farmsTypeDefs } from './graphql/types/farms.types'
import { farmResolvers } from './graphql/resolvers/farm.resolver'

dotenv.config()

interface MyContext {
    token?: string
    admin?: {
        adminId: string
        email: string
        roles: string[]
    }
}

const startServer = async () => {
    const app = express()
    const httpServer = http.createServer(app)

    // Apply constraint directive and build schema
    const schema = makeExecutableSchema({
        typeDefs: [platformUserTypeDefs, mapPropertiesTypeDefs, blogTypeDefs, userPropertyTypeDefs, geoJsonTypeDefs, farmsTypeDefs],
        resolvers: [platformUserResolvers, mapPropertiesResolvers, blogResolvers, savedPropertiesResolvers, geoJsonResolvers, farmResolvers],
    })

    await constraintDirective()(schema)

    const server = new ApolloServer<MyContext>({
        schema,
        plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
    })

    await server.start()

    // ✅ Middleware order matters
    app.use(cors())
    app.use(express.json())
    app.use(graphqlUploadExpress({ maxFileSize: 5 * 1024 * 1024, maxFiles: 6 }))

    app.use(
        '/graphql',
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
    )

    const PORT = process.env.ADMIN_PORT || 5001
    httpServer.listen(PORT, () => {
        console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`)
    })
}

startServer().catch((err) => {
    console.error('Failed to start server:', err)
})
