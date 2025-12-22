import {
  eq,
  and,
  sql,
  or,
} from "drizzle-orm";
import { db } from "../../database/connection";
import {
  properties,
  propertyImages,
} from "../../database/schema/index";
import {
  Plan,
  planvariants,
  propertyVisits,
  propertyVisitMedia,
  userProperty,
} from "../../database/schema/manage-recrod";

export class PropertyManagementService {
  static async getUserProperties(
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    page = Math.max(1, page);
    const offset = (page - 1) * limit;

    // 1️⃣ Count total rows for pagination
    const totalRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(userProperty)
      .leftJoin(properties, eq(userProperty.propertyId, properties.id))
      .where(
        and(
          eq(userProperty.userId, userId),
          eq(properties.availablilityStatus, "MANAGED")
        )
      );

    const total = totalRow[0].count;
    const totalPages = Math.ceil(total / limit);

    const rows = await db
      .select({
        userPropertyId: userProperty.id,
        visitsRemaining: userProperty.visitsRemaining,
        visitsUsed: userProperty.visitsUsed,
        property: properties,
        images: sql`
          COALESCE(
            json_agg(DISTINCT ${propertyImages}.*) 
            FILTER (WHERE ${propertyImages}.id IS NOT NULL),
            '[]'
          )
        `.as("images"),
        planDetails: sql`
          json_build_object(
            'id', ${Plan.planId},
            'planName', ${Plan.planName},
            'description', ${Plan.description},
            'billingCycle', ${planvariants.billingCycle},
            'durationInDays', ${planvariants.durationInDays},
            'visitsAllowed', ${planvariants.visitsAllowed}
          )
        `.as("planDetails"),
      })
      .from(userProperty)
      .leftJoin(properties, eq(userProperty.propertyId, properties.id))
      .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
      .leftJoin(planvariants, eq(userProperty.planVariantId, planvariants.id))
      .leftJoin(Plan, eq(planvariants.planId, Plan.planId))
      .where(
        and(
          eq(userProperty.userId, userId),
          eq(properties.availablilityStatus, "MANAGED")
        )
      )
      .groupBy(userProperty.id, properties.id, planvariants.id, Plan.planId)
      .limit(limit)
      .offset(offset);

    return {
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
      rows,
    };
  }

  static async getUserPropertiesById(userId: string, propertyId: string) {
    // 2️⃣ Fetch rows with aggregated images and nested planDetails
    const rows = await db
      .select({
        userPropertyId: userProperty.id,
        visitsRemaining: userProperty.visitsRemaining,
        visitsUsed: userProperty.visitsUsed,
        property: properties,
        images: sql`
          COALESCE(
            json_agg(DISTINCT ${propertyImages}.*)
            FILTER (WHERE ${propertyImages}.id IS NOT NULL),
            '[]'
          )
        `.as("images"),
        planDetails: sql`
          json_build_object(
            'id', ${Plan.planId},
            'planName', ${Plan.planName},
            'description', ${Plan.description},
            'billingCycle', ${planvariants.billingCycle},
            'durationInDays', ${planvariants.durationInDays},
            'visitsAllowed', ${planvariants.visitsAllowed}
          )
        `.as("planDetails"),
        visits: sql`
          COALESCE(
            json_agg(DISTINCT ${propertyVisits}.*)
            FILTER (WHERE ${propertyVisits}.id IS NOT NULL),
            '[]'
          )
        `.as("visits"),
        visitMedia: sql`
          COALESCE(
            json_agg(DISTINCT ${propertyVisitMedia}.*)
            FILTER (WHERE ${propertyVisitMedia}.id IS NOT NULL),
            '[]'
          )
        `.as("visitMedia"),
      })
      .from(userProperty)
      .leftJoin(properties, eq(userProperty.propertyId, properties.id))
      .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
      .leftJoin(planvariants, eq(userProperty.planVariantId, planvariants.id))
      .leftJoin(Plan, eq(planvariants.planId, Plan.planId))
      .leftJoin(propertyVisits, eq(propertyVisits.propertyId, propertyId))
      .leftJoin(
        propertyVisitMedia,
        eq(propertyVisitMedia.visitId, propertyVisits.id)
      )
      .where(
        and(
          eq(userProperty.propertyId, propertyId),
          eq(properties.availablilityStatus, "MANAGED")
        )
      )
      .groupBy(userProperty.id, properties.id, planvariants.id, Plan.planId);

    return {
      ...rows[0],
    };
  }

  /**
   * Get ALL managed properties (from any user), using userProperty as the source of truth.
   */
  static async getAllManagedProperties(
    page: number = 1,
    limit: number = 10
  ) {
    page = Math.max(1, page);
    const offset = (page - 1) * limit;

    const totalRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(userProperty)
      .leftJoin(properties, eq(userProperty.propertyId, properties.id))
      .where(
        and(
          eq(userProperty.active, true),
          eq(properties.availablilityStatus, "MANAGED")
        )
      );

    const total = totalRow[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit);

    const rows = await db
      .select({
        userPropertyId: userProperty.id,
        userId: userProperty.userId,
        visitsRemaining: userProperty.visitsRemaining,
        visitsUsed: userProperty.visitsUsed,
        status: userProperty.status,
        property: properties,
        images: sql`
          COALESCE(
            json_agg(DISTINCT ${propertyImages}.*) 
            FILTER (WHERE ${propertyImages}.id IS NOT NULL),
            '[]'
          )
        `.as("images"),
        planDetails: sql`
          json_build_object(
            'id', ${Plan.planId},
            'planName', ${Plan.planName},
            'description', ${Plan.description},
            'billingCycle', ${planvariants.billingCycle},
            'durationInDays', ${planvariants.durationInDays},
            'visitsAllowed', ${planvariants.visitsAllowed}
          )
        `.as("planDetails"),
      })
      .from(userProperty)
      .leftJoin(properties, eq(userProperty.propertyId, properties.id))
      .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
      .leftJoin(planvariants, eq(userProperty.planVariantId, planvariants.id))
      .leftJoin(Plan, eq(planvariants.planId, Plan.planId))
      .where(
        and(
          eq(userProperty.active, true),
          eq(properties.availablilityStatus, "MANAGED")
        )
      )
      .groupBy(userProperty.id, properties.id, planvariants.id, Plan.planId)
      .limit(limit)
      .offset(offset);

    return {
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
      rows,
    };
  }

  /**
   * Get all managed properties associated with a specific admin (as agent or assigner).
   */
  static async getAllPropertiesPostedbyadmin(
    adminId: string,
    page: number = 1,
    limit: number = 10
  ) {
    page = Math.max(1, page);
    const offset = (page - 1) * limit;

    const totalRow = await db
      .select({ count: sql<number>`count(*)` })
      .from(userProperty)
      .leftJoin(properties, eq(userProperty.propertyId, properties.id))
      .where(
        and(
          eq(userProperty.active, true),
          eq(properties.availablilityStatus, "MANAGED"),
          or(eq(userProperty.agentId, adminId), eq(userProperty.assignedBy, adminId))
        )
      );

    const total = totalRow[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit);

    const rows = await db
      .select({
        userPropertyId: userProperty.id,
        userId: userProperty.userId,
        visitsRemaining: userProperty.visitsRemaining,
        visitsUsed: userProperty.visitsUsed,
        status: userProperty.status,
        property: properties,
        images: sql`
          COALESCE(
            json_agg(DISTINCT ${propertyImages}.*) 
            FILTER (WHERE ${propertyImages}.id IS NOT NULL),
            '[]'
          )
        `.as("images"),
        planDetails: sql`
          json_build_object(
            'id', ${Plan.planId},
            'planName', ${Plan.planName},
            'description', ${Plan.description},
            'billingCycle', ${planvariants.billingCycle},
            'durationInDays', ${planvariants.durationInDays},
            'visitsAllowed', ${planvariants.visitsAllowed}
          )
        `.as("planDetails"),
      })
      .from(userProperty)
      .leftJoin(properties, eq(userProperty.propertyId, properties.id))
      .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
      .leftJoin(planvariants, eq(userProperty.planVariantId, planvariants.id))
      .leftJoin(Plan, eq(planvariants.planId, Plan.planId))
      .where(
        and(
          eq(userProperty.active, true),
          eq(properties.availablilityStatus, "MANAGED"),
          or(eq(userProperty.agentId, adminId), eq(userProperty.assignedBy, adminId))
        )
      )
      .groupBy(userProperty.id, properties.id, planvariants.id, Plan.planId)
      .limit(limit)
      .offset(offset);

    return {
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
      rows,
    };
  }
}
