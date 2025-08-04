import { eq, and, gte, lte, like, desc, asc, sql } from "drizzle-orm";
import { db } from "../../database/connection";
import { v4 as uuidv4 } from "uuid";
import {
    platformUserProfiles,
    platformUsers,
    properties,
    propertyImages,
    propertySeo,
    propertyVerification,
} from "../../database/schema/index";
import { azureStorage, FileUpload } from "../../../src/utils/azure-storage";
import { SeoGenerator } from "./seo-generator.service";
import { error } from "console";

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
                return []; // or throw new Error("All uploads failed.") if you want to stop completely
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

    static async getProperties(page: number, limit: number) {
        const offset = (page - 1) * limit;

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
            .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
            .where(eq(properties.approvalStatus, "APPROVED"))
            .groupBy(properties.id, propertySeo.id, propertyVerification.id)
            .orderBy(desc(properties.createdAt))
            .limit(limit)
            .offset(offset);

        const [{ count }] = await db
            .select({ count: sql<number>`COUNT(*)` })
            .from(properties)
            .where(eq(properties.approvalStatus, "APPROVED"));

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

    static async getTopProperties(limit = 10) {
        try {
            const results = await db
                .select({
                    property: properties,
                    seo: propertySeo,
                    images: sql`
                    COALESCE(json_agg(${propertyImages}.*)
                    FILTER (WHERE ${propertyImages}.id IS NOT NULL), '[]')
                `.as("images"),
                    user: platformUsers,
                })
                .from(properties)
                .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))
                .leftJoin(
                    platformUsers,
                    eq(properties.createdByUserId, platformUsers.id)
                )
                .innerJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
                .where(eq(properties.approvalStatus, "APPROVED"))
                .groupBy(properties.id, platformUsers.id, propertySeo.id)

                .orderBy(desc(properties.createdAt)) // or `desc(properties.views)` if you have views
                .limit(limit);

            return results;
        } catch (error) {
            console.error("❌ Failed to fetch top properties:", error);
            throw new Error("Failed to fetch top properties");
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
                // ... add other individual columns you need instead of entire tables
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

    static async getPendingApprovalProperties(page: number, limit: number) {
        try {
            const offset = (page - 1) * limit;

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
                .innerJoin(
                    propertyVerification,
                    eq(properties.id, propertyVerification.propertyId)
                )

                .innerJoin(propertySeo, eq(properties.id, propertySeo.propertyId))
                .leftJoin(propertyImages, eq(properties.id, propertyImages.propertyId))

                .where(and(eq(properties.approvalStatus, "PENDING")))
                .leftJoin(
                    platformUsers,
                    eq(properties.createdByUserId, platformUsers.id)
                )

                .leftJoin(
                    platformUserProfiles,
                    eq(platformUserProfiles.userId, platformUsers.id)
                )
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
                .where(and(eq(properties.approvalStatus, "PENDING")));

            console.log(results);
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
            console.error("❌ Failed to fetch pending approval properties:", error);
            throw new Error(`Failed to fetch pending approval properties: ${error}`);
        }
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

            if (property?.property?.createdByType === "ADMIN") {
                let adminProperty = property;

                const owner = {
                    id: property?.property?.id,
                    email: "info@2bigha.ai",
                    firstName: property?.property?.ownerName,
                    lastName: null,
                    phone: property?.property?.ownerPhone,
                };

                adminProperty.owner = owner;

                return adminProperty;
            }

            // console.log(property);
            return property;
        } catch (error) {
            console.error("❌ Failed to fetch property by slug:", error);
            throw new Error(`Failed to fetch property with slug "${slug}"`);
        }
    }
    static async getPropertyById(id: string) {
        try {
            const [property] = await db
                .select({
                    property: properties,
                    owner: {
                        id: platformUsers?.id,
                        email: platformUsers?.email,
                        firstName: platformUsers?.firstName,
                        lastName: platformUsers?.lastName,
                        phone: platformUserProfiles?.phone,
                    },
                })
                .from(properties)
                .leftJoin(
                    platformUsers,
                    eq(properties.createdByUserId, platformUsers.id)
                )
                .leftJoin(
                    platformUserProfiles,
                    eq(platformUsers.id, platformUserProfiles.userId)
                )
                .where(eq(properties.id, id));

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

            return {
                property: property?.property,
                owner: property.owner,
                seo,
                images,
            };
        } catch (error) {
            console.error("❌ Error fetching property by ID:", error);
            throw new Error(`Failed to fetch property with ID ${id}`);
        }
    }

    // Get single property by ID or UUID
    // static async getPropertyById(id: number) {
    //     const [property] = await db.select().from(properties).where(eq(properties.id, id))
    //     return property
    // }

    // static async getPropertyByUuid(uuid: string) {
    //     const [property] = await db.select().from(properties).where(eq(properties.uuid, uuid))
    //     return property
    // }

    // Get featured properties
    // static async getFeaturedProperties(limit = 6) {
    //     return await db
    //         .select()
    //         .from(properties)
    //         .where(and(eq(properties.isFeatured, true), eq(properties.status, "approved")))
    //         .limit(limit)
    //         .orderBy(desc(properties.createdAt))
    // }

    // // Spatial queries
    // static async getPropertiesInBounds(minLat: number, maxLat: number, minLng: number, maxLng: number, limit = 50) {
    //     return await db
    //         .select()
    //         .from(properties)
    //         .where(
    //             and(
    //                 sql`latitude BETWEEN ${minLat} AND ${maxLat}`,
    //                 sql`longitude BETWEEN ${minLng} AND ${maxLng}`,
    //                 eq(properties.status, "approved"),
    //             ),
    //         )
    //         .limit(limit)
    // }

    // static async getPropertiesNearPoint(lat: number, lng: number, radiusKm: number, limit = 20) {
    //     return await db
    //         .select()
    //         .from(properties)
    //         .where(
    //             and(
    //                 sql`ST_DWithin(
    //         location,
    //         ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
    //         ${radiusKm * 1000}
    //       )`,
    //                 eq(properties.status, "approved"),
    //             ),
    //         )
    //         .limit(limit)
    // }

    // Create property
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

        const generateSeo = await SeoGenerator.generateSEOFields(
            propertyData.propertyDetailsSchema.propertyType,
            propertyData.location.city,
            propertyData.location.district
        );

        await db.transaction(async (tx) => {
            await tx.insert(properties).values({
                id: propertyId,
                title: generateSeo?.title,
                description: generateSeo?.seoDescription,
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
            });

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
                    isMain: img.isMain || index === 0, // First image is main by default
                }));

                await tx.insert(propertyImages).values(imageInserts);
            }

            await tx.insert(propertyVerification).values({
                propertyId,
                isVerified: false, // Assuming property is verified on creation
                verificationMessage: "Verification Pending",
            });
        });

        // Fetch the inserted property, seo, and verification records
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

        const generateSeo = await SeoGenerator.generateSEOFields(
            propertyData.propertyDetailsSchema.propertyType,
            propertyData.location.city,
            propertyData.location.district
        );

        console.log(processedImages);

        await db.transaction(async (tx) => {
            await tx.insert(properties).values({
                id: propertyId,
                title: generateSeo?.title,
                description: generateSeo?.seoDescription,
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
            });

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
                    isMain: img.isMain || index === 0, // First image is main by default
                }));

                await tx.insert(propertyImages).values(imageInserts);
            }

            await tx.insert(propertyVerification).values({
                propertyId,
                isVerified: false, // Assuming property is verified on creation
                verificationMessage: "Verification Pending",
            });
        });

        // Fetch the inserted property, seo, and verification records
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
