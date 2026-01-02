import {
  eq,
  and,
  sql,
  or,
  ilike,
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
import { platformUsers, platformUserProfiles } from "../../database/schema/index";
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

  
  static async getAllManagedProperties(
    page: number = 1,
    limit: number = 10,
    searchTerm?: string,
    billingCycle?: string,
    planName?: string,
    status?: string
  ) {
    try {
      page = Math.max(1, page);
      const offset = (page - 1) * limit;
      console.log("🔍 Service Layer Input:", { page, limit, searchTerm, billingCycle, planName, status });
      
      const conditions: any[] = [
        eq(userProperty.active, true),
        eq(properties.availablilityStatus, "MANAGED")
      ];

      // Add search condition
      const searchCondition = this.buildSearchCondition(searchTerm);
      if (searchCondition) {
        conditions.push(searchCondition);
      }

      // Add billingCycle filter (must be valid enum value: MONTHLY, QUATERLY, YEARLY)
      if (billingCycle && billingCycle.trim()) {
        const normalized = billingCycle.trim().toUpperCase();
        if (["MONTHLY", "QUATERLY", "YEARLY"].includes(normalized)) {
          conditions.push(eq(planvariants.billingCycle, normalized as any));
          console.log("✓ billingCycle filter added:", normalized);
        }
      }

      // Add planName search filter (must be valid enum value: BASIC, STANDARD, PREMIUM)
      if (planName && planName.trim()) {
        const normalizedPlanName = planName.trim().toUpperCase();
        if (["BASIC", "STANDARD", "PREMIUM"].includes(normalizedPlanName)) {
          console.log("📋 Processing planName filter:", normalizedPlanName);
          conditions.push(eq(Plan.planName, normalizedPlanName as any));
          console.log("✓ planName filter added");
        }
      }

      // Add status filter (must be valid enum value: ACTIVE, INACTIVE, EXPIRED)
      if (status && status.trim()) {
        const normalized = status.trim().toUpperCase();
        if (["ACTIVE", "INACTIVE", "EXPIRED"].includes(normalized)) {
          conditions.push(eq(userProperty.status, normalized as any));
          console.log("✓ status filter added:", normalized);
        }
      }

const wherecondition = conditions.length > 1 ? and(...conditions) : conditions[0];
      // 1️⃣ Count total managed mappings for pagination
      const countQuery = db
        .select({ count: sql<number>`count(distinct ${userProperty.id})` })
        .from(userProperty)
        .leftJoin(properties, eq(userProperty.propertyId, properties.id))
        .leftJoin(platformUsers, eq(userProperty.userId, platformUsers.id))
        .leftJoin(
          platformUserProfiles,
          eq(platformUsers.id, platformUserProfiles.userId)
        )
        .leftJoin(planvariants, eq(userProperty.planVariantId, planvariants.id))
        .leftJoin(Plan, eq(planvariants.planId, Plan.planId))
        .where(wherecondition);

      console.log("📄 COUNT Query SQL:", countQuery.toSQL());
      
      const totalRow = await countQuery;
      const total = totalRow[0]?.count ?? 0;
      const totalPages = Math.ceil(total / limit);
      console.log("📈 Pagination - Total:", total, "Pages:", totalPages);

      // 2️⃣ Fetch rows with user, property, plan details, visits and visit media
      console.log("🔄 Executing FETCH query...");
      const rows = await db
        .select({
          userPropertyId: userProperty.id,
          visitsRemaining: userProperty.visitsRemaining,
          visitsUsed: userProperty.visitsUsed,
          status: userProperty.status,

          // user details (matches GraphQL User type)
          user: {
            userId: platformUsers.id,
            firstName: platformUsers.firstName,
            lastName: platformUsers.lastName,
            email: platformUsers.email,
            phone: platformUserProfiles.phone,
          },

          // property + images
          property: properties,
          images: sql`
            COALESCE(
              json_agg(DISTINCT ${propertyImages}.*)
              FILTER (WHERE ${propertyImages}.id IS NOT NULL),
              '[]'
            )
          `.as("images"),

          // plan details
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

          // property visits
          visits: sql`
            COALESCE(
              json_agg(DISTINCT ${propertyVisits}.*)
              FILTER (WHERE ${propertyVisits}.id IS NOT NULL),
              '[]'
            )
          `.as("visits"),

          // visit media
          visitMedia: sql`
            COALESCE(
              json_agg(DISTINCT ${propertyVisitMedia}.*)
              FILTER (WHERE ${propertyVisitMedia}.id IS NOT NULL),
              '[]'
            )
          `.as("visitMedia"),
        })
        .from(userProperty)
        .leftJoin(platformUsers, eq(userProperty.userId, platformUsers.id))
        .leftJoin(
          platformUserProfiles,
          eq(platformUsers.id, platformUserProfiles.userId)
        )
        .leftJoin(properties, eq(userProperty.propertyId, properties.id))
        .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
        .leftJoin(planvariants, eq(userProperty.planVariantId, planvariants.id))
        .leftJoin(Plan, eq(planvariants.planId, Plan.planId))
        .leftJoin(propertyVisits, eq(propertyVisits.propertyId, properties.id))
        .leftJoin(
          propertyVisitMedia,
          eq(propertyVisitMedia.visitId, propertyVisits.id)
        )
        .where(wherecondition)
        .groupBy(
          userProperty.id,
          properties.id,
          planvariants.id,
          Plan.planId,
          platformUsers.id,
          platformUserProfiles.id
        )
        .orderBy(userProperty.id)
        .limit(limit)
        .offset(offset);

      console.log("✅ FETCH Query Result - Rows:", rows.length);

      return {
        meta: {
          page,
          limit,
          total,
          totalPages,
        },
        rows,
      };
    } catch (error) {
      console.error("❌ Error in getAllManagedProperties:", {
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        params: { page, limit, searchTerm, billingCycle, planName, status }
      });
      throw error;
    }
  }

  static buildSearchCondition(
    searchTerm?: string,
  ) {
    if (!searchTerm || !searchTerm.trim()) return null;
  
    const likePattern = `%${searchTerm.trim()}%`;
  
    return or(
      // 🏠 Property fields
      ilike(properties.title, likePattern),
      ilike(properties.city, likePattern),
      ilike(properties.district, likePattern),
      ilike(properties.state, likePattern),
      ilike(properties.address, likePattern),
      ilike(properties.ownerName, likePattern),
      ilike(properties.ownerPhone, likePattern),
      ilike(platformUsers.firstName, likePattern),
      ilike(platformUsers.lastName, likePattern),
      ilike(platformUsers.email, likePattern),
      ilike(platformUserProfiles.phone, likePattern),
      // ilike(Plan.planName, likePattern)
    );
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
