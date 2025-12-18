import {
  eq,
  and,
  gte,
  lte,
  like,
  desc,
  asc,
  sql,
  or,
  ilike,
  not,
  isNotNull,
} from "drizzle-orm";
import { db } from "../../database/connection";
import { v4 as uuidv4 } from "uuid";
import {
  adminUsers,
  platformUserProfiles,
  platformUsers,
  properties,
  propertyImages,
  propertySeo,
  propertyVerification,
  savedProperties,
} from "../../database/schema/index";
import { azureStorage, FileUpload } from "../../../src/utils/azure-storage";
import { SeoGenerator } from "./seo-generator.service";
import { alias } from "drizzle-orm/pg-core";
import {
  Plan,
  planvariants,
  propertyVisits,
  propertyVisitMedia,
  userProperty,
} from "../../database/schema/manage-recrod";

interface PropertyImageData {
  imageUrl: string;
  imageType?: string;
  caption?: string;
  altText?: string;
  sortOrder?: number;
  isMain?: boolean;
  variants: Record<string, string>;
}
type PolygonCoordinate = { lat: number; lng: number };
type RawPolygonInput = {
  boundaries: {
    type: "polygon";
    shapeId: number;
    coordinates: PolygonCoordinate[];
    area: number;
  }[];
  coordinates: PolygonCoordinate[];
  location: {
    name: string;
    address: string;
    placeId: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
};
export function parsePropertyPolygon(data: RawPolygonInput) {
  const { location, boundaries } = data;
  const boundaryData = boundaries[0];

  return {
    location: location,
    centerPoint: `SRID=4326;POINT(${location.coordinates.lng} ${location.coordinates.lat})`,
    boundary: `SRID=4326;${toWktPolygon(boundaryData.coordinates)}`,
    calculatedArea: boundaryData.area,
    geoJson: boundaryData,
  };
}

function toWktPolygon(coords: PolygonCoordinate[]): string {
  const lngLatPairs = coords.map((pt) => `${pt.lng} ${pt.lat}`);
  // Close the polygon if not closed
  if (lngLatPairs[0] !== lngLatPairs[lngLatPairs.length - 1]) {
    lngLatPairs.push(lngLatPairs[0]);
  }
  return `POLYGON((${lngLatPairs.join(", ")}))`;
}

export class PropertyService {
  static async updateSeoProperty(input: {
    propertyId: string;
    slug: string;
    seoTitle: string;
    seoDescription: string;
    seoKeywords: string;
    seoScore?: number;
    schema?: any;
  }) {
    const {
      propertyId,
      slug,
      seoTitle,
      seoDescription,
      seoKeywords,
      seoScore,
      schema,
    } = input;

    // First, check if the SEO entry exists
    const existing = await db
      .select()
      .from(propertySeo)
      .where(eq(propertySeo.propertyId, propertyId))
      .limit(1);

    if (!existing.length) {
      throw new Error("SEO entry not found for the provided property ID.");
    }

    // Perform the update
    const result = await db
      .update(propertySeo)
      .set({
        slug,
        seoTitle,
        seoDescription,
        seoKeywords,
        schema,
        updatedAt: new Date(),
      })
      .where(eq(propertySeo.propertyId, propertyId))
      .returning();

    return result[0];
  }

  static async processPropertyImages(
    images: FileUpload[],
    metadata: any[] = []
  ): Promise<PropertyImageData[]> {
    if (!images || images.length === 0) {
      return [];
    }

    console.log(`🖼️ Processing ${images.length} property images...`);

    try {
      // Upload images to Azure Storage
      const bulkResult = await azureStorage.uploadBulkFiles(
        images,
        "properties"
      );

      const imageDataArray: PropertyImageData[] = [];
      const processedFiles = new Set<string>();

      if (!bulkResult.success && bulkResult.results.length === 0) {
        console.error("❌ All image uploads failed.");
        console.error("Errors:", bulkResult.errors);
        return [];
      }

      for (const result of bulkResult.results) {
        if (!result || !result.originalName || !result.filename) {
          console.warn("⚠️ Skipping invalid upload result:", result);
          continue;
        }

        if (processedFiles.has(result.originalName)) continue;
        processedFiles.add(result.originalName);

        // Find metadata for this image
        const imageIndex = images.findIndex(
          (img) => img?.filename === result.originalName
        );

        const imageMetadata = metadata[imageIndex] || {};

        const variants = azureStorage.getAllVariantUrls(
          result.filename,
          "properties"
        );
        const mainImageUrl = variants.large || variants.original;

        const imageData: PropertyImageData = {
          imageUrl: mainImageUrl,
          imageType: imageMetadata.imageType || "general",
          caption: imageMetadata.caption || "",
          altText: imageMetadata.altText || "",
          sortOrder: imageMetadata.sortOrder || 0,
          isMain: imageMetadata.isMain || false,
          variants,
        };

        imageDataArray.push(imageData);
      }

      console.log(`✅ Successfully processed ${imageDataArray.length} images`);
      if (bulkResult.errors && bulkResult.errors.length > 0) {
        console.warn(
          `⚠️ Some images failed to upload: ${bulkResult.errors.join(", ")}`
        );
      }

      return imageDataArray;
    } catch (error) {
      console.error("❌ Failed to process property images:", error);
      throw new Error(`Image processing failed: ${error}`);
    }
  }

  static async getPropertiesByLocation(
    lat?: number,
    lng?: number,
    radius?: number,
    limit: number = 15
  ) {
    console.log("Input : ", { lat, lng, radius, limit });
    try {
      const createdByUser = alias(platformUsers, "createdByUser");

      if (lat && lng) {
        // Query properties within radius using PostGIS ST_DWithin function
        const results = await db
          .select({
            property: properties,
            seo: propertySeo,
            verification: propertyVerification,
            user: {
              firstName: createdByUser.firstName,
              lastName: createdByUser.lastName,
            },
            images: sql`
                        COALESCE(json_agg(${propertyImages}.*) 
                        FILTER (WHERE ${propertyImages}.id IS NOT NULL), '[]')
                    `.as("images"),
          })
          .from(properties)
          .innerJoin(
            propertyVerification,
            eq(properties.id, propertyVerification.propertyId)
          )
          .innerJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
          .leftJoin(
            createdByUser,
            eq(properties.createdByUserId, createdByUser.id)
          )
          .leftJoin(
            propertyImages,
            eq(properties.id, propertyImages.propertyId)
          )
          .where(
            and(
              eq(properties.approvalStatus, "APPROVED"),
              eq(properties.availablilityStatus, "AVAILABLE"),
              eq(properties.isActive, true),
              isNotNull(properties.centerPoint),
              // Use PostGIS to find properties within radius (in meters)
              sql`ST_DWithin(
                            ${properties.centerPoint}::geography,
                            ST_Point(${lng}, ${lat})::geography,
                            ${radius || 5000}
                        )`
            )
          )
          .groupBy(
            properties.id,
            propertySeo.id,
            propertyVerification.id,
            createdByUser.id
          )
          .orderBy(desc(properties.createdAt))
          .limit(limit);

        console.log("success results :", results.length);
        return results;
      } else {
        // Return random properties if no coordinates provided
        const results = await db
          .select({
            property: properties,
            seo: propertySeo,
            verification: propertyVerification,
            user: {
              firstName: createdByUser.firstName,
              lastName: createdByUser.lastName,
            },
            images: sql`
                        COALESCE(json_agg(${propertyImages}.*) 
                        FILTER (WHERE ${propertyImages}.id IS NOT NULL), '[]')
                    `.as("images"),
          })
          .from(properties)
          .innerJoin(
            propertyVerification,
            eq(properties.id, propertyVerification.propertyId)
          )
          .innerJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
          .leftJoin(
            createdByUser,
            eq(properties.createdByUserId, createdByUser.id)
          )
          .leftJoin(
            propertyImages,
            eq(properties.id, propertyImages.propertyId)
          )
          .where(
            and(
              eq(properties.approvalStatus, "APPROVED"),
              eq(properties.isActive, true),
              eq(properties.availablilityStatus, "AVAILABLE")
            )
          )
          .groupBy(
            properties.id,
            propertySeo.id,
            propertyVerification.id,
            createdByUser.id
          )
          .orderBy(sql`RANDOM()`) // Random order
          .limit(limit);

        console.log("results :", results);

        return results;
      }
    } catch (error) {
      console.error("Error fetching properties by location:", error);
      throw new Error("Failed to fetch properties by location");
    }
  }

  /**
   * Service to fetch properties ordered by viewCount
   */
  static async getPropertiesByViewCount(
    limit: number = 10,
    minViewCount?: number
  ) {
    try {
      const createdByUser = alias(platformUsers, "createdByUser");

      const whereConditions = [
        eq(properties.approvalStatus, "APPROVED"),
        eq(properties.availablilityStatus, "AVAILABLE"),
        eq(properties.isActive, true),
      ];

      // Add minimum view count filter if provided
      if (minViewCount !== undefined) {
        whereConditions.push(sql`${properties.viewCount} >= ${minViewCount}`);
      }

      const results = await db
        .select({
          property: properties,
          seo: propertySeo,
          verification: propertyVerification,
          user: {
            firstName: createdByUser.firstName,
            lastName: createdByUser.lastName,
          },
          images: sql`
                    COALESCE(json_agg(${propertyImages}.*) 
                    FILTER (WHERE ${propertyImages}.id IS NOT NULL), '[]')
                `.as("images"),
        })
        .from(properties)
        .innerJoin(
          propertyVerification,
          eq(properties.id, propertyVerification.propertyId)
        )
        .innerJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
        .leftJoin(
          createdByUser,
          eq(properties.createdByUserId, createdByUser.id)
        )
        .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
        .where(and(...whereConditions))
        .groupBy(
          properties.id,
          propertySeo.id,
          propertyVerification.id,
          createdByUser.id
        )
        .orderBy(desc(properties.viewCount)) // Order by view count descending
        .limit(limit);

      return results;
    } catch (error) {
      console.error("Error fetching properties by view count:", error);
      throw new Error("Failed to fetch properties by view count");
    }
  }

  static async getProperties(page: number, limit: number, searchTerm?: string) {
    const offset = (page - 1) * limit;
    const baseCondition = and(
      eq(properties.approvalStatus, "APPROVED"),
      eq(properties.availablilityStatus, "AVAILABLE")
    );
    const createdByUser = alias(platformUsers, "createdByUser");
    const createdByAdmin = alias(adminUsers, "createdByAdmin");
    const userAlias = properties.createdByUserId
      ? createdByUser
      : createdByAdmin;
    const searchCondition = this.buildSearchCondition(searchTerm, userAlias);
    const whereCondition = searchCondition
      ? and(baseCondition, searchCondition)
      : baseCondition;

    const results = await db
      .select({
        property: properties,
        seo: propertySeo,
        verification: propertyVerification,
        user: {
          firstName: sql`
                      COALESCE(${createdByUser.firstName}, ${createdByAdmin.firstName})
                    `.as("firstName"),
          lastName: sql`
                      COALESCE(${createdByUser.lastName}, ${createdByAdmin.lastName})
                    `.as("lastName"),
        },
        images: sql`
                    COALESCE(json_agg(${propertyImages}.*) 
                    FILTER (WHERE ${propertyImages}.id IS NOT NULL), '[]')
                `.as("images"),
      })
      .from(properties)
      .innerJoin(
        propertyVerification,
        eq(properties.id, propertyVerification.propertyId)
      )
      .innerJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
      .leftJoin(createdByUser, eq(properties.createdByUserId, createdByUser.id))
      .leftJoin(
        createdByAdmin,
        eq(properties.createdByAdminId, createdByAdmin.id)
      )
      .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
      .where(whereCondition)
      .groupBy(
        properties.id,
        propertySeo.id,
        propertyVerification.id,
        createdByUser.id,
        createdByAdmin.id
      )
      .orderBy(desc(properties.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(properties)
      .leftJoin(userAlias, eq(properties.createdByUserId, userAlias.id))
      .where(whereCondition);

    return {
      data: results,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  static async getPropertyTotals(state?: string, district?: string) {
    const whereBase = and(
      eq(properties.approvalStatus, "APPROVED"),
      eq(properties.availablilityStatus, "AVAILABLE")
    );
    const withState = state
      ? and(whereBase, eq(properties.state, state))
      : whereBase;
    const whereCondition = district
      ? and(withState, eq(properties.district, district))
      : withState;

    const [{ totalProperties, totalValue }] = await db
      .select({
        totalProperties: sql<number>`COUNT(*)`,
        totalValue: sql<number>`COALESCE(SUM(${properties.price}), 0)`,
      })
      .from(properties)
      .where(whereCondition);

    return { totalProperties, totalValue };
  }

  static async getPropertiesPostedByAdmin(
    id: string,
    page: number,
    limit: number,
    approvalstatus?: "APPROVED" | "REJECTED" | "PENDING",
    searchTerm?: string
  ) {
    const offset = (page - 1) * limit;
    const conditions = [eq(properties.createdByAdminId, id)];
    if (approvalstatus) {
      conditions.push(eq(properties.approvalStatus, approvalstatus));
    }
    const searchCondition = this.buildSearchCondition(searchTerm);
    if (searchCondition) {
      conditions.push(searchCondition);
    }
    const whereCondition =
      conditions.length > 1 ? and(...conditions) : conditions[0];

    const results = await db
      .select({
        property: properties,
        seo: propertySeo,
        verification: propertyVerification,
        images: sql`
                    COALESCE(json_agg(${propertyImages}.*) 
                    FILTER (WHERE ${propertyImages}.id IS NOT NULL), '[]')
                `.as("images"),
      })
      .from(properties)
      .innerJoin(
        propertyVerification,
        eq(properties.id, propertyVerification.propertyId)
      )
      .innerJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
      .leftJoin(platformUsers, eq(properties.createdByUserId, platformUsers.id))
      .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
      .where(whereCondition)
      .groupBy(
        properties.id,
        propertySeo.id,
        propertyVerification.id,
        platformUsers.id
      )
      .orderBy(desc(properties.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(properties)
      .leftJoin(platformUsers, eq(properties.createdByUserId, platformUsers.id))
      .where(whereCondition);

    return {
      data: results,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  static async getTopProperties(userId?: string, limit = 5) {
    try {
      // Base select
      const baseSelect: any = {
        property: properties,
        seo: propertySeo,
        images: sql`
              COALESCE(json_agg(${propertyImages}.*)
              FILTER (WHERE ${propertyImages}.id IS NOT NULL), '[]')
            `.as("images"),
        user: platformUsers,
      };

      // Only add "saved" if userId exists
      if (userId) {
        baseSelect.saved = sql<boolean>`
              BOOL_OR(
                CASE 
                  WHEN ${savedProperties}.id IS NOT NULL 
                  THEN TRUE 
                  ELSE FALSE 
                END
              )
            `.as("saved");
      }

      let query = db
        .select(baseSelect)
        .from(properties)
        .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
        .leftJoin(
          platformUsers,
          eq(properties.createdByUserId, platformUsers.id)
        )
        .innerJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
        .where(
          and(
            eq(properties.approvalStatus, "APPROVED"),
            eq(properties.availablilityStatus, "AVAILABLE")
          )
        )
        .groupBy(properties.id, platformUsers.id, propertySeo.id)
        .orderBy(desc(properties.createdAt))
        .limit(limit);

      // Conditionally join savedProperties
      if (userId) {
        query = query.leftJoin(
          savedProperties,
          and(
            eq(properties.id, savedProperties.propertyId),
            eq(savedProperties.userId, userId)
          )
        );
      }

      const results = await query;
      return results;
    } catch (err) {
      console.error("Error fetching top properties:", err);
      throw err;
    }
  }

  static async getPropertiesByUser(
    userId: string,
    page: number,
    limit: number
  ) {
    const offset = (page - 1) * limit;

    const results = await db
      .select({
        property: properties,
        seo: propertySeo,
        images: sql`
            COALESCE(
                json_agg(DISTINCT ${propertyImages}.*) 
                FILTER (WHERE ${propertyImages}.id IS NOT NULL), 
                '[]'
            )
        `.as("images"),
      })
      .from(properties)
      .leftJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
      .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
      .where(
        and(
          eq(properties.createdByUserId, userId),
          eq(properties.availablilityStatus, "AVAILABLE")
        )
      )
      .groupBy(properties.id, propertySeo.id)
      .orderBy(desc(properties.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(properties)
      .where(
        and(
          eq(properties.createdByUserId, userId),
          eq(properties.availablilityStatus, "AVAILABLE")
        )
      );

    return {
      data: results,
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

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
    console.log(rows);
    console.log(page, limit, total, totalPages);
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

  static buildSearchCondition(
    searchTerm?: string,
    createdByUser?: ReturnType<typeof alias>
  ) {
    if (!searchTerm || !searchTerm.trim()) return null;

    const likePattern = `%${searchTerm.trim()}%`;
    const userAlias = createdByUser || platformUsers;
    return or(
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
      ilike(userAlias.firstName, likePattern),
      ilike(userAlias.lastName, likePattern),
      ilike(userAlias.email, likePattern)
    );
  }

  static async fetchPropertiesByApprovalStatus(
    status: "PENDING" | "REJECTED" | "APPROVED",
    page: number,
    limit: number,
    searchTerm?: string,
    availablilityStatus?: "AVAILABLE" | "SOLD" | "MANAGED"
  ) {
    const offset = (page - 1) * limit;
    const availablilityCondition = availablilityStatus
      ? and(eq(properties.availablilityStatus, availablilityStatus))
      : null;
      let baseCondition;
      if(availablilityCondition){
         baseCondition = eq(properties.approvalStatus, status);
      }else{
         baseCondition = and(eq(properties.approvalStatus, status),not(eq(properties.availablilityStatus, 'MANAGED')));
      }
    const createdByUser = alias(platformUsers, "createdByUser");
    const ownerUser = alias(platformUsers, "ownerUser");
    const platformUserProfile = alias(
      platformUserProfiles,
      "platformUserProfile"
    );
    const platformOwnerProfile = alias(
      platformUserProfiles,
      "platformOwnerProfile"
    );
    const searchCondition = this.buildSearchCondition(
      searchTerm,
      createdByUser
    );
    const whereCondition = searchCondition
      ? availablilityCondition
        ? and(baseCondition, searchCondition, availablilityCondition)
        : and(baseCondition, searchCondition)
      : availablilityCondition
      ? and(baseCondition, availablilityCondition)
      : baseCondition;
    try {
      const results = await db
        .select({
          property: properties,
          seo: propertySeo,
          verification: propertyVerification,
          images: sql`
          COALESCE(json_agg(${propertyImages}.*)
          FILTER (WHERE ${propertyImages}.id IS NOT NULL), '[]')
        `.as("images"),
          user: {
            firstName: createdByUser?.firstName ?? ownerUser?.firstName,
            lastName: createdByUser?.lastName ?? ownerUser?.lastName,
            email: createdByUser?.email ?? ownerUser?.email,
            role: sql`CASE WHEN COALESCE(${createdByUser.role}, ${ownerUser.role}) = 'USER' THEN 'OWNER' ELSE COALESCE(${createdByUser.role}, ${ownerUser.role}) END`,
            phone:
              platformUserProfile?.phone ??
              platformOwnerProfile?.phone ??
              properties.ownerPhone,
          },
          createdByUser: {
            firstName: sql`
                          COALESCE(${createdByUser.firstName}, ${adminUsers.firstName})
                        `.as("firstName"),
            lastName: sql`
                          COALESCE(${createdByUser.lastName}, ${adminUsers.lastName})
                        `.as("lastName"),
          },
        })
        .from(properties)
        .leftJoin(
          propertyVerification,
          eq(properties.id, propertyVerification.propertyId)
        )
        .leftJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
        .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
        .leftJoin(
          createdByUser,
          eq(properties.createdByUserId, createdByUser.id)
        )
        .leftJoin(ownerUser, eq(properties.ownerId, ownerUser.id))
        .leftJoin(adminUsers, eq(properties.createdByAdminId, adminUsers.id))
        .leftJoin(
          platformUserProfile,
          eq(platformUserProfile.userId, createdByUser.id)
        )
        .leftJoin(
          platformOwnerProfile,
          eq(platformOwnerProfile.userId, createdByUser.id)
        )
        .where(whereCondition)
        .groupBy(
          properties.id,
          propertySeo.id,
          propertyVerification.id,
          createdByUser.id,
          ownerUser.id,
          platformOwnerProfile.id,
          platformUserProfile.id,
          adminUsers.id
        )
        .orderBy(desc(properties.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(properties)
        .leftJoin(
          createdByUser,
          eq(properties.createdByUserId, createdByUser.id)
        )
        .where(whereCondition);

      return {
        data: results,
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (error) {
      console.error(
        `❌ Failed to fetch ${status.toLowerCase()} properties:`,
        error
      );
      throw new Error(
        `Failed to fetch ${status.toLowerCase()} properties: ${error}`
      );
    }
  }

  static async getPendingApprovalProperties(
    page: number,
    limit: number,
    searchTerm?: string,
    availablilityStatus?: "AVAILABLE" | "SOLD" | "MANAGED"
  ) {
    return this.fetchPropertiesByApprovalStatus(
    "PENDING",
      page,
      limit,
      searchTerm,
      availablilityStatus
    );
  }

  static async getRejectedProperties(
    page: number,
    limit: number,
    searchTerm?: string,
    availablilityStatus?: "AVAILABLE" | "SOLD" | "MANAGED"

  ) {
    return this.fetchPropertiesByApprovalStatus(
      "REJECTED",
      page,
      limit,
      searchTerm,
      availablilityStatus
    );
  }

  static async getApprovedProperties(
    page: number,
    limit: number,
    searchTerm?: string,
    availablilityStatus?: "AVAILABLE" | "SOLD" | "MANAGED"
  ) {
    return this.fetchPropertiesByApprovalStatus(
      "APPROVED",
      page,
      limit,
      searchTerm,
      availablilityStatus
    );
  }

  static async getPropertyBySlug(slug: string) {
    try {
      const [seo] = await db
        .select()
        .from(propertySeo)
        .where(eq(propertySeo.slug, slug));

      if (!seo) {
        throw new Error(`No property found with slug: ${slug}`);
      }

      const property = await this.getPropertyById(seo.propertyId);

      return property;
    } catch (error) {
      console.error("❌ Failed to fetch property by slug:", error);
      throw new Error(`Failed to fetch property with slug "${slug}"`);
    }
  }

  static async getPropertyById(id: string) {
    try {
      const [property] = await db.execute(sql`
                SELECT
                  p.id,
                  p.listing_id as "listingId",
                  p.title,
                  p.description,
                  p.property_type as "propertyType",
                  p.price,
                  p.price_per_unit as "pricePerUnit",
                  p.area,
                  p.road_access_width as "roadAccessWidth",
                  p.road_access_distance_unit as "roadAccessDistanceUnit",
                  p.land_mark as "landMark",
                  p.landmark_name as "landMarkName",
                  p.approval_status as "status",
                  p.area_unit as "areaUnit",
                  p.khasra_number as "khasraNumber",
                  p.murabba_number as "murabbaNumber",
                  p.khewat_number as "khewatNumber",
                  p.water_level as "waterLevel",
                  p.land_mark as "landMark",
                  p.category as "category",
                  p.highway_conn as "highwayConn",
                  p.land_zoning as "landZoning",
                  p.owners_count as "ownersCount",
                  p.ownership_yes as "ownershipYes",
                  p.soil_type as "soilType",
                  p.road_access as "roadAccess",
                  p.road_access_distance as "roadAccessDistance",
                  p.address as "address",
                  p.city,
                  p.created_at as "createdAt",
                  p.created_by_type as "createdByType",
                  p.district,
                  p.state,
                  p.is_verified as "isVerified",
                  p.listing_as as "listingAs",
                  p.is_active as "isActive",
                  p.country,
                  p.pin_code as "pinCode",
                  p.location,
                  p.owner_name,
                  p.geo_json as "geoJson",
                  p.calculated_area as "calculatedArea",
                  p.admin_notes as "adminNotes",
                  p.last_reviewed_by as "lastReviewedBy",
                  p.last_reviewed_at as "lastReviewedAt",
                  COALESCE(u.id, o.id) AS owner_id,
                  COALESCE(u.email, o.email) AS email,
                  COALESCE(u.first_name, o.first_name,p.owner_name) AS first_name,
                  COALESCE(u.last_name, o.last_name) AS last_name,
                  COALESCE(up.phone, op.phone,p.owner_phone) AS phone,
                  COALESCE(u.role, o.role) AS role,
                  COALESCE(up.avatar, op.avatar) AS avatar
                FROM properties p
                LEFT JOIN platform_users u
                  ON p.created_by_user_id = u.id
                LEFT JOIN platform_user_profiles up
                  ON u.id = up.user_id
                -- Join platform_users by ownerId as fallback
                LEFT JOIN platform_users o
                  ON p.owner_id = o.id
                LEFT JOIN platform_user_profiles op
                  ON o.id = op.user_id
                WHERE p.id = ${id}
              `);

      const owner = {
        firstName: property.first_name,
        lastName: property.last_name,
        phone: property.phone,
        avatar: property.avatar,
        role: property.role === "USER" ? "OWNER" : property.role || "OWNER",
      };

      if (!property) {
        throw new Error(`Property with ID ${id} not found`);
      }

      const [seo] = await db
        .select()
        .from(propertySeo)
        .where(eq(propertySeo.propertyId, id));

      const images = await db
        .select()
        .from(propertyImages)
        .where(eq(propertyImages.propertyId, id));

      const result = {
        property: property,
        seo,
        images,
        owner,
      };
      return result;
    } catch (error) {
      console.error("❌ Error fetching property by ID:", error);
      throw new Error(`Failed to fetch property with ID ${id}`);
    }
  }

  static async createProperty(
    propertyData: any,
    userID: string,
    status: "draft" | "published"
  ) {
    const propertyId = uuidv4();
    const images = propertyData.images;
    const parse = await parsePropertyPolygon(propertyData?.map);

    let processedImages: PropertyImageData[] = [];
    if (images && images.length > 0) {
      if (images && images.length > 0) {
        const resolvedUploads = await Promise.all(
          images.map(async (upload: any) => {
            return await upload.promise;
          })
        );

        processedImages = await this.processPropertyImages(resolvedUploads);

        console.log("🖼️ Processed images:", processedImages);
      }
    }

    await db.transaction(async (tx) => {
      const createdProperty = await tx
        .insert(properties)
        .values({
          id: propertyId,
          propertyType:
            propertyData.propertyDetailsSchema.propertyType.toUpperCase(),
          status: "PUBLISHED",
          price: parseFloat(propertyData.propertyDetailsSchema.totalPrice),
          area: parseFloat(propertyData.propertyDetailsSchema.area),
          pricePerUnit: parseFloat(
            propertyData.propertyDetailsSchema.pricePerUnit
          ),
          areaUnit: propertyData.propertyDetailsSchema.areaUnit.toUpperCase(),
          khasraNumber: propertyData.propertyDetailsSchema.khasraNumber,
          murabbaNumber: propertyData.propertyDetailsSchema.murabbaNumber,
          khewatNumber: propertyData.propertyDetailsSchema.khewatNumber,
          address: propertyData.location.address,
          city: propertyData.location.city,
          district: propertyData.location.district,
          state: propertyData.location.state,
          pinCode: propertyData.location.pincode,
          ...parse,
          ownerName: propertyData.contactDetails.ownerName,
          ownerPhone: propertyData.contactDetails.phoneNumber,
          ownerWhatsapp: propertyData.contactDetails.whatsappNumber || null,
          isActive: true,
          publishedAt: new Date(),
          createdByType: "ADMIN",
          createdByAdminId: userID,
          approvalStatus: "PENDING",
          ownerId: propertyData.contactDetails.ownerId,
          waterLevel: propertyData.propertyDetailsSchema.waterLevel,
          landMark: propertyData.propertyDetailsSchema.landMark,
          category: propertyData.propertyDetailsSchema.category,
          highwayConn: propertyData.propertyDetailsSchema.highwayConn,
          landZoning: propertyData.propertyDetailsSchema.landZoning,
          ownersCount: propertyData.propertyDetailsSchema.ownersCount,
          ownershipYes: propertyData.propertyDetailsSchema.ownershipYes,
          soilType: propertyData.propertyDetailsSchema.soilType,
          roadAccess: propertyData.propertyDetailsSchema.roadAccess,
          roadAccessDistance:
            propertyData.propertyDetailsSchema.roadAccessDistance,
          landMarkName: propertyData.propertyDetailsSchema.landMarkName,
          roadAccessWidth: propertyData.propertyDetailsSchema.roadAccessWidth,
          roadAccessDistanceUnit:
            propertyData.propertyDetailsSchema.roadAccessDistanceUnit,
        })
        .returning({ listing_id: properties.listingId });

      const generateSeo = await SeoGenerator.generateSEOFields(
        createdProperty[0].listing_id,
        propertyData.propertyDetailsSchema.propertyType,
        propertyData.location.city,
        propertyData.location.district
      );

      await tx
        .update(properties)
        .set({
          title: generateSeo.title,
          description: generateSeo.seoDescription,
        })
        .where(eq(properties.listingId, createdProperty[0].listing_id));

      await tx.insert(propertySeo).values({
        propertyId,
        seoTitle: generateSeo.seoTitle,
        seoDescription: generateSeo.seoDescription,
        slug: generateSeo.slug,
        seoKeywords: generateSeo.seoKeywords,
      });
      if (processedImages.length > 0) {
        const imageInserts = processedImages.map((img, index) => ({
          propertyId,
          imageUrl: img.imageUrl,
          imageType: img.imageType || "general",
          caption: img.caption || "",
          altText: img.altText || "",
          sortOrder: img.sortOrder || index,
          variants: img.variants,
          isMain: img.isMain || index === 0,
        }));

        await tx.insert(propertyImages).values(imageInserts);
      }

      await tx.insert(propertyVerification).values({
        propertyId,
        isVerified: false,
        verificationMessage: "Verification Pending",
      });
    });

    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId));
    const [seo] = await db
      .select()
      .from(propertySeo)
      .where(eq(propertySeo.propertyId, propertyId));
    const [verification] = await db
      .select()
      .from(propertyVerification)
      .where(eq(propertyVerification.propertyId, propertyId));
    const imagesResult = await db
      .select()
      .from(propertyImages)
      .where(eq(propertyImages.propertyId, propertyId));
    const result = {
      ...property,
      seo,
      verification,
      images: imagesResult,
    };

    return result;
  }

  static async createPropertyByUser(propertyData: any, userID: string) {
    const propertyId = uuidv4();
    console.log(propertyData);
    const images = propertyData.images;
    const isManaged = propertyData.flag === "MANAGED";
    const planId = propertyData.planId ?? null;
    let parse: any;
    if (!isManaged) {
      parse = await parsePropertyPolygon(propertyData?.map);
    }
    let processedImages: PropertyImageData[] = [];
    if (images && images.length > 0) {
      if (images && images.length > 0) {
        const resolvedUploads = await Promise.all(
          images.map(async (upload: any) => {
            return await upload.promise;
          })
        );

        processedImages = await this.processPropertyImages(resolvedUploads);

        console.log("🖼️ Processed images:", processedImages);
      }
    }

    console.log(processedImages);

    await db.transaction(async (tx) => {
      const createdProperty = await tx
        .insert(properties)
        .values({
          id: propertyId,
          propertyType: propertyData.propertyDetailsSchema?.propertyType
            ? propertyData.propertyDetailsSchema.propertyType.toUpperCase()
            : propertyData.PropertyType,
          status: "PUBLISHED",
          price:
            parseFloat(propertyData?.propertyDetailsSchema?.totalPrice) ||
            parseFloat("0"),
          area:
            parseFloat(propertyData?.propertyDetailsSchema?.area) ||
            parseFloat(propertyData.Area),
          title: propertyData.title ?? "",
          description: propertyData.description ?? "",
          pricePerUnit:
            parseFloat(propertyData?.propertyDetailsSchema?.pricePerUnit) ||
            parseFloat("0"),
          areaUnit:
            propertyData?.propertyDetailsSchema?.areaUnit.toUpperCase() ||
            propertyData.AreaUnit,
          khasraNumber:
            propertyData?.propertyDetailsSchema?.khasraNumber ?? null,
          murabbaNumber:
            propertyData?.propertyDetailsSchema?.murabbaNumber ?? null,
          khewatNumber:
            propertyData?.propertyDetailsSchema?.khewatNumber ?? null,
          address: propertyData?.location?.address ?? "Property Management",
          city: propertyData?.location?.city ?? propertyData?.city ?? null,
          district:
            propertyData?.location?.district ?? propertyData?.district ?? null,
          state: propertyData?.location?.state ?? propertyData?.state ?? null,
          pinCode: propertyData?.location?.pincode ?? propertyData?.pincode,
          ...parse, // leaving as-is, this is your spread object
          isActive: true,
          publishedAt: new Date(),
          createdByType: "USER",
          createdByUserId: userID,
          waterLevel: propertyData?.propertyDetailsSchema?.waterLevel ?? null,
          landMark: propertyData?.propertyDetailsSchema?.landMark ?? null,
          category: propertyData?.propertyDetailsSchema?.category ?? null,
          highwayConn: propertyData?.propertyDetailsSchema?.highwayConn ?? null,
          landZoning: propertyData?.propertyDetailsSchema?.landZoning ?? null,
          ownersCount: propertyData?.propertyDetailsSchema?.ownersCount ?? null,
          ownershipYes:
            propertyData?.propertyDetailsSchema?.ownershipYes ?? null,
          soilType: propertyData?.propertyDetailsSchema?.soilType ?? null,
          roadAccess: propertyData?.propertyDetailsSchema?.roadAccess ?? null,
          roadAccessDistance:
            propertyData?.propertyDetailsSchema?.roadAccessDistance ?? null,
          landMarkName:
            propertyData?.propertyDetailsSchema?.landMarkName ?? null,
          roadAccessWidth:
            propertyData?.propertyDetailsSchema?.roadAccessWidth ?? null,
          roadAccessDistanceUnit:
            propertyData?.propertyDetailsSchema?.roadAccessDistanceUnit ?? null,
          availablilityStatus: isManaged ? "MANAGED" : "AVAILABLE",
        })
        .returning({ listing_id: properties.listingId });
      if (processedImages.length > 0) {
        const imageInserts = processedImages.map((img, index) => ({
          propertyId,
          imageUrl: img.imageUrl,
          imageType: img.imageType || "general",
          caption: img.caption || "",
          altText: img.altText || "",
          sortOrder: img.sortOrder || index,
          variants: img.variants,
          isMain: img.isMain || index === 0,
        }));

        await tx.insert(propertyImages).values(imageInserts);
      }

      if (!isManaged && !planId) {
        const generateSeo = await SeoGenerator.generateSEOFields(
          createdProperty[0].listing_id,
          propertyData.propertyDetailsSchema.propertyType,
          propertyData.location.city,
          propertyData.location.district
        );
        await tx
          .update(properties)
          .set({
            title: generateSeo.title,
            description: generateSeo.seoDescription,
          })
          .where(eq(properties.listingId, createdProperty[0].listing_id));

        await tx.insert(propertySeo).values({
          propertyId,
          seoTitle: generateSeo.seoTitle,
          seoDescription: generateSeo.seoDescription,
          slug: generateSeo.slug,
          seoKeywords: generateSeo.seoKeywords,
        });

        await tx.insert(propertyVerification).values({
          propertyId,
          isVerified: false,
          verificationMessage: "Verification Pending",
        });
      }

      if (isManaged) {
        await tx.insert(userProperty).values({
          userId: userID,
          propertyId,
          planVariantId: planId,
          agentId: propertyData.agentId ?? null,
          assignedBy: propertyData.assignedBy ?? null,
          assignedAt: propertyData.agentId ? new Date() : null,
          startDate: propertyData.startDate ?? null,
          endDate: propertyData.endDate ?? null,
          visitsRemaining: propertyData.visitsRemaining ?? null,
          status: "ACTIVE",
          active: true,
        });
      }
    });

    // 5️⃣ FETCH PROPERTY
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId));

    const imagesResult = await db
      .select()
      .from(propertyImages)
      .where(eq(propertyImages.propertyId, propertyId));

    // 6️⃣ CONDITIONAL RETURN BASED ON MANAGED FLAG
    if (isManaged) {
      return {
        property: property,
        images: imagesResult,
      };
    }

    // Fetch required data when NOT managed
    const [seo] = await db
      .select()
      .from(propertySeo)
      .where(eq(propertySeo.propertyId, propertyId));

    const [verification] = await db
      .select()
      .from(propertyVerification)
      .where(eq(propertyVerification.propertyId, propertyId));

    return {
      ...property,
      seo,
      verification,
      images: imagesResult,
    };
  }
}
