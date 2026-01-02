import { db, sql, testConnection } from "../src/database/connection"
import { Plan } from "../src/database/schema/manage-recrod"
import dotenv from 'dotenv'
async function seedPlans() {
 
  dotenv.config()
    console.log("🌱 Seeding Admin Users with UUID and Activity Logs...")

//TRUNCATE TABLE planvariants
// RESTART IDENTITY
// CASCADE;

  
    try {
      // Test connection
      const connected = await testConnection()
      if (!connected) {
        throw new Error("Database connection failed")
      }
    
  await db.insert(Plan).values([
    {
      planId: 1,
      planName: "BASIC",
      description: "A starter plan providing essential features for new users with limited needs.",
      createdAt: new Date(),
      updatedAt: new Date()
      
    },
    {
      planId: 2,
      planName: "ADVANCED",
      description: "A balanced plan designed for users who need more flexibility and additional visit allowances.",
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      planId: 3,
      planName: "PREMIUM",
      description: "A comprehensive plan offering maximum access, premium benefits, and extended visit capability.",
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ]);

  console.log("Plans seeded successfully!");
  process.exit(0);
}catch{
  console.log("Plan seeding failed")
}
}
seedPlans().catch((err) => {
  console.error("Error seeding plans:", err);
  process.exit(1);
});
