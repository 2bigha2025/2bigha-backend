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

import { typeDefs } from './graphql/types'
import { resolvers } from './graphql/resolvers'
import { getSession } from './config/auth'

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
        typeDefs,
        resolvers,
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
    app.use(graphqlUploadExpress({ maxFileSize: 10 * 1024 * 1024, maxFiles: 5 }))

    app.use(
        '/graphql',
        expressMiddleware(server, {
            context: async ({ req }) => {
                const token =
                    req.headers.authorization?.replace('Bearer ', '') || req.headers.token

                let admin = null
                if (token) {
                    const session = getSession(token as string)
                    if (session) {
                        admin = {
                            adminId: session.userId,
                            email: session.email,
                            roles: session.role.split(','),
                        }
                    }
                }

                return { token, admin, req }
            },
        })
    )

    const PORT = process.env.ADMIN_PORT || 5000
    httpServer.listen(PORT, () => {
        console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`)
    })
}

startServer().catch((err) => {
    console.error('Failed to start server:', err)
})
