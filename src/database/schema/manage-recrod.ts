import { pgTable, uuid, pgEnum, integer, timestamp, text, boolean, json,serial,unique } from "drizzle-orm/pg-core";
import { platformUsers } from "./platform-user";
import { properties } from "./property";
import { adminUsers } from "./admin-user";
// Schema for plans, orders, cart and user-property-plan mapping (with audit fields)

export const PlanType = pgEnum("PlanType", [
    "BASIC",
    "STANDARD",
    "PREMIUM"
])
// --- Order / Payment related enums ---
export const OrderStatus = pgEnum("OrderStatus", [
    "CREATED",
    "PROCESSING",
    "COMPLETED",
    "CANCELLED",
    "REFUNDED"
])

export const PaymentGateway = pgEnum("PaymentGateway", [
    "RAZORPAY"
])

export const CartStatus = pgEnum("CartStatus", [
    "ACTIVE",
    "PENDING",
    "CHECKED_OUT",
    "EXPIRED"
])

export const UserPropertyStatus = pgEnum("UserPropertyStatus", [
    "ACTIVE",
    "INACTIVE",
    "EXPIRED"
])
export const TransactionType = pgEnum("TransactionType", [
    "PAYMENT",
    "REFUND",
    "CAPTURE",
    "CHARGEBACK",
])

export const billingCycle = pgEnum("billingCycle",[
    "MONTHLY",
    "QUATERLY",
    "YEARLY"
])

export const TransactionStatus = pgEnum("TransactionStatus", [
    "INITIATED",
    "PENDING",
    "SUCCESS",
    "FAILED",
    "REFUNDED",
    "CHARGED_BACK",
])

export const Plan = pgTable("plan", {
    planId: serial("plan_id").primaryKey(),
    planName: PlanType("plan_name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
})
//CartStatus("status").notNull().default("ACTIVE")
export const planvariants = pgTable("planvariants", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id")
    .references(() => Plan.planId)
    .notNull(),
  billingCycle: billingCycle("billing_cycle").notNull().default("MONTHLY"),  // MONTHLY, QUARTERLY, YEARLY
  price: integer("price").notNull(),
  durationInDays: integer("duration_in_days").notNull(), 
  visitsAllowed: integer("visits_allowed").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})


// --- Cart table: holds selections the user intends to checkout later ---
export const cart = pgTable("cart", {
    cartId: uuid("cart_id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => platformUsers.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
    planId: integer("plan_id").references(() => Plan.planId, { onDelete: "set null" }),
    priceAtSelection: integer("price_at_selection").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: CartStatus("status").notNull().default("ACTIVE"),
    expiresAt: timestamp("expires_at"),
    metadata: json("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
})

// --- Orders table: includes Razorpay integration fields ---
export const orders = pgTable("orders", {
    orderId: uuid("order_id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => platformUsers.id, { onDelete: "set null" }),
    propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
    planId: integer("plan_id").references(() => Plan.planId, { onDelete: "set null" }),
    cartId: uuid("cart_id").references(() => cart.cartId, { onDelete: "set null" }),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: OrderStatus("status").notNull().default("CREATED"),
    paymentStatus: TransactionStatus("payment_status").notNull().default("PENDING"),
    paymentGateway: PaymentGateway("payment_gateway").notNull().default("RAZORPAY"),
    razorpayOrderId: text("razorpay_order_id"), // order id returned by Razorpay when creating an order
    razorpayPaymentId: text("razorpay_payment_id"), // payment id after successful capture
    razorpaySignature: text("razorpay_signature"), // signature to verify payment
    transactionId: text("transaction_id"), // internal transaction id or third-party id
    receipt: text("receipt"),
    notes: json("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow()
})

// --- Mapper table between user, property and plan with agent assignment and audit ---
    export const userProperty = pgTable("userproperty", {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: uuid("userid").references(() => platformUsers.id, { onDelete: "set null" }),
        propertyId: uuid("property_id").references(() => properties.id, { onDelete: "set null" }),
        planVariantId: integer("planvariant_id").references(() => planvariants.id, { onDelete: "set null" }),
        agentId: uuid("agent_id").references(() => adminUsers.id, { onDelete: "set null" }),
        assignedBy: uuid("assigned_by").references(() => adminUsers.id, { onDelete: "set null" }),
        assignedAt: timestamp("assigned_at"),
        startDate: timestamp("start_date"),
        endDate: timestamp("end_date"),
        visitsRemaining: integer("visits_remaining"),
        visitsUsed: integer("visits_useds"),
        status: UserPropertyStatus("status").notNull().default("ACTIVE"),
        active: boolean("active").notNull().default(true),
        createdAt: timestamp("created_at").notNull().defaultNow(),
        updatedAt: timestamp("updated_at").notNull().defaultNow()
    },
    (table)=>({
        uniqueKeyCombo: unique().on(table.userId, table.propertyId)
    })
)
// --- Order & Transaction history tables and enums ---


export const propertyVisits = pgTable("property_visits", {
  id: uuid("id").defaultRandom().primaryKey(),
  propertyId: uuid("property_id")
    .references(() => properties.id, { onDelete: "cascade" }),
  visitedBy: uuid("visited_by")           
    .references(() => adminUsers.id, { onDelete: "set null" }),
  visitDate: timestamp("visit_date").notNull().defaultNow(),
  notes: text("notes"),
  status: text("status").default("COMPLETED"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});

export const propertyVisitMedia = pgTable("property_visit_media", {
  id: uuid("id").defaultRandom().primaryKey(),
  visitId: uuid("visit_id")
    .references(() => propertyVisits.id, { onDelete: "cascade" }),
  mediaUrl: text("media_url").notNull(),
  mediaType: text("media_type").notNull(), 
  capturedAt: timestamp("captured_at").defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow()
});


// order_history: keeps immutable event records for order lifecycle changes
export const orderHistory = pgTable("order_history", {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").references(() => orders.orderId, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(), // e.g., STATUS_CHANGE, NOTE, REFUND_INITIATED
    actorType: text("actor_type"), // USER | ADMIN | SYSTEM | PAYMENT_GATEWAY
    actorId: uuid("actor_id"), // optional id of actor (user/admin)
    previousData: json("previous_data"), // snapshot before event
    newData: json("new_data"), // snapshot after event
    metadata: json("metadata"), // extra info
    createdAt: timestamp("created_at").notNull().defaultNow(),
})

// payment_transactions: log each payment/payment-related action (attempts, captures, refunds)
export const paymentTransactions = pgTable("payment_transactions", {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id").references(() => orders.orderId, { onDelete: "cascade" }),
    provider: PaymentGateway("provider").notNull().default("RAZORPAY"),
    providerOrderId: text("provider_order_id"), // razorpay_order_id
    providerTransactionId: text("provider_transaction_id"), // razorpay_payment_id
    type: TransactionType("type").notNull().default("PAYMENT"),
    status: TransactionStatus("status").notNull().default("INITIATED"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("INR"),
    fees: integer("fees"),
    tax: integer("tax"),
    captured: boolean("captured").notNull().default(false),
    refundedAmount: integer("refunded_amount").notNull().default(0),
    rawResponse: json("raw_response"), // store provider webhook/response payload
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Relationship map for business entities — used by resolvers/helpers to generate joins
export const appRelations = {
    platformUsers: {
        carts: {
            relation: "many",
            table: cart,
            fields: [platformUsers.id],
            references: [cart.userId],
        },
        orders: {
            relation: "many",
            table: orders,
            fields: [platformUsers.id],
            references: [orders.userId],
        },
        properties: {
            relation: "many",
            table: properties,
            fields: [platformUsers.id],
            references: [properties.ownerId],
        },
        userPropertyMappings: {
            relation: "many",
            table: userProperty,
            fields: [platformUsers.id],
            references: [userProperty.userId],
        },
    },
    properties: {
        owner: {
            relation: "one",
            table: platformUsers,
            fields: [properties.ownerId],
            references: [platformUsers.id],
        },
        carts: {
            relation: "many",
            table: cart,
            fields: [properties.id],
            references: [cart.propertyId],
        },
        orders: {
            relation: "many",
            table: orders,
            fields: [properties.id],
            references: [orders.propertyId],
        },
        userPropertyMappings: {
            relation: "many",
            table: userProperty,
            fields: [properties.id],
            references: [userProperty.propertyId],
        },
    },
    Plan: {
        carts: {
            relation: "many",
            table: cart,
            fields: [Plan.planId],
            references: [cart.planId],
        },
        orders: {
            relation: "many",
            table: orders,
            fields: [Plan.planId],
            references: [orders.planId],
        },
        userPropertyMappings: {
            relation: "many",
            table: userProperty,
            fields: [Plan.planId],
            references: [userProperty.planVariantId],
        },
    },
    cart: {
        user: {
            relation: "one",
            table: platformUsers,
            fields: [cart.userId],
            references: [platformUsers.id],
        },
        property: {
            relation: "one",
            table: properties,
            fields: [cart.propertyId],
            references: [properties.id],
        },
        plan: {
            relation: "one",
            table: Plan,
            fields: [cart.planId],
            references: [Plan.planId],
        },
        order: {
            relation: "one",
            table: orders,
            fields: [cart.cartId],
            references: [orders.cartId],
        },
    },
    orders: {
        user: {
            relation: "one",
            table: platformUsers,
            fields: [orders.userId],
            references: [platformUsers.id],
        },
        property: {
            relation: "one",
            table: properties,
            fields: [orders.propertyId],
            references: [properties.id],
        },
        plan: {
            relation: "one",
            table: Plan,
            fields: [orders.planId],
            references: [Plan.planId],
        },
        cart: {
            relation: "one",
            table: cart,
            fields: [orders.cartId],
            references: [cart.cartId],
        },
        history: {
            relation: "many",
            table: orderHistory,
            fields: [orders.orderId],
            references: [orderHistory.orderId],
        },
        transactions: {
            relation: "many",
            table: paymentTransactions,
            fields: [orders.orderId],
            references: [paymentTransactions.orderId],
        },
    },
    userProperty: {
        user: {
            relation: "one",
            table: platformUsers,
            fields: [userProperty.userId],
            references: [platformUsers.id],
        },
        property: {
            relation: "one",
            table: properties,
            fields: [userProperty.propertyId],
            references: [properties.id],
        },
        plan: {
            relation: "one",
            table: planvariants,
            fields: [userProperty.planVariantId],
            references: [planvariants.id],
        },
        agent: {
            relation: "one",
            table: adminUsers,
            fields: [userProperty.agentId],
            references: [adminUsers.id],
        },
        assignedBy: {
            relation: "one",
            table: adminUsers,
            fields: [userProperty.assignedBy],
            references: [adminUsers.id],
        },
    },
    orderHistory: {
        order: {
            relation: "one",
            table: orders,
            fields: [orderHistory.orderId],
            references: [orders.orderId],
        },
    },
    paymentTransactions: {
        order: {
            relation: "one",
            table: orders,
            fields: [paymentTransactions.orderId],
            references: [orders.orderId],
        },
    },
    adminUsers: {
        assignedUserProperties: {
            relation: "many",
            table: userProperty,
            fields: [adminUsers.id],
            references: [userProperty.agentId],
        },
        assignedByUserProperties: {
            relation: "many",
            table: userProperty,
            fields: [adminUsers.id],
            references: [userProperty.assignedBy],
        },
    },
}

