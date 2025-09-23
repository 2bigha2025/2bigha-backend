import { eq, and, gte, lte, like, desc, asc, sql, or, ilike} from "drizzle-orm";
import { db } from "../../database/connection";
import { v4 as uuidv4 } from "uuid";
import {
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
        const { propertyId, slug, seoTitle, seoDescription, seoKeywords, seoScore, schema } = input;

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

    static async getProperties(page: number, limit: number, searchTerm?: string) {
        const offset = (page - 1) * limit;
        const baseCondition = eq(properties.approvalStatus, "APPROVED");
        const searchCondition = this.buildSearchCondition(searchTerm);
        const whereCondition = searchCondition ? and(baseCondition, searchCondition) : baseCondition;

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
            .groupBy(properties.id, propertySeo.id, propertyVerification.id, platformUsers.id)
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

    static async getPropertyTotals(state?: string, district?: string) {
        const whereBase = eq(properties.approvalStatus, "APPROVED");
        const withState = state ? and(whereBase, eq(properties.state, state)) : whereBase;
        const whereCondition = district ? and(withState, eq(properties.district, district)) : withState;

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
        const whereCondition = conditions.length > 1 ? and(...conditions) : conditions[0];
        
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
            .groupBy(properties.id, propertySeo.id, propertyVerification.id, platformUsers.id)
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
            .leftJoin(platformUsers, eq(properties.createdByUserId, platformUsers.id))
            .innerJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
            .where(eq(properties.approvalStatus, "APPROVED"))
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
            .where(eq(properties.createdByUserId, userId))
            .groupBy(properties.id, propertySeo.id)
            .orderBy(desc(properties.createdAt))
            .limit(limit)
            .offset(offset);

        const [{ count }] = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(properties)
            .where(eq(properties.createdByUserId, userId));

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

    static buildSearchCondition(searchTerm?: string) {
        if (!searchTerm || !searchTerm.trim()) return null;

        const likePattern = `%${searchTerm.trim()}%`;

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
            ilike(platformUsers.firstName, likePattern),
            ilike(platformUsers.lastName, likePattern),
            ilike(platformUsers.email, likePattern)
        );
    }

    static async fetchPropertiesByApprovalStatus(
        status: "PENDING" | "REJECTED" | "APPROVED",
        page: number,
        limit: number,
        searchTerm?: string
    ) {
        const offset = (page - 1) * limit;

        const baseCondition = eq(properties.approvalStatus, status);
        const searchCondition = this.buildSearchCondition(searchTerm);
        const whereCondition = searchCondition ? and(baseCondition, searchCondition) : baseCondition;

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
                        firstName: platformUsers?.firstName,
                        lastName: platformUsers?.lastName,
                        email: platformUsers?.email,
                        role: platformUsers?.role,
                        phone: platformUserProfiles?.phone,
                    },
                })
                .from(properties)
                .innerJoin(propertyVerification, eq(properties.id, propertyVerification.propertyId))
                .innerJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
                .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
                .leftJoin(platformUsers, eq(properties.createdByUserId, platformUsers.id))
                .leftJoin(platformUserProfiles, eq(platformUserProfiles.userId, platformUsers.id))
                .where(whereCondition)
                .groupBy(
                    properties.id,
                    propertySeo.id,
                    propertyVerification.id,
                    platformUsers.id,
                    platformUserProfiles.id
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
        } catch (error) {
            console.error(`❌ Failed to fetch ${status.toLowerCase()} properties:`, error);
            throw new Error(`Failed to fetch ${status.toLowerCase()} properties: ${error}`);
        }
    }

    static async getPendingApprovalProperties(page: number, limit: number, searchTerm?: string) {
        return this.fetchPropertiesByApprovalStatus("PENDING", page, limit, searchTerm);
    }

    static async getRejectedProperties(page: number, limit: number, searchTerm?: string) {
        return this.fetchPropertiesByApprovalStatus("REJECTED", page, limit, searchTerm);
    }

    static async getApprovedProperties(page: number, limit: number, searchTerm?: string) {
        return this.fetchPropertiesByApprovalStatus("APPROVED", page, limit, searchTerm);
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
                  p.title,
                  p.description,
                  p.property_type as "propertyType",
                  p.price,
                  p.price_per_unit as "PricePerUnit",
                  p.area,
                  p.state as "status",
                  p.area_unit as "areaUnit",
                  p.khasra_number as "khasraNumber",
                  p.murabba_number as "murabbaNumber",
                  p.khewat_number as "khewatNumber",
                  p.address as "address",
                  p.city,
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
                firstName : property.first_name,
                lastName : property.last_name,
                phone : property.phone,
                avatar : property.avatar,
                role : property.role === 'USER' ? "OWNER" : property.role || "OWNER"
              }

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
                owner
            };
            return result
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
           const createdProperty =  await tx.insert(properties).values({
                id: propertyId,
                propertyType:
                    propertyData.propertyDetailsSchema.propertyType.toUpperCase(),
                status: "PUBLISHED",
                price: parseFloat(propertyData.propertyDetailsSchema.totalPrice),
                area: parseFloat(propertyData.propertyDetailsSchema.area),
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
            }).returning({listing_id:properties.listingId});

            const generateSeo = await SeoGenerator.generateSEOFields(
                createdProperty[0].listing_id,
                propertyData.propertyDetailsSchema.propertyType,
                propertyData.location.city,
                propertyData.location.district,
            );

            await tx.update(properties)
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

       

        console.log(processedImages);

        await db.transaction(async (tx) => {
            const createdProperty = await tx.insert(properties).values({
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
                isActive: true,
                publishedAt: new Date(),
                createdByType: "USER",
                createdByUserId: userID,
            }).returning({listing_id:properties.listingId});

            const generateSeo = await SeoGenerator.generateSEOFields(
                createdProperty[0].listing_id,
                propertyData.propertyDetailsSchema.propertyType,
                propertyData.location.city,
                propertyData.location.district
            );

            await tx.update(properties)
            .set({
                title: generateSeo.title,
                description: generateSeo.seoDescription,
            })
            .where(eq(properties.listingId, createdProperty[0].listing_id));

            console.log('>>>>>>>createdProperty>>>>>>',createdProperty)

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
}