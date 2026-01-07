import {
  eq,
  and,
  sql,
  isNotNull,
  desc,
  gte,
  lte,
  inArray,
} from "drizzle-orm";
import { db } from "../../database/connection";
import { v4 as uuidv4 } from "uuid";
import {
  properties,
  propertyImages,
  adminUsers,
  adminRoles,
  adminUserRoles,
} from "../../database/schema/index";
import {
  Plan,
  planvariants,
  propertyVisits,
  propertyVisitMedia,
  userProperty,
} from "../../database/schema/manage-recrod";
import { platformUsers } from "../../database/schema/index";
import { AzureStorageService, FileUpload } from "../../utils/azure-storage";

/**
 * Field Agent Service
 * Handles field agent operations:
 * - View assigned properties with full details
 * - Mark property visits
 * - Upload visit media (photos/videos)
 * - Track visit progress and history
 */
export class FieldAgentService {
  static azureStorage = new AzureStorageService();

  /**
   * Verify that an admin user has the "field_agent" role
   */
  static async verifyFieldAgentRole(agentId: string): Promise<boolean> {
    try {
      const result = await db
        .select({
          roleId: adminRoles.id,
          roleSlug: adminRoles.slug,
        })
        .from(adminUserRoles)
        .leftJoin(adminRoles, eq(adminUserRoles.roleId, adminRoles.id))
        .where(
          and(
            eq(adminUserRoles.userId, agentId),
            eq(adminRoles.slug, "field_agent")
          )
        )
        .limit(1);

      return result.length > 0;
    } catch (error) {
      console.error("❌ Error verifying field agent role:", error);
      return false;
    }
  }

  /**
   * Get all properties assigned to a field agent with complete details
   * Includes: property info, plan details, visits, location, owner info
   */
  static async getAssignedProperties(
    agentId: string,
    page: number = 1,
    limit: number = 10
  ) {
    try {
      // Verify field agent role
      const isFieldAgent = await this.verifyFieldAgentRole(agentId);
      if (!isFieldAgent) {
        throw new Error(
          "User does not have field_agent role"
        );
      }

      page = Math.max(1, page);
      const offset = (page - 1) * limit;

      // Count total assigned properties
      const countResult = await db
        .select({ count: sql<number>`count(distinct ${userProperty.id})` })
        .from(userProperty)
        .leftJoin(properties, eq(userProperty.propertyId, properties.id))
        .where(
          and(
            eq(userProperty.agentId, agentId),
            eq(properties.availablilityStatus, "MANAGED"),
            eq(userProperty.active, true)
          )
        );

      const total = countResult[0]?.count ?? 0;
      const totalPages = Math.ceil(total / limit);

      // Fetch properties with full details
      const properties_data = await db
        .select({
          userPropertyId: userProperty.id,
          propertyId: properties.id,
          property: {
            title: properties.title,
            description: properties.description,
            propertyType: properties.propertyType,
            address: properties.address,
            city: properties.city,
            district: properties.district,
            state: properties.state,
            pinCode: properties.pinCode,
            area: properties.area,
            areaUnit: properties.areaUnit,
            price: properties.price,
            ownerName: properties.ownerName,
            ownerPhone: properties.ownerPhone,
            location: properties.location,
            centerPoint: properties.centerPoint,
            boundary: properties.boundary,
            geoJson: properties.geoJson,
          },
          images: sql`
            COALESCE(
              json_agg(DISTINCT json_build_object(
                'id', ${propertyImages}.id,
                'imageUrl', ${propertyImages}.imageUrl,
                'imageType', ${propertyImages}.imageType,
                'caption', ${propertyImages}.caption,
                'altText', ${propertyImages}.altText,
                'isMain', ${propertyImages}.isMain
              ))
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
          visitsRemaining: userProperty.visitsRemaining,
          visitsUsed: userProperty.visitsUsed,
          startDate: userProperty.startDate,
          endDate: userProperty.endDate,
          status: userProperty.status,
          assignedAt: userProperty.assignedAt,
          owner: {
            userId: platformUsers.id,
            firstName: platformUsers.firstName,
            lastName: platformUsers.lastName,
            email: platformUsers.email,
            phone: platformUsers.phone,
          },
        })
        .from(userProperty)
        .leftJoin(properties, eq(userProperty.propertyId, properties.id))
        .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
        .leftJoin(planvariants, eq(userProperty.planVariantId, planvariants.id))
        .leftJoin(Plan, eq(planvariants.planId, Plan.planId))
        .leftJoin(platformUsers, eq(userProperty.userId, platformUsers.id))
        .where(
          and(
            eq(userProperty.agentId, agentId),
            eq(properties.availablilityStatus, "MANAGED"),
            eq(userProperty.active, true)
          )
        )
        .groupBy(
          userProperty.id,
          properties.id,
          planvariants.id,
          Plan.planId,
          platformUsers.id
        )
        .orderBy(desc(userProperty.assignedAt))
        .limit(limit)
        .offset(offset);

      return {
        meta: {
          page,
          limit,
          total,
          totalPages,
        },
        data: properties_data,
      };
    } catch (error) {
      console.error("❌ Error fetching assigned properties:", error);
      throw new Error(
        `Failed to fetch assigned properties: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get detailed view of a single assigned property
   * Includes all property details, plan info, and visit history
   */
  static async getAssignedPropertyDetails(
    agentId: string,
    userPropertyId: string
  ) {
    try {
      const isFieldAgent = await this.verifyFieldAgentRole(agentId);
      if (!isFieldAgent) {
        throw new Error("User does not have field_agent role");
      }

      const result = await db
        .select({
          userPropertyId: userProperty.id,
          propertyId: properties.id,
          property: {
            id: properties.id,
            title: properties.title,
            description: properties.description,
            propertyType: properties.propertyType,
            address: properties.address,
            city: properties.city,
            district: properties.district,
            state: properties.state,
            pinCode: properties.pinCode,
            country: properties.country,
            area: properties.area,
            areaUnit: properties.areaUnit,
            price: properties.price,
            pricePerUnit: properties.pricePerUnit,
            ownerName: properties.ownerName,
            ownerPhone: properties.ownerPhone,
            location: properties.location,
            centerPoint: properties.centerPoint,
            boundary: properties.boundary,
            geoJson: properties.geoJson,
            calculatedArea: properties.calculatedArea,
          },
          images: sql`
            COALESCE(
              json_agg(DISTINCT json_build_object(
                'id', ${propertyImages}.id,
                'imageUrl', ${propertyImages}.imageUrl,
                'imageType', ${propertyImages}.imageType,
                'caption', ${propertyImages}.caption,
                'altText', ${propertyImages}.altText,
                'isMain', ${propertyImages}.isMain,
                'sortOrder', ${propertyImages}.sortOrder
              ))
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
              'visitsAllowed', ${planvariants.visitsAllowed},
              'pricePerVisit', ${planvariants.pricePerVisit}
            )
          `.as("planDetails"),
          visitsRemaining: userProperty.visitsRemaining,
          visitsUsed: userProperty.visitsUsed,
          startDate: userProperty.startDate,
          endDate: userProperty.endDate,
          status: userProperty.status,
          assignedAt: userProperty.assignedAt,
          owner: {
            userId: platformUsers.id,
            firstName: platformUsers.firstName,
            lastName: platformUsers.lastName,
            email: platformUsers.email,
            phone: platformUsers.phone,
          },
        })
        .from(userProperty)
        .leftJoin(properties, eq(userProperty.propertyId, properties.id))
        .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
        .leftJoin(planvariants, eq(userProperty.planVariantId, planvariants.id))
        .leftJoin(Plan, eq(planvariants.planId, Plan.planId))
        .leftJoin(platformUsers, eq(userProperty.userId, platformUsers.id))
        .where(
          and(
            eq(userProperty.id, userPropertyId),
            eq(userProperty.agentId, agentId),
            eq(properties.availablilityStatus, "MANAGED")
          )
        )
        .groupBy(
          userProperty.id,
          properties.id,
          planvariants.id,
          Plan.planId,
          platformUsers.id
        );

      if (!result.length) {
        throw new Error(
          `Property assignment not found or not accessible by this agent`
        );
      }

      return result[0];
    } catch (error) {
      console.error("❌ Error fetching property details:", error);
      throw new Error(
        `Failed to fetch property details: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get visit history for a property assigned to the agent
   */
  static async getPropertyVisitHistory(
    agentId: string,
    userPropertyId: string,
    page: number = 1,
    limit: number = 20
  ) {
    try {
      const isFieldAgent = await this.verifyFieldAgentRole(agentId);
      if (!isFieldAgent) {
        throw new Error("User does not have field_agent role");
      }

      // Verify property is assigned to this agent
      const assigned = await db
        .select()
        .from(userProperty)
        .where(
          and(
            eq(userProperty.id, userPropertyId),
            eq(userProperty.agentId, agentId)
          )
        )
        .limit(1);

      if (!assigned.length) {
        throw new Error("Property is not assigned to this agent");
      }

      page = Math.max(1, page);
      const offset = (page - 1) * limit;
      const propertyId = assigned[0].propertyId;

      // Count total visits
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(propertyVisits)
        .where(eq(propertyVisits.propertyId, propertyId));

      const total = countResult[0]?.count ?? 0;
      const totalPages = Math.ceil(total / limit);

      // Fetch visit history with media
      const visits = await db
        .select({
          visitId: propertyVisits.id,
          propertyId: propertyVisits.propertyId,
          visitedBy: propertyVisits.visitedBy,
          visitDate: propertyVisits.visitDate,
          notes: propertyVisits.notes,
          status: propertyVisits.status,
          createdAt: propertyVisits.createdAt,
          updatedAt: propertyVisits.updatedAt,
          media: sql`
            COALESCE(
              json_agg(DISTINCT json_build_object(
                'id', ${propertyVisitMedia}.id,
                'mediaUrl', ${propertyVisitMedia}.mediaUrl,
                'mediaType', ${propertyVisitMedia}.mediaType,
                'capturedAt', ${propertyVisitMedia}.capturedAt
              ))
              FILTER (WHERE ${propertyVisitMedia}.id IS NOT NULL),
              '[]'
            )
          `.as("media"),
        })
        .from(propertyVisits)
        .leftJoin(
          propertyVisitMedia,
          eq(propertyVisits.id, propertyVisitMedia.visitId)
        )
        .where(eq(propertyVisits.propertyId, propertyId))
        .groupBy(propertyVisits.id)
        .orderBy(desc(propertyVisits.visitDate))
        .limit(limit)
        .offset(offset);

      return {
        meta: {
          page,
          limit,
          total,
          totalPages,
        },
        data: visits,
      };
    } catch (error) {
      console.error("❌ Error fetching visit history:", error);
      throw new Error(
        `Failed to fetch visit history: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Mark a property visit (create new visit record)
   */
  static async markPropertyVisit(input: {
    agentId: string;
    userPropertyId: string;
    notes?: string;
    visitDate?: Date;
  }) {
    try {
      const isFieldAgent = await this.verifyFieldAgentRole(input.agentId);
      if (!isFieldAgent) {
        throw new Error("User does not have field_agent role");
      }

      // Verify property is assigned to this agent
      const assigned = await db
        .select()
        .from(userProperty)
        .where(
          and(
            eq(userProperty.id, input.userPropertyId),
            eq(userProperty.agentId, input.agentId)
          )
        )
        .limit(1);

      if (!assigned.length) {
        throw new Error("Property is not assigned to this agent");
      }

      // Check visits remaining
      if (assigned[0].visitsRemaining !== null && assigned[0].visitsRemaining <= 0) {
        throw new Error("No visits remaining for this property");
      }

      const propertyId = assigned[0].propertyId;
      const visitId = uuidv4();

      // Create visit record in transaction
      const result = await db.transaction(async (tx) => {
        // Insert visit
        const visit = await tx
          .insert(propertyVisits)
          .values({
            id: visitId,
            propertyId,
            visitedBy: input.agentId,
            visitDate: input.visitDate || new Date(),
            notes: input.notes || null,
            status: "COMPLETED",
          })
          .returning();

        // Update visits used and remaining
        const updatedUserProperty = await tx
          .update(userProperty)
          .set({
            visitsUsed: (assigned[0].visitsUsed || 0) + 1,
            visitsRemaining: assigned[0].visitsRemaining
              ? assigned[0].visitsRemaining - 1
              : null,
            updatedAt: new Date(),
          })
          .where(eq(userProperty.id, input.userPropertyId))
          .returning();

        return {
          visit: visit[0],
          userProperty: updatedUserProperty[0],
        };
      });

      return {
        success: true,
        message: "Visit marked successfully",
        visitId: visitId,
        data: result,
      };
    } catch (error) {
      console.error("❌ Error marking property visit:", error);
      throw new Error(
        `Failed to mark property visit: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Upload media for a property visit (photos/videos)
   */
  static async uploadVisitMedia(input: {
    agentId: string;
    visitId: string;
    mediaFiles: FileUpload[];
  }) {
    try {
      const isFieldAgent = await this.verifyFieldAgentRole(input.agentId);
      if (!isFieldAgent) {
        throw new Error("User does not have field_agent role");
      }

      // Verify visit exists and belongs to agent
      const visit = await db
        .select()
        .from(propertyVisits)
        .leftJoin(
          userProperty,
          eq(propertyVisits.propertyId, userProperty.propertyId)
        )
        .where(eq(propertyVisits.id, input.visitId))
        .limit(1);

      if (!visit.length) {
        throw new Error(`Visit with ID ${input.visitId} not found`);
      }

      if (visit[0].userProperty?.agentId !== input.agentId) {
        throw new Error("You do not have access to this visit");
      }

      // Upload files to Azure
      console.log(`📸 Uploading ${input.mediaFiles.length} visit media files...`);
      const uploadResult = await this.azureStorage.uploadBulkFiles(
        input.mediaFiles,
        "property-visits"
      );

      if (!uploadResult.success && uploadResult.results.length === 0) {
        throw new Error("Failed to upload media files");
      }

      // Prepare media records
      const mediaRecords = uploadResult.results
        .filter((result) => result && result.filename)
        .map((result) => {
          const variants = this.azureStorage.getAllVariantUrls(
            result.filename,
            "property-visits"
          );
          const mediaUrl = variants.original || variants.large;
          const mediaType = this.getMediaType(result.originalName);

          return {
            id: uuidv4(),
            visitId: input.visitId,
            mediaUrl,
            mediaType,
            capturedAt: new Date(),
            createdAt: new Date(),
          };
        });

      // Insert media records
      if (mediaRecords.length > 0) {
        await db.insert(propertyVisitMedia).values(mediaRecords);
      }

      return {
        success: true,
        message: `Successfully uploaded ${mediaRecords.length} media files`,
        uploadedCount: mediaRecords.length,
        failedCount: uploadResult.errors?.length ?? 0,
        media: mediaRecords.map((m) => ({
          id: m.id,
          mediaUrl: m.mediaUrl,
          mediaType: m.mediaType,
          capturedAt: m.capturedAt,
        })),
      };
    } catch (error) {
      console.error("❌ Error uploading visit media:", error);
      throw new Error(
        `Failed to upload visit media: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get visit media for a specific visit
   */
  static async getVisitMedia(visitId: string) {
    try {
      const media = await db
        .select()
        .from(propertyVisitMedia)
        .where(eq(propertyVisitMedia.visitId, visitId))
        .orderBy(propertyVisitMedia.capturedAt);

      return media;
    } catch (error) {
      console.error("❌ Error fetching visit media:", error);
      throw new Error(
        `Failed to fetch visit media: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Get field agent dashboard statistics
   */
  static async getAgentDashboardStats(agentId: string) {
    try {
      const isFieldAgent = await this.verifyFieldAgentRole(agentId);
      if (!isFieldAgent) {
        throw new Error("User does not have field_agent role");
      }

      // Total assigned properties
      const assignedCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(userProperty)
        .where(
          and(
            eq(userProperty.agentId, agentId),
            eq(userProperty.active, true)
          )
        );

      // Total visits completed
      const visitsCompleted = await db
        .select({ count: sql<number>`count(*)` })
        .from(propertyVisits)
        .leftJoin(
          userProperty,
          eq(propertyVisits.propertyId, userProperty.propertyId)
        )
        .where(eq(propertyVisits.visitedBy, agentId));

      // Total media uploaded
      const mediaUploaded = await db
        .select({ count: sql<number>`count(*)` })
        .from(propertyVisitMedia)
        .leftJoin(propertyVisits, eq(propertyVisitMedia.visitId, propertyVisits.id))
        .where(eq(propertyVisits.visitedBy, agentId));

      // Properties with pending visits
      const pendingVisits = await db
        .select({ count: sql<number>`count(*)` })
        .from(userProperty)
        .where(
          and(
            eq(userProperty.agentId, agentId),
            eq(userProperty.active, true),
            sql`${userProperty.visitsRemaining} > 0`
          )
        );

      // Total visits allocated
      const totalVisitsAllocated = await db
        .select({
          totalVisits: sql<number>`COALESCE(SUM(${planvariants.visitsAllowed}), 0)`,
        })
        .from(userProperty)
        .leftJoin(planvariants, eq(userProperty.planVariantId, planvariants.id))
        .where(eq(userProperty.agentId, agentId));

      return {
        totalAssignedProperties: assignedCount[0]?.count ?? 0,
        totalVisitsCompleted: visitsCompleted[0]?.count ?? 0,
        totalMediaUploaded: mediaUploaded[0]?.count ?? 0,
        propertiesWithPendingVisits: pendingVisits[0]?.count ?? 0,
        totalVisitsAllocated: totalVisitsAllocated[0]?.totalVisits ?? 0,
      };
    } catch (error) {
      console.error("❌ Error fetching dashboard stats:", error);
      throw new Error(
        `Failed to fetch dashboard statistics: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Determine media type from filename
   */
  private static getMediaType(
    filename: string
  ): "IMAGE" | "VIDEO" | "DOCUMENT" {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "IMAGE";
    if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "VIDEO";
    return "DOCUMENT";
  }
}
