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
import { alias } from "drizzle-orm/pg-core";

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
    limit: number = 10,
    searchTerm:string
  ) {
    page = Math.max(1, page);
    const offset = (page - 1) * limit;

    const basecondition = and(
      eq(userProperty.active, true),
      eq(properties.availablilityStatus, "MANAGED")
    )
    const searchCondition = this.buildSearchCondition(searchTerm);
    const wherecondition = searchCondition ? and(basecondition,searchCondition):basecondition;

    // 1️⃣ Count total managed mappings for pagination
    const totalRow = await db
      .select({ count: sql<number>`count(distinct ${userProperty.id})` })
      .from(userProperty)
      .leftJoin(properties, eq(userProperty.propertyId, properties.id))
      .leftJoin(platformUsers, eq(userProperty.userId, platformUsers.id))
      .leftJoin(
        platformUserProfiles,
        eq(platformUsers.id, platformUserProfiles.userId)
      )
      .where(wherecondition);

    const total = totalRow[0]?.count ?? 0;
    const totalPages = Math.ceil(total / limit);

    // 2️⃣ Fetch rows with user, property, plan details, visits and visit media
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
      ilike(properties.khasraNumber, likePattern),
      ilike(properties.murabbaNumber, likePattern),
      ilike(properties.khewatNumber, likePattern),
      // 👤 User fields
      ilike(platformUsers.firstName, likePattern),
      ilike(platformUsers.lastName, likePattern),
      ilike(platformUsers.email, likePattern),
      ilike(platformUserProfiles.phone, likePattern)
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
