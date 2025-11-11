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

  // ✅ Build schema with constraint directive
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

  // Increase payload size limit (JSON + URL-encoded)
  app.use(express.json({ limit: '100mb' }))
  app.use(express.urlencoded({ limit: '100mb', extended: true }))

  // Handle GraphQL file uploads
  app.use(graphqlUploadExpress({ maxFileSize: 100 * 1024 * 1024, maxFiles: 10 }))

  // Apollo middleware
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


  // Kommuno webhook for call events
  app.post("/kommuno/callback", express.json(), async (req, res) => {
    try {
      console.log(">>>>>>>Callback>>>>", req,res);
      const payload = req.body;
      console.log("Kommuno callback received:", payload);

      // Determine the type of payload
      if (payload.live_event) {
        // This is a live call event (ringing, connected, etc.)
        console.log("Live Event:", payload.live_event);
        // TODO: insert into kommuno_call_events table
      } else if (payload.call_details?.live_event === "evt_completed_with_recording") {
        // This is a completed call with recording
        console.log("Recording Event:", payload.call_details.recording_details?.recording_path);
        // TODO: insert into kommuno_recordings table
      } else {
        console.log("Other callback payload");
      }

      // Always respond 200 quickly
      res.status(200).json({ status: "ok" });
    } catch (err) {
      console.error("Kommuno callback error:", err);
      res.status(500).json({ error: "internal error" });
    }
  });



  const PORT = process.env.ADMIN_PORT || 5000
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`)
  })
}

startServer().catch((err) => {
  console.error('Failed to start server:', err)
})
