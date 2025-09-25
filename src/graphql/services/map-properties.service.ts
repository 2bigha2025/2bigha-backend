import { eq, and, gte, lte, like, desc, sql, inArray, or } from "drizzle-orm"
import { db } from "../../database/connection"
import * as schema from "../../database/schema/index"

const { properties, propertyImages, platformUsers } = schema

interface MapBounds {
    northEast: { lat: number; lng: number }
    southWest: { lat: number; lng: number }
}

interface MapPropertyFilters {
    bounds?: MapBounds
    minPrice?: number
    maxPrice?: number
    propertyTypes?: string[]
    minArea?: number
    maxArea?: number
    areaUnit?: string
    cities?: string[]
    states?: string[]
    verified?: boolean
    saleBy?: string[]
    beds?: number[]
    baths?: number[]
}

interface MapProperty {
    id: string
    address: string
    price: number
    beds?: number
    baths?: number
    sqft: number
    areaUnit: string
    type: string
    lat: number
    lng: number
    images: string[]
    description?: string
    agent?: string
    daysOnMarket?: number
    status: string
    city: string
    state: string
    khasraNumber?: string
    khewatNumber?: string
    saleBy: string
    verified: boolean
    boundaries?: Array<{ lat: number; lng: number }>
}

export class MapPropertiesService {
    // Get all properties optimized for map rendering
    static async getMapProperties(userId:string) {
        const limit = 1000 // Default limit for map properties
        console.log(`🗺️ Fetching map properties with limit: ${limit}`)

        try {
            // Build the base query with optimized selection
            // or appropriate import if using Drizzle
            const baseSelect:any = {
                id: properties.id,
                title: properties.title,
                description: properties.description,
                propertyType: properties.propertyType,
                listingType: properties.listingAs,
                status: properties.status,
                price: properties.price,
                area: properties.area,
                areaUnit: properties.areaUnit,
                address: properties.address,
                location: properties?.location,
                boundaries: properties.geoJson,
                khasraNumber: properties.khasraNumber,
                khewatNumber: properties.khewatNumber,
                listingAs: properties.listingAs,
                isVerified: properties?.isVerified,
                createdAt: properties.createdAt,
                daysOnMarket: sql<number>`EXTRACT(DAY FROM NOW() - ${properties.createdAt})`,
                slug: schema.propertySeo.slug,
                seo : schema.propertySeo,
                images: sql`
                          COALESCE(json_agg(${propertyImages}.*)
                          FILTER (WHERE ${propertyImages}.id IS NOT NULL), '[]')
                      `.as("images"),
                ownerName: platformUsers.firstName,
                saleBy: platformUsers.role
            }

            if (userId) {
                baseSelect.saved = sql<boolean>`
                  BOOL_OR(
                    CASE 
                      WHEN ${schema.savedProperties}.id IS NOT NULL 
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
            // .leftJoin(schema.propertyVerification, eq(properties.id, schema.propertyVerification.propertyId))
            .innerJoin(schema.propertySeo, eq(properties.id, schema.propertySeo.propertyId))
            .where(eq(properties.approvalStatus, "APPROVED"))
            .groupBy(properties.id, platformUsers.id, schema.propertySeo.id)

            .orderBy(desc(properties.createdAt)) // or `desc(properties.views)` if you have views
            .limit(limit);

            if(userId) {
                query = query.leftJoin(
                    schema.savedProperties,
                    and(
                      eq(properties.id, schema.savedProperties.propertyId),
                      eq(schema.savedProperties.userId, userId)
                    )
                  )
            }
            const results = await query
            return results

            // let query = await db
            //     .select({
            //         id: properties.id,
            //         title: properties.title,
            //         description: properties.description,
            //         propertyType: properties.propertyType,
            //         listingType: properties.listingAs,
            //         status: properties.status,
            //         price: properties.price,
            //         area: properties.area,
            //         areaUnit: properties.areaUnit,
            //         address: properties.address,
            //         city: properties.city,
            //         state: properties.state,
            //         boundaries: properties.geoJson,
            //         khasraNumber: properties.khasraNumber,
            //         khewatNumber: properties.khewatNumber,
            //         listingAs: properties.listingAs,
            //         ownerName: properties.ownerName,
            //         isVerified: schema.propertyVerification.isVerified,
            //         createdAt: properties.createdAt,
            //         daysOnMarket: sql<number>`EXTRACT(DAY FROM NOW() - ${properties.createdAt})`,
            //         url: schema.propertySeo.slug,
            //         // or the correct column
            //     })
            //     .from(properties)
            //     .innerJoin(
            //         schema.propertyVerification,
            //         eq(properties.id, schema.propertyVerification.propertyId)
            //     )
            //     .innerJoin(schema.propertySeo, eq(properties.id, schema.propertySeo.propertyId))
            //     .orderBy(desc(properties.createdAt))
            //     .where(eq(properties.approvalStatus, "APPROVED"))

            // console.log("🔍 Query built for map properties:", query)
            // return query
            // Apply filters
            // const conditions = []

            // // Only show active and approved properties
            // conditions.push(eq(properties.isActive, true))
            // conditions.push(eq(properties.approvalStatus, "approved"))

            // // Geographic bounds filter
            // if (filters.bounds) {
            //     const { northEast, southWest } = filters.bounds
            //     conditions.push(
            //         and(
            //             gte(properties.latitude, southWest.lat),
            //             lte(properties.latitude, northEast.lat),
            //             gte(properties.longitude, southWest.lng),
            //             lte(properties.longitude, northEast.lng),
            //         ),
            //     )
            // }

            // // Price filters
            // if (filters.minPrice) conditions.push(gte(properties.price, filters.minPrice))
            // if (filters.maxPrice) conditions.push(lte(properties.price, filters.maxPrice))

            // // Property type filter
            // if (filters.propertyTypes && filters.propertyTypes.length > 0) {
            //     conditions.push(inArray(properties.propertyType, filters.propertyTypes))
            // }

            // // Area filters
            // if (filters.minArea) conditions.push(gte(properties.area, filters.minArea))
            // if (filters.maxArea) conditions.push(lte(properties.area, filters.maxArea))

            // // Location filters
            // if (filters.cities && filters.cities.length > 0) {
            //     conditions.push(inArray(properties.city, filters.cities))
            // }
            // if (filters.states && filters.states.length > 0) {
            //     conditions.push(inArray(properties.state, filters.states))
            // }

            // // Verification filter
            // if (filters.verified !== undefined) {
            //     conditions.push(eq(properties.isVerified, filters.verified))
            // }

            // // Sale by filter
            // if (filters.saleBy && filters.saleBy.length > 0) {
            //     conditions.push(inArray(properties.listingAs, filters.saleBy))
            // }

            // // Apply all conditions
            // if (conditions.length > 0) {
            //     query = query.where(and(...conditions))
            // }

            // // Order by creation date (newest first) and apply limit
            // const results = await query.orderBy(desc(properties.createdAt)).limit(limit)

            // console.log(`✅ Found ${results.length} properties for map`)

            // // Transform to map format
            // return results.map(this.transformToMapProperty)
        } catch (error) {
            console.error("❌ Error fetching map properties:", error)
            throw new Error(`Failed to fetch map properties: ${error}`)
        }
    }

    // Get properties within specific bounds (optimized for viewport)
    // static async getPropertiesInBounds(
    //     bounds: MapBounds,
    //     filters: MapPropertyFilters = {},
    //     limit = 500,
    // ): Promise<MapProperty[]> {
    //     console.log(`🎯 Fetching properties in bounds with limit: ${limit}`)

    //     const filtersWithBounds = { ...filters, bounds }
    //     return this.getMapProperties(filtersWithBounds, limit)
    // }

    // // Get properties near a specific point
    // static async getPropertiesNearPoint(
    //     lat: number,
    //     lng: number,
    //     radiusKm = 10,
    //     filters: MapPropertyFilters = {},
    //     limit = 100,
    // ): Promise<MapProperty[]> {
    //     console.log(`📍 Fetching properties near point (${lat}, ${lng}) within ${radiusKm}km`)

    //     try {
    //         const query = db
    //             .select({
    //                 id: properties.id,
    //                 uuid: properties.uuid,
    //                 title: properties.title,
    //                 description: properties.description,
    //                 propertyType: properties.propertyType,
    //                 listingType: properties.listingType,
    //                 status: properties.status,
    //                 price: properties.price,
    //                 area: properties.area,
    //                 areaUnit: properties.areaUnit,
    //                 address: properties.address,
    //                 city: properties.city,
    //                 state: properties.state,
    //                 latitude: properties.latitude,
    //                 longitude: properties.longitude,
    //                 images: properties.images,
    //                 boundaries: properties.boundaries,
    //                 khasraNumber: properties.khasraNumber,
    //                 khewatNumber: properties.khewatNumber,
    //                 listingAs: properties.listingAs,
    //                 ownerName: properties.ownerName,
    //                 isVerified: properties.isVerified,
    //                 createdAt: properties.createdAt,
    //                 daysOnMarket: sql<number>`EXTRACT(DAY FROM NOW() - ${properties.createdAt})`,
    //                 // Calculate distance
    //                 distance: sql<number>`
    //         ST_Distance(
    //           ST_SetSRID(ST_MakePoint(${properties.longitude}, ${properties.latitude}), 4326)::geography,
    //           ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
    //         ) / 1000
    //       `,
    //             })
    //             .from(properties)

    //         const conditions = []

    //         // Base conditions
    //         conditions.push(eq(properties.isActive, true))
    //         conditions.push(eq(properties.approvalStatus, "approved"))

    //         // Distance condition
    //         conditions.push(
    //             sql`ST_DWithin(
    //       ST_SetSRID(ST_MakePoint(${properties.longitude}, ${properties.latitude}), 4326)::geography,
    //       ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
    //       ${radiusKm * 1000}
    //     )`,
    //         )

    //         // Apply other filters
    //         if (filters.minPrice) conditions.push(gte(properties.price, filters.minPrice))
    //         if (filters.maxPrice) conditions.push(lte(properties.price, filters.maxPrice))
    //         if (filters.propertyTypes?.length) conditions.push(inArray(properties.propertyType, filters.propertyTypes))
    //         if (filters.verified !== undefined) conditions.push(eq(properties.isVerified, filters.verified))

    //         const results = await query
    //             .where(and(...conditions))
    //             .orderBy(sql`distance ASC`)
    //             .limit(limit)

    //         console.log(`✅ Found ${results.length} properties near point`)
    //         return results.map(this.transformToMapProperty)
    //     } catch (error) {
    //         console.error("❌ Error fetching properties near point:", error)
    //         throw new Error(`Failed to fetch properties near point: ${error}`)
    //     }
    // }

    // // Search properties by location text
    // static async searchPropertiesByLocation(
    //     query: string,
    //     filters: MapPropertyFilters = {},
    //     limit = 50,
    // ): Promise<MapProperty[]> {
    //     console.log(`🔍 Searching properties by location: "${query}"`)

    //     try {
    //         const searchConditions = [
    //             like(properties.address, `%${query}%`),
    //             like(properties.city, `%${query}%`),
    //             like(properties.state, `%${query}%`),
    //             like(properties.title, `%${query}%`),
    //         ]

    //         const dbQuery = db
    //             .select({
    //                 id: properties.id,
    //                 uuid: properties.uuid,
    //                 title: properties.title,
    //                 description: properties.description,
    //                 propertyType: properties.propertyType,
    //                 listingType: properties.listingType,
    //                 status: properties.status,
    //                 price: properties.price,
    //                 area: properties.area,
    //                 areaUnit: properties.areaUnit,
    //                 address: properties.address,
    //                 city: properties.city,
    //                 state: properties.state,
    //                 latitude: properties.latitude,
    //                 longitude: properties.longitude,
    //                 images: properties.images,
    //                 boundaries: properties.boundaries,
    //                 khasraNumber: properties.khasraNumber,
    //                 khewatNumber: properties.khewatNumber,
    //                 listingAs: properties.listingAs,
    //                 ownerName: properties.ownerName,
    //                 isVerified: properties.isVerified,
    //                 createdAt: properties.createdAt,
    //                 daysOnMarket: sql<number>`EXTRACT(DAY FROM NOW() - ${properties.createdAt})`,
    //             })
    //             .from(properties)

    //         const conditions = [
    //             eq(properties.isActive, true),
    //             eq(properties.approvalStatus, "approved"),
    //             or(...searchConditions),
    //         ]

    //         // Apply additional filters
    //         if (filters.minPrice) conditions.push(gte(properties.price, filters.minPrice))
    //         if (filters.maxPrice) conditions.push(lte(properties.price, filters.maxPrice))
    //         if (filters.propertyTypes?.length) conditions.push(inArray(properties.propertyType, filters.propertyTypes))

    //         const results = await dbQuery
    //             .where(and(...conditions))
    //             .orderBy(desc(properties.createdAt))
    //             .limit(limit)

    //         console.log(`✅ Found ${results.length} properties matching location search`)
    //         return results.map(this.transformToMapProperty)
    //     } catch (error) {
    //         console.error("❌ Error searching properties by location:", error)
    //         throw new Error(`Failed to search properties by location: ${error}`)
    //     }
    // }

    // // Get map statistics
    // static async getMapStatistics(bounds?: MapBounds, filters: MapPropertyFilters = {}) {
    //     console.log("📊 Calculating map statistics")

    //     try {
    //         const query = db.select().from(properties)
    //         const conditions = [eq(properties.isActive, true), eq(properties.approvalStatus, "approved")]

    //         // Apply bounds if provided
    //         if (bounds) {
    //             const { northEast, southWest } = bounds
    //             conditions.push(
    //                 and(
    //                     gte(properties.latitude, southWest.lat),
    //                     lte(properties.latitude, northEast.lat),
    //                     gte(properties.longitude, southWest.lng),
    //                     lte(properties.longitude, northEast.lng),
    //                 ),
    //             )
    //         }

    //         // Apply filters
    //         if (filters.minPrice) conditions.push(gte(properties.price, filters.minPrice))
    //         if (filters.maxPrice) conditions.push(lte(properties.price, filters.maxPrice))
    //         if (filters.propertyTypes?.length) conditions.push(inArray(properties.propertyType, filters.propertyTypes))

    //         const results = await query.where(and(...conditions))

    //         // Calculate statistics
    //         const totalProperties = results.length
    //         const prices = results.map((p) => p.price).filter((p) => p > 0)
    //         const averagePrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0
    //         const minPrice = prices.length > 0 ? Math.min(...prices) : 0
    //         const maxPrice = prices.length > 0 ? Math.max(...prices) : 0

    //         // Property type distribution
    //         const typeDistribution = results.reduce(
    //             (acc, prop) => {
    //                 acc[prop.propertyType] = (acc[prop.propertyType] || 0) + 1
    //                 return acc
    //             },
    //             {} as Record<string, number>,
    //         )

    //         // City distribution
    //         const cityDistribution = results.reduce(
    //             (acc, prop) => {
    //                 acc[prop.city] = (acc[prop.city] || 0) + 1
    //                 return acc
    //             },
    //             {} as Record<string, number>,
    //         )

    //         console.log(`✅ Calculated statistics for ${totalProperties} properties`)

    //         return {
    //             totalProperties,
    //             averagePrice,
    //             priceRange: { min: minPrice, max: maxPrice },
    //             propertyTypeDistribution: Object.entries(typeDistribution).map(([type, count]) => ({
    //                 type: type.toUpperCase(),
    //                 count,
    //             })),
    //             cityDistribution: Object.entries(cityDistribution).map(([city, count]) => ({
    //                 city,
    //                 count,
    //             })),
    //         }
    //     } catch (error) {
    //         console.error("❌ Error calculating map statistics:", error)
    //         throw new Error(`Failed to calculate map statistics: ${error}`)
    //     }
    // }

    // // Transform database result to map property format
    // private static transformToMapProperty(dbProperty: any): MapProperty {
    //     // Parse images from JSON or use placeholder
    //     let images: string[] = []
    //     if (dbProperty.images) {
    //         try {
    //             const parsedImages = typeof dbProperty.images === "string" ? JSON.parse(dbProperty.images) : dbProperty.images

    //             if (Array.isArray(parsedImages)) {
    //                 images = parsedImages
    //                     .map((img: any) => (typeof img === "string" ? img : img.url || img.imageUrl))
    //                     .filter(Boolean)
    //             }
    //         } catch (e) {
    //             console.warn("Failed to parse images for property:", dbProperty.id)
    //         }
    //     }

    //     // Use placeholder images if none available
    //     if (images.length === 0) {
    //         images = [
    //             `/placeholder.svg?height=300&width=400&text=Property ${dbProperty.id}`,
    //             `/placeholder.svg?height=300&width=400&text=Interior ${dbProperty.id}`,
    //             `/placeholder.svg?height=300&width=400&text=Exterior ${dbProperty.id}`,
    //         ]
    //     }

    //     // Parse boundaries
    //     let boundaries: Array<{ lat: number; lng: number }> = []
    //     if (dbProperty.boundaries) {
    //         try {
    //             const parsedBoundaries =
    //                 typeof dbProperty.boundaries === "string" ? JSON.parse(dbProperty.boundaries) : dbProperty.boundaries

    //             if (Array.isArray(parsedBoundaries)) {
    //                 boundaries = parsedBoundaries
    //                     .map((coord: any) => ({
    //                         lat: Number.parseFloat(coord.lat || coord.latitude || 0),
    //                         lng: Number.parseFloat(coord.lng || coord.longitude || 0),
    //                     }))
    //                     .filter((coord) => coord.lat !== 0 && coord.lng !== 0)
    //             }
    //         } catch (e) {
    //             console.warn("Failed to parse boundaries for property:", dbProperty.id)
    //         }
    //     }

    //     // Generate agent name
    //     const agentName = dbProperty.ownerName
    //         ? `${dbProperty.ownerName} - ${dbProperty.listingAs?.replace(/_/g, " ")}`
    //         : "Property Owner"

    //     // Map listing type to sale by
    //     const saleByMapping: Record<string, string> = {
    //         property_owner: "OWNER",
    //         real_estate_agent: "AGENT",
    //         property_dealer: "DEALER",
    //         builder: "BUILDER",
    //     }

    //     return {
    //         id: `prop-${dbProperty.id}`,
    //         address: dbProperty.address || `${dbProperty.city}, ${dbProperty.state}`,
    //         price: Number.parseFloat(dbProperty.price) || 0,
    //         beds: null, // Not in current schema, can be added later
    //         baths: null, // Not in current schema, can be added later
    //         sqft: Number.parseFloat(dbProperty.area) || 0,
    //         areaUnit: dbProperty.areaUnit?.toUpperCase() || "SQFT",
    //         type: dbProperty.propertyType?.toUpperCase() || "OTHER",
    //         lat: Number.parseFloat(dbProperty.latitude) || 0,
    //         lng: Number.parseFloat(dbProperty.longitude) || 0,
    //         images,
    //         description: dbProperty.description || `${dbProperty.propertyType} property in ${dbProperty.city}`,
    //         agent: agentName,
    //         daysOnMarket: Number.parseInt(dbProperty.daysOnMarket) || 0,
    //         status: dbProperty.status?.replace(/_/g, " ") || "Available",
    //         city: dbProperty.city || "",
    //         state: dbProperty.state || "",
    //         khasraNumber: dbProperty.khasraNumber || null,
    //         khewatNumber: dbProperty.khewatNumber || null,
    //         saleBy: saleByMapping[dbProperty.listingAs] || "OWNER",
    //         verified: Boolean(dbProperty.isVerified),
    //         boundaries: boundaries.length > 0 ? boundaries : undefined,
    //     }
    // }

    // // Get clustered properties for performance at low zoom levels
    // static async getClusteredMapProperties(filters: MapPropertyFilters = {}, zoom: number, bounds: MapBounds) {
    //     console.log(`🎯 Getting clustered properties for zoom level: ${zoom}`)

    //     // For high zoom levels, return individual properties
    //     if (zoom >= 15) {
    //         const properties = await this.getPropertiesInBounds(bounds, filters, 200)
    //         return [
    //             {
    //                 lat: (bounds.northEast.lat + bounds.southWest.lat) / 2,
    //                 lng: (bounds.northEast.lng + bounds.southWest.lng) / 2,
    //                 count: properties.length,
    //                 avgPrice: properties.reduce((sum, p) => sum + p.price, 0) / properties.length || 0,
    //                 bounds,
    //                 properties,
    //             },
    //         ]
    //     }

    //     // For lower zoom levels, implement clustering logic
    //     // This is a simplified version - in production, you'd use proper clustering algorithms
    //     const allProperties = await this.getPropertiesInBounds(bounds, filters, 1000)

    //     return [
    //         {
    //             lat: (bounds.northEast.lat + bounds.southWest.lat) / 2,
    //             lng: (bounds.northEast.lng + bounds.southWest.lng) / 2,
    //             count: allProperties.length,
    //             avgPrice: allProperties.reduce((sum, p) => sum + p.price, 0) / allProperties.length || 0,
    //             bounds,
    //             properties: allProperties.slice(0, 50), // Limit for performance
    //         },
    //     ]
    // }
}
