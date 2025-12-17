
import { eq } from "drizzle-orm";
import { db } from "../../database/connection";
import { propertySeo } from "../../database/schema/index";

export class SeoGenerator {
    static generateSlug(text: string): string {
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .trim();
    }

    static async generateUniqueSlug(baseText: string,propertyId : number): Promise<string> {
        const baseSlug = this.generateSlug(baseText);
        return `${baseSlug}-${propertyId}`;
    }

    private static async slugExists(slug: string): Promise<boolean> {
        const existing = await db
            .select({ slug: propertySeo.slug })
            .from(propertySeo)
            .where(eq(propertySeo.slug, slug));

        return existing.length > 0;
    }

    static async generateSEOFields(
        listingId : number,
        propertyType: string,
        city?: string,
        district?: string,
    ) {
        const title = `${propertyType[0].toUpperCase() + propertyType.slice(1).toLowerCase()} Land ${city ? `in ${city[0].toUpperCase() + city.slice(1).toLowerCase()}` : ""}${district ? `, ${district[0].toUpperCase() + district.slice(1).toLowerCase()}` : ""}`.trim();
        const slug = await this.generateUniqueSlug(title,listingId);

        return {
            title,
            slug,
            seoTitle: `Buy ${title} | 2Bigha`,
            seoDescription : `Explore ${title} for sale. Great for cultivation, investment & future growth. Contact 2Bigha today.`,
            seoKeywords: [
                propertyType?.toLowerCase(),
                city?.toLowerCase(),
                district?.toLowerCase(),
                "property for sale",
                "2bigha",
            ]
                .filter(Boolean)
                .join(", "),
        };

    }
    
    static async generateFarmsSEOFields(
        listingId : number,
        propertyName: string,
        propertyType: string,
        city?: string,
        district?: string,
    ) {
        const farmName=propertyName.replace(/\s*farms?\s*/i, '').trim();
        const title = `${farmName[0].toUpperCase() + farmName.slice(1).toLowerCase()} ${propertyType[0].toUpperCase() + propertyType.slice(1).toLowerCase()} ${city ? `in ${city[0].toUpperCase() + city.slice(1).toLowerCase()}` : ""}${district ? `, ${district[0].toUpperCase() + district.slice(1).toLowerCase()}` : ""}`.trim();
        const slug = await this.generateUniqueSlug(title,listingId);

        return {
            title,
            slug,
            seoTitle: `Buy ${title} | 2Bigha`,
            seoDescription : `Explore ${title} online in India with 2Bigha. Explore listings, connect with buyers, and invest with confidence.`,
            seoKeywords: [
                propertyName?.toLowerCase(),
                city?.toLowerCase(),
                district?.toLowerCase(),
                "FARMHOUSE",
                "FARMLAND",
                "FARMS",
,                "2bigha",
            ]
                .filter(Boolean)
                .join(", "),
        };
    }
}
