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
import { platformUsers, platformUserProfiles, adminUsers } from "../../database/schema/index";
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


  static async assignPropertyToAgent(input: {
    PropertyId: string;
    agentId: string;
    assignedByAdminId: string;
  }) {
    try {
      // Verify the user property exists
      const existingUserProperty = await db
        .select()
        .from(userProperty)
        .where(eq(userProperty.propertyId, input.PropertyId))
        .limit(1);

      if (!existingUserProperty.length) {
        throw new Error(`User property with ID ${input.PropertyId} not found`);
      }

      // Verify the agent (admin user) exists
      const agent = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, input.agentId))
        .limit(1);

      if (!agent.length) {
        throw new Error(`Agent (admin user) with ID ${input.agentId} not found`);
      }

      // Verify the assigning admin exists
      const assigningAdmin = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, input.assignedByAdminId))
        .limit(1);

      if (!assigningAdmin.length) {
        throw new Error(`Admin user with ID ${input.assignedByAdminId} not found`);
      }

      // Update the user property with agent assignment
      const updated = await db
        .update(userProperty)
        .set({
          agentId: input.agentId,
          assignedBy: input.assignedByAdminId,
          assignedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userProperty.propertyId, input.PropertyId))
        .returning();

      return {
        success: true,
        message: `Property successfully assigned to agent`,
        data: updated[0],
      };
    } catch (error) {
      console.error("❌ Error assigning property to agent:", error);
      throw new Error(
        `Failed to assign property to agent: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Reassign a managed property from one agent to another
   */
  static async reassignPropertyToAgent(input: {
    userPropertyId: string;
    newAgentId: string;
    reassignedByAdminId: string;
  }) {
    try {
      // Verify the user property exists and is currently assigned
      const existingUserProperty = await db
        .select()
        .from(userProperty)
        .where(eq(userProperty.id, input.userPropertyId))
        .limit(1);

      if (!existingUserProperty.length) {
        throw new Error(`User property with ID ${input.userPropertyId} not found`);
      }

      // if (!existingUserProperty[0].agentId) {
      //   throw new Error(
      //     `User property is not currently assigned to any agent`
      //   );
      // }

      // Verify the new agent exists
      const newAgent = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, input.newAgentId))
        .limit(1);

      if (!newAgent.length) {
        throw new Error(`New agent (admin user) with ID ${input.newAgentId} not found`);
      }

      // Verify the reassigning admin exists
      const reassigningAdmin = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, input.reassignedByAdminId))
        .limit(1);

      if (!reassigningAdmin.length) {
        throw new Error(`Admin user with ID ${input.reassignedByAdminId} not found`);
      }

      // Update the user property with new agent
      const updated = await db
        .update(userProperty)
        .set({
          agentId: input.newAgentId,
          assignedBy: input.reassignedByAdminId,
          assignedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userProperty.id, input.userPropertyId))
        .returning();

      return {
        success: true,
        message: `Property successfully reassigned to new agent`,
        previousAgent: existingUserProperty[0].agentId,
        data: updated[0],
      };
    } catch (error) {
      console.error("❌ Error reassigning property to agent:", error);
      throw new Error(
        `Failed to reassign property to agent: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Unassign a property from an agent
   */
  static async unassignPropertyFromAgent(input: {
    userPropertyId: string;
    unassignedByAdminId: string;
  }) {
    try {
      // Verify the user property exists
      const existingUserProperty = await db
        .select()
        .from(userProperty)
        .where(eq(userProperty.id, input.userPropertyId))
        .limit(1);

      if (!existingUserProperty.length) {
        throw new Error(`User property with ID ${input.userPropertyId} not found`);
      }

      if (!existingUserProperty[0].agentId) {
        throw new Error(
          `User property is not assigned to any agent`
        );
      }

      // Verify the unassigning admin exists
      const unassigningAdmin = await db
        .select()
        .from(adminUsers)
        .where(eq(adminUsers.id, input.unassignedByAdminId))
        .limit(1);

      if (!unassigningAdmin.length) {
        throw new Error(`Admin user with ID ${input.unassignedByAdminId} not found`);
      }

      // Update the user property to remove agent assignment
      const updated = await db
        .update(userProperty)
        .set({
          agentId: null,
          assignedBy: null,
          assignedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(userProperty.id, input.userPropertyId))
        .returning();

      return {
        success: true,
        message: `Property successfully unassigned from agent`,
        previousAgent: existingUserProperty[0].agentId,
        data: updated[0],
      };
    } catch (error) {
      console.error("❌ Error unassigning property from agent:", error);
      throw new Error(
        `Failed to unassign property from agent: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get assignment details for a managed property
   */
  static async getPropertyAssignmentDetails(userPropertyId: string) {
    try {
      const result = await db
        .select({
          userPropertyId: userProperty.id,
          property: properties,
          user: {
            userId: platformUsers.id,
            firstName: platformUsers.firstName,
            lastName: platformUsers.lastName,
            email: platformUsers.email,
          },
          agent: {
            agentId: sql`${adminUsers}.id`.as("agent_id"),
            firstName: sql`${adminUsers}.first_name`.as("agent_first_name"),
            lastName: sql`${adminUsers}.last_name`.as("agent_last_name"),
            email: sql`${adminUsers}.email`.as("agent_email"),
            phone: sql`${adminUsers}.phone`.as("agent_phone"),
            department: sql`${adminUsers}.department`.as("agent_department"),
          },
          assignedBy: sql`
            json_build_object(
              'adminId', assigned_by_admin.id,
              'firstName', assigned_by_admin.first_name,
              'lastName', assigned_by_admin.last_name,
              'email', assigned_by_admin.email
            )
          `.as("assigned_by_details"),
          assignedAt: userProperty.assignedAt,
          startDate: userProperty.startDate,
          endDate: userProperty.endDate,
        })
        .from(userProperty)
        .leftJoin(properties, eq(userProperty.propertyId, properties.id))
        .leftJoin(platformUsers, eq(userProperty.userId, platformUsers.id))
        .leftJoin(
          adminUsers,
          eq(userProperty.agentId, adminUsers.id)
        )
        .where(eq(userProperty.id, userPropertyId));

      if (!result.length) {
        throw new Error(`Assignment details not found for property ID ${userPropertyId}`);
      }

      return result[0];
    } catch (error) {
      console.error("❌ Error fetching assignment details:", error);
      throw new Error(
        `Failed to fetch assignment details: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

