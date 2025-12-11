import {
  pgTable,
  text,
  timestamp,
  boolean,
  uuid,
  pgEnum,
  bigint,
  json,
  jsonb
} from "drizzle-orm/pg-core";
import { adminUsers } from "./admin-user";
import { properties } from "./property";
import { platformUsers } from "./platform-user";

export const callStatusTypeEnum = pgEnum("call_status", [
  "",
  "CONNECTED",
  "MISSED CALLED",
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
]);



export const lead = pgTable("lead", {
  Id: uuid("id").defaultRandom().primaryKey(),
  leadType: text("lead_type"),
  leadSource: text("lead_source"),
  groupId: uuid("group_id").references(() => propertyGroups.Id, { onDelete: "set null", }),
  clientId: uuid("client_id").references(() => platformUsers.id, { onDelete: "set null", }),
  createdBy: uuid("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  note: text('note')
});

export const propertyMeta = pgTable("property_meta", {
  Id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null", }),
  leadId: uuid("lead_id").references(() => lead.Id, { onDelete: "set null", }),
  groupId: uuid("group_id").references(() => propertyGroups.Id, { onDelete: "set null", }),
  assignedTo: uuid("assigned_to").references(() => adminUsers.id, { onDelete: "set null", }),
  assignedBy: uuid("assigned_by").references(() => adminUsers.id, { onDelete: "set null", }),
});

export const propertyGroups = pgTable("property_group", {
  Id: uuid("id").defaultRandom().primaryKey(),
  groupName: text("name").notNull(),
  groupIcon: text("icon"),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => adminUsers.id, {
    onDelete: "set null",
  }),
});

export const callLogs = pgTable("call_logs", {
  Id: bigint("id", { mode: "number" })
    .primaryKey()
    .$defaultFn(() => {
      const timestamp = Date.now().toString(); // 13 digits
      const random = Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, "0"); // +3 digits
      return Number(timestamp + random); // 16 digits total
    }),
  leadId: uuid("lead_id").references(() => lead.Id, {
    onDelete: "set null",
  }),
  propertyId: text("property_id"),
  status: callStatusTypeEnum(""),
  systemStatus: text("system_status"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  followUp: timestamp("follow_up"),
  feedback: text("feedback"),
  clientId: uuid("client_id").references(() => platformUsers.id, {
    onDelete: "set null",
  }),
  AgentId: uuid("agent_id").references(() => adminUsers.id, {
    onDelete: "set null",
  }),
  clientNumber: text("client_number"),
  agentNumber: text("agent_number"),
  duration: text("duration"),
  longCode: text("long_code"),
  recordingUrl: text("recording_url"),
  callType: text("call_type"),
  disconnectedBy: text("disconnected_by"),
});

export const propertyNotes = pgTable("property_notes", {
  Id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id").references(() => properties.id, {
    onDelete: "set null",
  }),
  note: text("note"),
  createdBy: uuid("created_by").references(() => adminUsers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updateAt: timestamp("update_at").defaultNow(),
});

export const callHistoryNotes = pgTable("call_history_notes", {
  Id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id").references(() => lead.Id, {
    onDelete: "set null",
  }),
  note: text("note"),
  createdBy: uuid("created_by").references(() => adminUsers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updateAt: timestamp("update_at").defaultNow(),
});


// whatsapp template and broadcast tables
export const template = pgTable("template", {
  Id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  language: text("language"),
  category: text("category"),
  headerFormat: text("header_format"),
  header: text('header'),
  body: text('body'),
  footer: text('footer'),
  buttonType: text('button_type'),
  buttons: jsonb('buttons'),
  status: text("status"),
  waTemplateId: text('wa_template_id'),
  variablePresent: text('variable_present'),
  createdBy: uuid("created_by").references(() => adminUsers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const campaign = pgTable("campaign", {
  Id: uuid("id").defaultRandom().primaryKey(),
  campaignName: text("campaign_name").notNull(),
  templateId: uuid("template_id").references(() => template.Id, {
    onDelete: "set null",
  }),
  TemplateName: text("template_name").notNull(),
  createdBy: uuid("created_by").references(() => adminUsers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const broadcast = pgTable("broadcast", {
  Id: uuid("id").defaultRandom().primaryKey(),
  campaignId: uuid("campaign_id").references(() => campaign.Id, {
    onDelete: "set null",
  }),
  phoneNumbers: jsonb("phone_numbers"),
  groupId: uuid("group_id").references(() => propertyGroups.Id, {
    onDelete: "set null",
  }),
  callStatus: callStatusTypeEnum(""),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  sentBy: uuid("sent_by").references(() => adminUsers.id, {
    onDelete: "set null",
  }),
});


// whatsapp chat tables
export const chatThread = pgTable("chat_thread", {
  Id: uuid("id").defaultRandom().primaryKey(),
  leadId: uuid("lead_id").references(() => lead.Id, { onDelete: "cascade" }).notNull(),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => adminUsers.id, { onDelete: "set null"
  }),
});

export const chatMessage = pgTable("chat_message", {
  Id: uuid("id").defaultRandom().primaryKey(),
  threadId: uuid("thread_id").references(() => chatThread.Id, { onDelete: "cascade" }).notNull(),
  leadId: uuid("lead_id").references(() => lead.Id, { onDelete: "cascade" }).notNull(),
  direction: text("direction").notNull(), // "incoming" | "outgoing"
  msgType: text("msg_type").notNull(), // "template" | "text" | "media" | "reply"
  message: text("message"),
  meta: jsonb("meta"), // store template metadata, buttons, or other JSON
  interaktMessageId: text("interakt_message_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: uuid("created_by").references(() => adminUsers.id, { onDelete: "set null"  }),
});
