import { db, testConnection } from "../src/database/connection"
import { Plan, planvariants } from "../src/database/schema/manage-recrod"
import dotenv from 'dotenv'

async function seedPlanVariants() {
  dotenv.config()
  console.log("🌱 Seeding Plan Variants...")

  try {
    // Test connection
    const connected = await testConnection()
    if (!connected) {
      throw new Error("Database connection failed")
    }

    // Get existing plans to get their IDs
    const existingPlans = await db.select().from(Plan)
    if (existingPlans.length === 0) {
      throw new Error("No plans found. Please seed plans first.")
    }

    const planIds = existingPlans.map(p => p.planId)

    // Insert plan variants - don't set id (serial auto-increment)
    await db.insert(planvariants).values([
      // Basic Care Plan
      {
        planId: planIds[0],
        billingCycle: "MONTHLY",
        price: 2999,
        durationInDays: 30,
        visitsAllowed: 1,
      },
      {
        planId: planIds[0],
        billingCycle: "QUARTERLY",
        price: 8999,
        durationInDays: 120,
        visitsAllowed: 4,
      },
      {
        planId: planIds[0],
        billingCycle: "YEARLY",
        price: 35988,
        durationInDays: 420,
        visitsAllowed: 14,
      },

      // Standard Care Plan
      {
        planId: planIds[1] || planIds[0],
        billingCycle: "MONTHLY",
        price: 3999,
        durationInDays: 30,
        visitsAllowed: 1,
      },
      {
        planId: planIds[1] || planIds[0],
        billingCycle: "QUARTERLY",
        price: 11999,
        durationInDays: 120,
        visitsAllowed: 4,
      },
      {
        planId: planIds[1] || planIds[0],
        billingCycle: "YEARLY",
        price: 47999,
        durationInDays: 420,
        visitsAllowed: 14,
      },

      // Premium Care Plan
      {
        planId: planIds[2] || planIds[0],
        billingCycle: "MONTHLY",
        price: 4999,
        durationInDays: 30,
        visitsAllowed: 2,
      },
      {
        planId: planIds[2] || planIds[0],
        billingCycle: "QUARTERLY",
        price: 14999,
        durationInDays: 120,
        visitsAllowed: 8,
      },
      {
        planId: planIds[2] || planIds[0],
        billingCycle: "YEARLY",
        price: 59999,
        durationInDays: 420,
        visitsAllowed: 28,
      },
    ])
    console.log("✅ Plan variants seeded successfully!")
    process.exit(0)
  } catch (error) {
    console.error("❌ Plan seeding failed:", error)
    process.exit(1)
  }
}
seedPlanVariants();
