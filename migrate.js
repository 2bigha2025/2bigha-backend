"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const migrator_1 = require("drizzle-orm/postgres-js/migrator");
const connection_1 = require("./src/database/connection");
const dotenv_1 = __importDefault(require("dotenv"));
async function runMigrations() {
    console.log("🚀 Running database migrations...");
    dotenv_1.default.config();
    console.log(process.env.DATABASE_URL);
    try {
        await (0, migrator_1.migrate)(connection_1.db, { migrationsFolder: "./drizzle" });
        console.log("✅ Migrations completed successfully");
    }
    catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
    finally {
        await connection_1.sql.end();
    }
}
runMigrations();
//# sourceMappingURL=migrate.js.map