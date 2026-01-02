import jwt from "jsonwebtoken"
import { v4 as uuidv4 } from "uuid"

const JWT_SECRET: string = process.env.JWT_SECRET || "your-super-secret-jwt-key" as string;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24000000000000000h" as string;

export interface SessionData {
  userId: string
  email: string
  role: string
  sessionId: string
  phone: string
}

// In-memory session store (use Redis in production)
const sessions = new Map<string, SessionData>()

export function createSession(userId: string, email: string, role: string,phone?: string): string {
  const sessionId = uuidv4()
  const sessionData: SessionData = {
    userId,
    email,
    role,
    sessionId,
    phone
  }

  // Store session
  sessions.set(sessionId, sessionData)

  // Create JWT token
  //@ts-ignore
  const token = jwt?.sign(
    {
      userId,
      email,
      role,
      sessionId,
      phone,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  )


  return token
}

export function getSession(token: string): SessionData | null {
  try {

    const decoded = jwt.verify(token, JWT_SECRET) as any

    // if (!decoded.sessionId) {
    //   console.log("No sessionId found in token");
    //   return null;
    // }



    // const sessionData = sessions.get(decoded.sessionId);
    // if (!sessionData) {
    //   console.log("Session not found for sessionId:", decoded.sessionId);
    //   return null;
    // }

    // if (sessionData.userId !== decoded.userId) {
    //   console.log("UserId mismatch in session data");
    //   return null;
    // }

    // console.log(decoded)

    return decoded;
  } catch (error) {
    console.log("Invalid session token:", error)
    return null
  }
}

export function deleteSession(token: string): void {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    sessions.delete(decoded.sessionId)
  } catch (error) {
    // Token invalid, nothing to delete
  }
}

export function validateSession(token: string): boolean {
  return getSession(token) !== null
}
