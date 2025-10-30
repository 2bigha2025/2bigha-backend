import { pgTable, serial, text, timestamp, boolean, jsonb, uuid, pgEnum, integer } from "drizzle-orm/pg-core"
import { stat } from "fs"
import { adminUsers } from "./admin-user"


export const call_status = pgEnum("call_status", [
    "CONNECTED",
    "NOT ANSWERED",
    "BUSY",
    "WRONG NUMBER",
    "VOICEMAIL LEFT",
    "CALLBACK SCHEDULED",
    "INTERESTED",
    "NOT INTERESTED",
    "CALL BACK LATER",
    "DISCONNECTED",
    "INFORMATION SEND",
    "FOLLOW UP REQUIRED",
    "MEETING SCHEDULED",
    "LEAD CONVERTED",
    "INVALID NUMBER",
    "LEFT MESSAGE",
    "WRONG CONTACT PERSON",
    "CUSTOMER QUERY RESOLVED",
    "DO NOT CALL REQUEST",
    "CALL CONNECTED",
    "PROPOSAL SUBMITTED",
    "OTHER",
])
export const leads = pgTable("leads", {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id"),

})




const groups = pgTable("groups", {
    id: uuid("id").defaultRandom().primaryKey(),
    Group_name: text("group_name").notNull(),
    Group_icon: text("group_icon"),
    isavailable: boolean("is_available").notNull().default(true),
    addedby: uuid("added_by").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
})


const broadcast = pgTable("broadcast", {
    id: uuid("id").defaultRandom().primaryKey(),
    campaign_name: text("campaign_name").notNull(),
    connection_phone: text("phone").notNull(),
    Template_id: text("template_id").notNull(),
    message: text("message").notNull(),
    group_id: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
    sent_at: timestamp("sent_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

const calllogs = pgTable("calllogs", {
    id: uuid("id").defaultRandom().primaryKey(),
    lead_id: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
    call_time: timestamp("call_time").notNull().defaultNow(),
    duration_seconds: serial("duration_seconds").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
})