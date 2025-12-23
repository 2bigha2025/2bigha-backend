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
  isNotNull,
  inArray,
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
import { GraphQLError } from "graphql";

interface FarmImageData {
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
export function parseFarmPolygon(data: RawPolygonInput) {
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

export class FarmService {
  static async updateSeoFarm(input: {
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

  static async processFarmImages(
    images: FileUpload[],
    metadata: any[] = []
  ): Promise<FarmImageData[]> {
    if (!images || images.length === 0) {
      return [];
    }

    console.log(`🖼️ Processing ${images.length} farm images...`);

    try {
      // Upload images to Azure Storage
      const bulkResult = await azureStorage.uploadBulkFiles(images, "farms");

      const imageDataArray: FarmImageData[] = [];
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
          "farms"
        );
        const mainImageUrl = variants.large || variants.original;

        const imageData: FarmImageData = {
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

  static async getFarmsByLocation(
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
              inArray(properties.propertyType, ["FARMHOUSE", "FARMLAND"]),
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
              inArray(properties.propertyType, ["FARMHOUSE", "FARMLAND"]),
              eq(properties.isActive, true)
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
  //   static async getFarmsByViewCount(
  //     limit: number = 10,
  //     minViewCount?: number
  //   ) {
  //     try {
  //       const createdByUser = alias(platformUsers, "createdByUser");

  //       const whereConditions = [
  //         eq(properties.approvalStatus, "APPROVED"),
  //         eq(properties.isActive, true),
  //       ];

  //       // Add minimum view count filter if provided
  //       if (minViewCount !== undefined) {
  //         whereConditions.push(sql`${properties.viewCount} >= ${minViewCount}`);
  //       }

  //       const results = await db
  //         .select({
  //           property: properties,
  //           seo: propertySeo,
  //           verification: propertyVerification,
  //           user: {
  //             firstName: createdByUser.firstName,
  //             lastName: createdByUser.lastName,
  //           },
  //           images: sql`
  //                     COALESCE(json_agg(${propertyImages}.*)
  //                     FILTER (WHERE ${propertyImages}.id IS NOT NULL), '[]')
  //                 `.as("images"),
  //         })
  //         .from(properties)
  //         .innerJoin(
  //           propertyVerification,
  //           eq(properties.id, propertyVerification.propertyId)
  //         )
  //         .innerJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
  //         .leftJoin(
  //           createdByUser,
  //           eq(properties.createdByUserId, createdByUser.id)
  //         )
  //         .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
  //         .where(and(...whereConditions))
  //         .groupBy(
  //           properties.id,
  //           propertySeo.id,
  //           propertyVerification.id,
  //           createdByUser.id
  //         )
  //         .orderBy(desc(properties.viewCount)) // Order by view count descending
  //         .limit(limit);

  //       return results;
  //     } catch (error) {
  //       console.error("Error fetching properties by view count:", error);
  //       throw new Error("Failed to fetch properties by view count");
  //     }
  //   }

  static async getFarms(page: number, limit: number, searchTerm?: string) {
    const offset = (page - 1) * limit;

    const baseCondition = and(
      eq(properties.approvalStatus, "APPROVED"),
      inArray(properties.propertyType, ["FARMHOUSE", "FARMLAND"]),
    );

    const owner = alias(platformUsers, "owner");
    const ownerProfile = alias(platformUserProfiles, "ownerProfile");

    const searchCondition = this.buildSearchCondition(searchTerm, owner);
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
          ${owner.firstName}
        `.as("firstName"),
          lastName: sql`
          ${owner.lastName}
        `.as("lastName"),
          phone: sql`
          ${ownerProfile.phone}
        `.as("phone"),
          role: sql`
          COALESCE(
            ${owner.role}
          )
        `.as("role"),
        },
        images: sql`
        COALESCE(
          json_agg(${propertyImages}.*) 
          FILTER (WHERE ${propertyImages}.id IS NOT NULL), 
          '[]'
        )
      `.as("images"),
      })
      .from(properties)
      .innerJoin(
        propertyVerification,
        eq(properties.id, propertyVerification.propertyId)
      )
      .innerJoin(propertySeo, eq(properties.id, propertySeo.propertyId))

      .leftJoin(owner, eq(properties.ownerId, owner.id))

      .leftJoin(ownerProfile, eq(owner.id, ownerProfile.userId))

      .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))

      .where(whereCondition)
      .groupBy(
        properties.id,
        propertySeo.id,
        propertyVerification.id,
        owner.id,
        ownerProfile.id
      )
      .orderBy(desc(properties.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(properties)
      .leftJoin(owner, eq(properties.ownerId, owner.id))
      .where(whereCondition);

    return {
      data: results.map((result) => ({
        property: result.property,
        verification: result.verification,
        user: result.user,
        images: result.images,
        seo: result.seo,
      })),
      meta: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  static async getFarmsTotals(state?: string, district?: string) {
    // const whereBase = eq(properties.approvalStatus, "APPROVED");
    const whereBase = and(
      eq(properties.approvalStatus, "APPROVED"),
      inArray(properties.propertyType, ["FARMHOUSE", "FARMLAND"]),
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

  static async getFarmsPostedByAdmin(
    id: string,
    page: number,
    limit: number,
    approvalstatus?: "APPROVED" | "REJECTED" | "PENDING",
    searchTerm?: string
  ) {
    const offset = (page - 1) * limit;
    const conditions = [
      eq(properties.createdByAdminId, id),
     inArray(properties.propertyType, ["FARMHOUSE", "FARMLAND"]),
    ];

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
        user: {
          // CREATOR details
          firstName: sql`
            COALESCE(${adminUsers.firstName})
          `.as("firstName"),
          lastName: sql`
            COALESCE(${adminUsers.lastName})
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
      .leftJoin(adminUsers, eq(properties.createdByAdminId, adminUsers.id))
      .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
      .where(whereCondition)
      .groupBy(
        properties.id,
        propertySeo.id,
        propertyVerification.id,
        adminUsers.id
      )
      .orderBy(desc(properties.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(properties)
      .leftJoin(adminUsers, eq(properties.createdByAdminId, adminUsers.id))
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

static async getTopFarms(userId?: string, page?: number, limit = 5) {

    try {
      const owner = alias(platformUsers, "owner");
      const ownerProfile = alias(platformUserProfiles, "ownerProfile");

      // Create base select object
      const baseSelect: any = {
        property: properties,
        seo: propertySeo,
        verification: propertyVerification,
        images: sql`
        COALESCE(
          json_agg(${propertyImages}.*)
          FILTER (WHERE ${propertyImages}.id IS NOT NULL),
          '[]'
        )
      `.as("images"),

        user: {
          firstName: sql`${owner.firstName}`.as("firstName"),
          lastName: sql`${owner.lastName}`.as("lastName"),
          phone: sql`${ownerProfile.phone}`.as("phone"),
          role: sql`COALESCE(${owner.role})`.as("role"),
        },
      };

      let query = db
        .select(baseSelect)
        .from(properties)
        .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
        .innerJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
        .innerJoin(
          propertyVerification,
          eq(properties.id, propertyVerification.propertyId)
        )
        .leftJoin(owner, eq(properties.ownerId, owner.id))
        .leftJoin(ownerProfile, eq(owner.id, ownerProfile.userId))
        .where(
          and(
            eq(properties.approvalStatus, "APPROVED"),
            inArray(properties.propertyType, ["FARMHOUSE", "FARMLAND"]),
          )
        )
        .groupBy(
          properties.id,
          propertySeo.id,
          propertyVerification.id,
          owner.id,
          ownerProfile.id
        )
        .orderBy(asc(properties.createdAt))
        .limit(limit);

      if (userId) {
        baseSelect.saved = sql<boolean>`
          BOOL_OR(${savedProperties}.id IS NOT NULL)
        `.as("saved");

        query = query.leftJoin(
          savedProperties,
          and(
            eq(savedProperties.propertyId, properties.id),
            eq(savedProperties.userId, userId)
          )
        );
        
        query = query.groupBy(savedProperties.id);
      }

      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(properties)
        .leftJoin(owner, eq(properties.ownerId, owner.id))
        .where(
          and(
            eq(properties.approvalStatus, "PENDING"),
            inArray(properties.propertyType, ["FARMHOUSE", "FARMLAND"]),
          )
        );

      const results = await query;

      return {
        data: results.map((result) => ({
          property: result.property,
          verification: result.verification,
          user: result.user,
          images: result.images,
          seo: result.seo,
          ...(userId && { saved: result.saved })
        })),
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (err) {
      console.error("Error fetching top farms:", err);
      throw err;
    }
  }

  static async getNewFarms(page?: number, limit = 5, searchTerm?: string) {
    try {
      const owner = alias(platformUsers, "owner");
      const ownerProfile = alias(platformUserProfiles, "ownerProfile");

      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - Number(searchTerm));

      const baseSelect: any = {
        property: properties,
        seo: propertySeo,
        verification: propertyVerification,
        images: sql`
        COALESCE(
          json_agg(${propertyImages}.*)
          FILTER (WHERE ${propertyImages}.id IS NOT NULL),
          '[]'
        )
      `.as("images"),
        user: {
          firstName: sql`${owner.firstName}`.as("firstName"),
          lastName: sql`${owner.lastName}`.as("lastName"),
          phone: sql`${ownerProfile.phone}`.as("phone"),
          role: sql`COALESCE(${owner.role})`.as("role"),
        },
      };

      let query = db
        .select(baseSelect)
        .from(properties)
        .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
        .innerJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
        .innerJoin(
          propertyVerification,
          eq(properties.id, propertyVerification.propertyId)
        )
        .leftJoin(owner, eq(properties.ownerId, owner.id))
        .leftJoin(ownerProfile, eq(owner.id, ownerProfile.userId))
        .where(
          and(
            eq(properties.approvalStatus, "APPROVED"),
           inArray(properties.propertyType, ["FARMHOUSE", "FARMLAND"]),
          )
        )
        .groupBy(
          properties.id,
          propertySeo.id,
          propertyVerification.id,
          owner.id,
          ownerProfile.id
        )
        .orderBy(desc(properties.createdAt))
        .limit(limit);

      // Update count query to also filter by date
      const [{ count }] = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(properties)
        .leftJoin(owner, eq(properties.ownerId, owner.id))
        .where(
          and(
            eq(properties.approvalStatus, "PENDING"),
           inArray(properties.propertyType, ["FARMHOUSE", "FARMLAND"]),
            gte(properties.createdAt, twoDaysAgo)
          )
        );

      const results = await query;

      return {
        data: results.map((result) => ({
          property: result.property,
          verification: result.verification,
          user: result.user,
          images: result.images,
          seo: result.seo,
        })),
        meta: {
          total: count,
          page,
          limit,
          totalPages: Math.ceil(count / limit),
        },
      };
    } catch (err) {
      console.error("Error fetching new farms:", err);
      throw err;
    }
  }

  // static async getFarmsByUser(userId: string, page: number, limit: number) {
  //   const offset = (page - 1) * limit;

  //   const results = await db
  //     .select({
  //       property: properties,
  //       seo: propertySeo,
  //       images: sql`
  //           COALESCE(
  //               json_agg(DISTINCT ${propertyImages}.*) 
  //               FILTER (WHERE ${propertyImages}.id IS NOT NULL), 
  //               '[]'
  //           )
  //       `.as("images"),
  //     })
  //     .from(properties)
  //     .leftJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
  //     .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
  //     .where(
  //       and(
  //         eq(properties.createdByUserId, userId),
  //         inArray(properties.propertyType, ["FARMHOUSE", "FARMLAND"]),
  //       )
  //     )
  //     .groupBy(properties.id, propertySeo.id)
  //     .orderBy(desc(properties.createdAt))
  //     .limit(limit)
  //     .offset(offset);

  //   const [{ count }] = await db
  //     .select({ count: sql<number>`COUNT(*)` })
  //     .from(properties)
  //     .where(
  //       and(
  //         eq(properties.createdByUserId, userId),
  //         inArray(properties.propertyType, ["FARMHOUSE", "FARMLAND"]),
  //       )
  //     );

  //   return {
  //     data: results,
  //     meta: {
  //       total: count,
  //       page,
  //       limit,
  //       totalPages: Math.ceil(count / limit),
  //     },
  //   };
  // }

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
    ilike(userAlias.firstName, likePattern),
    ilike(userAlias.lastName, likePattern),
    ilike(userAlias.email, likePattern)
  )
  }

  // static async fetchFarmsByApprovalStatus(
  //   status: "PENDING" | "REJECTED" | "APPROVED",
  //   page: number,
  //   limit: number,
  //   searchTerm?: string
  // ) {
  //   const offset = (page - 1) * limit;

  //   const baseCondition = [
  //     eq(properties.approvalStatus, status),inArray(properties.propertyType, ["FARMHOUSE", "FARMLAND"])];

  //   const createdByUser = alias(platformUsers, "createdByUser");
  //   const ownerUser = alias(platformUsers, "ownerUser");
  //   const platformUserProfile = alias(
  //     platformUserProfiles,
  //     "platformUserProfile"
  //   );
  //   const platformOwnerProfile = alias(
  //     platformUserProfiles,
  //     "platformOwnerProfile"
  //   );
  //   const searchCondition = this.buildSearchCondition(
  //     searchTerm,
  //     createdByUser
  //   );
  //   const whereCondition = searchCondition
  //     ? and(...baseCondition, searchCondition)
  //     : and(...baseCondition);
  //   try {
  //     const results = await db
  //       .select({
  //         property: properties,
  //         seo: propertySeo,
  //         verification: propertyVerification,
  //         images: sql`
  //         COALESCE(json_agg(${propertyImages}.*)
  //         FILTER (WHERE ${propertyImages}.id IS NOT NULL), '[]')
  //       `.as("images"),
  //         user: {
  //           firstName: createdByUser?.firstName ?? ownerUser?.firstName,
  //           lastName: createdByUser?.lastName ?? ownerUser?.lastName,
  //           email: createdByUser?.email ?? ownerUser?.email,
  //           role: sql`CASE WHEN COALESCE(${createdByUser.role}, ${ownerUser.role}) = 'USER' THEN 'OWNER' ELSE COALESCE(${createdByUser.role}, ${ownerUser.role}) END`,
  //           phone:
  //             platformUserProfile?.phone ??
  //             platformOwnerProfile?.phone ??
  //             properties.ownerPhone,
  //         },
  //         createdByUser: {
  //           firstName: sql`
  //                         COALESCE(${createdByUser.firstName}, ${adminUsers.firstName})
  //                       `.as("firstName"),
  //           lastName: sql`
  //                         COALESCE(${createdByUser.lastName}, ${adminUsers.lastName})
  //                       `.as("lastName"),
  //         },
  //       })
  //       .from(properties)
  //       .innerJoin(
  //         propertyVerification,
  //         eq(properties.id, propertyVerification.propertyId)
  //       )
  //       .innerJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
  //       .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
  //       .leftJoin(
  //         createdByUser,
  //         eq(properties.createdByUserId, createdByUser.id)
  //       )
  //       .leftJoin(ownerUser, eq(properties.ownerId, ownerUser.id))
  //       .leftJoin(adminUsers, eq(properties.createdByAdminId, adminUsers.id))
  //       .leftJoin(
  //         platformUserProfile,
  //         eq(platformUserProfile.userId, createdByUser.id)
  //       )
  //       .leftJoin(
  //         platformOwnerProfile,
  //         eq(platformOwnerProfile.userId, createdByUser.id)
  //       )
  //       .where(whereCondition)
  //       .groupBy(
  //         properties.id,
  //         propertySeo.id,
  //         propertyVerification.id,
  //         createdByUser.id,
  //         ownerUser.id,
  //         platformOwnerProfile.id,
  //         platformUserProfile.id,
  //         adminUsers.id
  //       )
  //       .orderBy(desc(properties.createdAt))
  //       .limit(limit)
  //       .offset(offset);

  //     const [{ count }] = await db
  //       .select({ count: sql<number>`COUNT(*)` })
  //       .from(properties)
  //       .leftJoin(
  //         createdByUser,
  //         eq(properties.createdByUserId, createdByUser.id)
  //       )
  //       .where(whereCondition);

  //     return {
  //       data: results,
  //       meta: {
  //         total: count,
  //         page,
  //         limit,
  //         totalPages: Math.ceil(count / limit),
  //       },
  //     };
  //   } catch (error) {
  //     console.error(
  //       `❌ Failed to fetch ${status.toLowerCase()} properties:`,
  //       error
  //     );
  //     throw new Error(
  //       `Failed to fetch ${status.toLowerCase()} properties: ${error}`
  //     );
  //   }
  // }

  static async fetchFarmsByApprovalStatus(
  status: "PENDING" | "REJECTED" | "APPROVED",
  page: number,
  limit: number,
  searchTerm?: string
) {
  const offset = (page - 1) * limit;

  // Base conditions
  const baseCondition = [
    eq(properties.approvalStatus, status),
    inArray(properties.propertyType, ["FARMHOUSE", "FARMLAND"]),
  ];

  // Aliases
  const createdByUser = alias(platformUsers, "createdByUser"); // creator
  const ownerUser = alias(platformUsers, "ownerUser"); // owner

  const platformUserProfile = alias(platformUserProfiles, "platformUserProfile"); // creator profile
  const platformOwnerProfile = alias(platformUserProfiles, "platformOwnerProfile"); // owner profile

  // Search condition (only applied on creator)
  const searchCondition = this.buildSearchCondition(searchTerm, createdByUser);

  const whereCondition = searchCondition
    ? and(...baseCondition, searchCondition)
    : and(...baseCondition);

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
          // OWNER details
          firstName: ownerUser.firstName,
          lastName: ownerUser.lastName,
          email: ownerUser.email,
          role: sql`
            CASE 
              WHEN ${ownerUser.role} = 'USER' THEN 'OWNER'
              ELSE ${ownerUser.role}
            END
          `,
          phone:
            platformOwnerProfile.phone ??
            properties.ownerPhone,
        },
        createdByUser: {
          // CREATOR details
          firstName: sql`
            COALESCE(${createdByUser.firstName}, ${adminUsers.firstName})
          `.as("firstName"),
          lastName: sql`
            COALESCE(${createdByUser.lastName}, ${adminUsers.lastName})
          `.as("lastName"),
        },
      })
      .from(properties)
      .innerJoin(
        propertyVerification,
        eq(properties.id, propertyVerification.propertyId)
      )
      .innerJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
      .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
      // Correct joins for user mapping
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
        eq(platformOwnerProfile.userId, ownerUser.id)
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

    // Total count
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


  static async getPendingApprovalFarms(
    page: number,
    limit: number,
    searchTerm?: string
  ) {
    return this.fetchFarmsByApprovalStatus("PENDING", page, limit, searchTerm);
  }

  static async getRejectedFarms(
    page: number,
    limit: number,
    searchTerm?: string
  ) {
    return this.fetchFarmsByApprovalStatus("REJECTED", page, limit, searchTerm);
  }

  static async getApprovedFarms(
    page: number,
    limit: number,
    searchTerm?: string
  ) {
    return this.fetchFarmsByApprovalStatus("APPROVED", page, limit, searchTerm);
  }

  static async getFarmsBySlug(slug: string) {
    try {
      const [seo] = await db
        .select()
        .from(propertySeo)
        .where(eq(propertySeo.slug, slug));

      if (!seo) {
        throw new Error(`No property found with slug: ${slug}`);
      }

      const property = await this.getFarmById(seo.propertyId);

      return property;
    } catch (error) {
      console.error("❌ Failed to fetch property by slug:", error);
      throw new Error(`Failed to fetch property with slug "${slug}"`);
    }
  }

  static async getFarmById(id: string) {
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
                  p.property_name as "propertyName",
                  p.listing_type as "listingType",
                  p.highway_conn as "highwayConn",
                  p.is_price_negotiable as "isPriceNegotiable",
                  p.has_gated_community as "hasGatedCommunity",
                  p.multiple_size_options as "multipleSizeOptions",
                  p.nearest_major_city as "nearestMajorCity",
                  p.nearby_activities as "nearbyActivities",
                  p.scenic_features as "scenicFeatures",
                  p.amenities as "amenities",
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

  static async createFarmByAdmin(
    propertyData: any,
    userID: string,
    status: "draft" | "published"
  ) {
    const propertyId = uuidv4();
    const images = propertyData.images;
    const parse = await parseFarmPolygon(propertyData?.map);

    let processedImages: FarmImageData[] = [];
    if (images && images.length > 0) {
      if (images && images.length > 0) {
        const resolvedUploads = await Promise.all(
          images.map(async (upload: any) => {
            return await upload.promise;
          })
        );

        processedImages = await this.processFarmImages(resolvedUploads);

        console.log("🖼️ Processed images:", processedImages);
      }
    }

    await db.transaction(async (tx) => {
      const createdProperty = await tx
        .insert(properties)
        .values({
          id: propertyId,
          source: propertyData.farmDetailsSchema.source,
          propertyName: propertyData.farmDetailsSchema.propertyName,
          propertyType:
            propertyData.farmDetailsSchema.propertyType.toUpperCase(),
          status: "PUBLISHED",
          price: parseFloat(propertyData.farmDetailsSchema.price),
          area: parseFloat(propertyData.farmDetailsSchema.area),
          pricePerUnit: parseFloat(
            propertyData.farmDetailsSchema.pricePerUnit
          ),
          areaUnit: propertyData.farmDetailsSchema.areaUnit.toUpperCase(),

          address: propertyData.location.address,
          city: propertyData.location.city,
          district: propertyData.location.district,
          state: propertyData.location.state,
          ...parse,
          isActive: true,
          publishedAt: new Date(),
          createdByType: "ADMIN",
          createdByAdminId: userID,
          approvalStatus: "PENDING",
          ownerId: propertyData.contactDetails.ownerId,
          ownerName: propertyData.contactDetails.ownerName,
          ownerPhone: propertyData.contactDetails.phoneNumber,
          waterLevel: propertyData.farmDetailsSchema.waterLevel,
          highwayConn: propertyData.farmDetailsSchema.highwayConn,
          roadAccess: propertyData.farmDetailsSchema.roadAccess,
          roadAccessDistance: propertyData.farmDetailsSchema.roadAccessDistance,
          roadAccessWidth: propertyData.farmDetailsSchema.roadAccessWidth,
          roadAccessDistanceUnit:
            propertyData.farmDetailsSchema.roadAccessDistanceUnit,

          //  added column
          listingType: propertyData.farmDetailsSchema.listingType,
          listingAs: propertyData.contactDetails.listingAs,
          isPriceNegotiable: propertyData.farmDetailsSchema.isPriceNegotiable,
          hasGatedCommunity: propertyData.farmDetailsSchema.hasGatedCommunity,
          multipleSizeOptions:
            propertyData.farmDetailsSchema.multipleSizeOptions,
          nearestMajorCity: propertyData.farmDetailsSchema.nearestMajorCity,
          nearbyActivities: propertyData.farmDetailsSchema.nearbyActivities,
          scenicFeatures: propertyData.farmDetailsSchema.scenicFeatures,
          amenities: propertyData.farmDetailsSchema.amenities,
        })
        .returning({ listing_id: properties.listingId });

      const generateSeo = await SeoGenerator.generateFarmsSEOFields(
        createdProperty[0].listing_id,
        // propertyData.propertyDetailsSchema.farmName
        propertyData.farmDetailsSchema.propertyName,
        propertyData.farmDetailsSchema.propertyType,
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
    let [user] = await db
      .select({
        phone: platformUserProfiles.phone, // or whatever the column is named
        firstName: platformUsers.firstName,
        role: platformUsers.role,
      })
      .from(platformUsers)
      .innerJoin(
        platformUserProfiles,
        eq(platformUsers.id, platformUserProfiles.userId)
      )
      .where(eq(platformUserProfiles.userId, userID)) // Query from profile table
      .limit(1);

    const result = {
      property: property,
      seo,
      verification,
      images: imagesResult,
      user: user,
    };

    return result;
  }

  static async createFarmByUser(propertyData: any, userID: string) {
    const propertyId = uuidv4();

  //   const phone = propertyData?.contactDetails?.phoneNumber;
  //   if (!phone) {
  //     throw new Error("Phone number is required in contactDetails");
  //   }

  //   let ownerUser = await db
  //     .select({
  //       userId: platformUsers.id,
  //       userPhone: platformUserProfiles.phone, // or whatever the column is named
  //       firstName: platformUsers.firstName,
  //       role: platformUsers.role,
  //     })
  //     .from(platformUsers)
  //     .innerJoin(
  //       platformUserProfiles,
  //       eq(platformUsers.id, platformUserProfiles.userId)
  //     )
  //     .where(eq(platformUserProfiles.phone, phone)) // Query from profile table
  //     .limit(1);

  //   let ownerId: string;

  //   if (ownerUser.length > 0) {
  //     // User exists - get from joined result
  //      if (
  //   ownerUser[0].firstName &&
  //   propertyData?.contactDetails?.ownerName  &&
  //   propertyData?.contactDetails?.ownerName.trim().toLowerCase() !==
  //    ownerUser[0].firstName.toLowerCase()
  // ) {
  //   throw new GraphQLError(
  //     "This phone number already exists with a different user/company name",
  //     {
  //       extensions: {
  //         code: "OWNER_NAME_MISMATCH",
  //         field: "contactDetails.ownerName",
  //       },
  //     }
  //   );
  // }
  //     ownerId = ownerUser[0].userId;
  //     console.log("📌 Existing user found by phone, using ownerId:", ownerId);
  //   } else {
  //     // Create new user
  //     const newUserId = uuidv4();

  //     await db.transaction(async (tx) => {
  //       // Insert into platformUsers
  //       await tx.insert(platformUsers).values({
  //         id: newUserId,
  //         firstName: propertyData?.contactDetails?.ownerName || null,
  //         role: propertyData?.contactDetails?.listingAs || null,
  //         isActive: true,
  //         createdAt: new Date(),
  //       });

  //       // Insert into platform_user_profile with phone
  //       await tx.insert(platformUserProfiles).values({
  //         id: uuidv4(), // if needed
  //         userId: newUserId,
  //         phone: phone,
  //         alternativePhone: propertyData?.contactDetails?.alternativePhone,
  //         // other profile fields if available
  //         // createdAt: new Date(),
  //       });
  //     });

  //     ownerId = newUserId;
  //     console.log("✨ New platform user created with profile:", newUserId);
  //   }

  //   // Use ownerId also as createdByUserId

    const images = propertyData.images;

    const parse = await parseFarmPolygon(propertyData?.map);

    let processedImages: FarmImageData[] = [];
    if (images && images.length > 0) {
      if (images && images.length > 0) {
        const resolvedUploads = await Promise.all(
          images.map(async (upload: any) => {
            return await upload.promise;
          })
        );

        processedImages = await this.processFarmImages(resolvedUploads);

        console.log("🖼️ Processed images:", processedImages);
      }
    }


    await db.transaction(async (tx) => {
      const createdProperty = await tx
        .insert(properties)
        .values({
          id: propertyId,
          source: propertyData.farmDetailsSchema.source,
          propertyName: propertyData.farmDetailsSchema.propertyName,
          propertyType:
            propertyData.farmDetailsSchema.propertyType.toUpperCase(),
          status: "PUBLISHED",
          price: parseFloat(propertyData.farmDetailsSchema.price),
          area: parseFloat(propertyData.farmDetailsSchema.area),
          pricePerUnit: parseFloat(propertyData.farmDetailsSchema.pricePerUnit),
          areaUnit: propertyData.farmDetailsSchema.areaUnit.toUpperCase(),
          address: propertyData.location.address,
          city: propertyData.location.city,
          district: propertyData.location.district,
          state: propertyData.location.state,
          ...parse,
          isActive: true,
          publishedAt: new Date(),
          createdByType: "USER",
          createdByUserId: userID,
          ownerId: userID,
          approvalStatus: "PENDING",
          waterLevel: propertyData.farmDetailsSchema.waterLevel,
          highwayConn: propertyData.farmDetailsSchema.highwayConn,
          roadAccess: propertyData.farmDetailsSchema.roadAccess,
          roadAccessDistance: propertyData.farmDetailsSchema.roadAccessDistance,
          roadAccessWidth: propertyData.farmDetailsSchema.roadAccessWidth,
          roadAccessDistanceUnit:
            propertyData.farmDetailsSchema.roadAccessDistanceUnit,

          //  added column
          listingType: propertyData.farmDetailsSchema.listingType,
          listingAs: propertyData.contactDetails.listingAs,
          isPriceNegotiable: propertyData.farmDetailsSchema.isPriceNegotiable,
          hasGatedCommunity: propertyData.farmDetailsSchema.hasGatedCommunity,
          multipleSizeOptions:
            propertyData.farmDetailsSchema.multipleSizeOptions,
          nearestMajorCity: propertyData.farmDetailsSchema.nearestMajorCity,
          nearbyActivities: propertyData.farmDetailsSchema.nearbyActivities,
          scenicFeatures: propertyData.farmDetailsSchema.scenicFeatures,
          amenities: propertyData.farmDetailsSchema.amenities,
        })
        .returning({ listing_id: properties.listingId });

      const generateSeo = await SeoGenerator.generateFarmsSEOFields(
        createdProperty[0].listing_id,
        // propertyData.propertyDetailsSchema.farmName
        propertyData.farmDetailsSchema.propertyName,
        propertyData.farmDetailsSchema.propertyType,
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
    let [user] = await db
      .select({
        phone: platformUserProfiles.phone, // or whatever the column is named
        firstName: platformUsers.firstName,
        role: platformUsers.role,
      })
      .from(platformUsers)
      .innerJoin(
        platformUserProfiles,
        eq(platformUsers.id, platformUserProfiles.userId)
      )
      .where(eq(platformUserProfiles.userId, userID)) // Query from profile table
      .limit(1);

    const result = {
      property: property,
      seo,
      verification,
      images: imagesResult,
      user: user,
    };

    return result;
  }
}
