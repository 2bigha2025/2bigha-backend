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
import { KommunoService } from './graphql/services/kommuno.service'
import { typeDefs } from './graphql/types'
import { resolvers } from './graphql/resolvers'
import { getSession } from './config/auth'
import { CrmWhatsAppService } from './graphql/services/crm-whatsapp.service'

import { Server as SocketIOServer } from "socket.io";


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

  // Build schema with constraint directive
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

  // socket
  const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*", // tighten later
  },
});


  // Middleware order matters
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
              phone: session.phone,
            }
          }
        }

        return { token, admin, req }
      },
    })
  )

  // socket
  io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join-thread", (threadId: string) => {
    socket.join(threadId);
    console.log(`Socket ${socket.id} joined thread ${threadId}`);
  });

  socket.on("leave-thread", (threadId: string) => {
    socket.leave(threadId);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});


  // Kommuno webhook for call events
  app.post("/kommuno/callback", express.json(), async (req, res) => {
    try {
      const payload = req.body;
      console.log("Kommuno callback received:", payload);

      // CASE 1: LIVE CALL EVENT (ringing, answered)
      if (payload.live_event) {
        await KommunoService.handleLiveEvent(payload);
      }

      // CASE 2: COMPLETED CALL EVENT
      else if (payload.call_details?.live_event === "evt_completed_with_recording") {
        await KommunoService.handleCompletedCall(payload);
      }

      // Always respond OK
      res.status(200).json({ status: "ok" });
    } catch (err) {
      console.error("Kommuno callback error:", err);
      res.status(500).json({ error: "internal error" });
    }
  });

  // Interakt WhatsApp webhook for incoming message
  app.post("/interakt/callback", async (req, res) => {
    try {
      const payload = req.body;
      console.log("Incoming WhatsApp Reply:", payload);

      // verify event type
      if (payload.data.message.chat_message_type === "CustomerMessage") {
        await CrmWhatsAppService.handleMessageReceived(payload.data);
      } else if (payload.entityType === "SERVER_EVENT") {

      } else if (payload.entityType === "USER_EVENT") {

      }

      if (payload.type === "message_api_sent" || payload.type === "message_api_delivered" || payload.type === "message_api_read") {
        const payloadData = payload.data
        const messageData = {
          messageId : payloadData.message.id,
          status : payloadData.message.message_status.toLowerCase(),
          receivedAt :payloadData.message.received_at_utc,
          seenAt :payloadData.message.seen_at_utc,
          deliveredAt :payloadData.message.delivered_at_utc
        }
        // console.log('>>>>>messageData>>>>>>>',messageData)
        await CrmWhatsAppService.handleMessageStatus(messageData);
      }

      // Always respond OK
      res.status(200).json({ status: "ok" });
    } catch (err) {
      console.error("WhatsApp Webhook callback error:", err);
      res.status(500).json({ error: "internal error" });
    }
  });


  const PORT = process.env.ADMIN_PORT || 5000
  httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`)
  })
}

export let io: SocketIOServer;


startServer().catch((err) => {
  console.error('Failed to start server:', err)
})