import { pgTable, serial, text, timestamp, boolean, jsonb, uuid, } from "drizzle-orm/pg-core"
import { stat } from "fs"

export const landStatuseads = pgTable("crm_models", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  contact_number: text("contact_number"),
  phone:text("phone"),
  email: text("email"),
  address: text("address"),
  landsize: text("landsize"),
  landprice: text("price"),
  agent_name: text("agent_name"),
  agent_contact: text("agent_contact"),
  property_type: text("property_type"),
  state:text("state"),
  vilage:text("village"),
  district:text("district"),
  pincode:text("pincode"),
  khasra_number:text("khasra_number"),
  road_connection:text("road_connection"),
  coordinates:text("coordinates"),
  call_status: text("call_status").default("available"), // available, sold, pending
  nearest_landmark: text("nearest_landmark"),
  comments:text("comments"),
  //Image:Image[]
  team_member_id: uuid("team_member_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  //group_id: uuid("group_id").references(() => landStatuseads.id),

})