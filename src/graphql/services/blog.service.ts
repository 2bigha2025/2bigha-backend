import { and, desc, eq, getTableColumns, ne, sql } from "drizzle-orm";
import { db } from "../../database/connection";
import { blogPosts, blogStatusEnum, blogPostCategories } from "../../database/schema/blog";
import { AzureStorageService } from "../../utils/azure-storage";
import { adminUsers } from "../../database/schema/admin-user";
export class BlogService {
  static async generateSlug(title: string): Promise<string> {
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();

    let candidate = base || "post";
    let counter = 1;

    while (true) {
      const existing = await db
        .select({ id: blogPosts.id })
        .from(blogPosts)
        .where(eq(blogPosts.slug, candidate))
        .limit(1);
      if (existing.length === 0) return candidate;
      candidate = `${base}-${counter++}`;
    }
  }

  static async ensureUniqueSlug(desiredSlug: string, excludeId?: string): Promise<string> {
    const base = desiredSlug
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();

    let candidate = base || "post";
    let counter = 1;

    // Loop until unique, excluding current record when updating
    while (true) {
      const where = excludeId
        ? and(eq(blogPosts.slug, candidate), ne(blogPosts.id, excludeId))
        : eq(blogPosts.slug, candidate);
      const existing = await db
        .select({ id: blogPosts.id })
        .from(blogPosts)
        .where(where)
        .limit(1);
      if (existing.length === 0) return candidate;
      candidate = `${base}-${counter++}`;
    }
  }

  static async createBlog(input: any, authorId:string) {
    const azureStorage = new AzureStorageService()
    let featuredImageUrl: string | null = null
    if (input.featuredImage?.file) {
      const uploadedFile = await azureStorage.uploadFile(input.featuredImage.file, "blogs")
      featuredImageUrl = uploadedFile?.[3]?.url ?? null
    }

    // Ensure slug exists and is unique
    const slug = input.slug
      ? await this.ensureUniqueSlug(input.slug)
      : await this.generateSlug(input.title)

    const newBlog = await db
      .insert(blogPosts)
      .values({
        authorId,
        title: input.title,
        slug,
        excerpt: input.excerpt,
        content: input.content,
        category : input.category,
        featuredImage: featuredImageUrl,
        status: input.status || "DRAFT",
        tags: input.tags || [],
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
      })
      .returning();

    const created = newBlog[0];

    // If categories provided, attach them via junction table
    if (created && Array.isArray(input.categoryIds) && input.categoryIds.length > 0) {
      const categoryIds: string[] = Array.from(new Set<string>(input.categoryIds as string[])).filter(Boolean);
      if (categoryIds.length > 0) {
        await db.insert(blogPostCategories).values(
          categoryIds.map((categoryId) => ({ postId: created.id, categoryId }))
        );
      }
    }

    return created;
  }

  static async updateBlog(id: string, input: any, authorId:string) {
    let imageUrl = input.image
    if(input.featuredImage){
      const azureStorage = new AzureStorageService()
      const uploadedImage = await azureStorage.uploadFile(input.featuredImage.file, "blogs",true)
      imageUrl = uploadedImage[3].url
    }

    // Handle slug update ensuring uniqueness
    let slugToSave: string | undefined = undefined
    if (typeof input.slug === "string" && input.slug.trim().length > 0) {
      slugToSave = await this.ensureUniqueSlug(input.slug, id)
    }
    console.log('>>>>>>slugToSave>>>>>>',slugToSave)
    console.log('>>>>>>>>>input>>>>>>>>',input)

    const updatedBlog = await db
      .update(blogPosts)
      .set({
        title: input.title,
        // slug: slugToSave,
        excerpt: input.excerpt,
        content: input.content,
        featuredImage: imageUrl,
        status: input.status,
        tags: input.tags,
        category : input.category,
        seoTitle: input.seoTitle,
        seoDescription: input.seoDescription,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
        updatedAt: new Date(),
      })
      .where(eq(blogPosts.id, id))
      .returning();
    const updated = updatedBlog[0];

    // If categories provided, reset and add new junctions
    if (updated && Array.isArray(input.categoryIds)) {
      // Delete existing mappings
      await db.delete(blogPostCategories).where(eq(blogPostCategories.postId, id));
      const categoryIds: string[] = Array.from(new Set<string>(input.categoryIds as string[])).filter(Boolean);
      if (categoryIds.length > 0) {
        await db.insert(blogPostCategories).values(
          categoryIds.map((categoryId) => ({ postId: id, categoryId }))
        );
      }
    }

    return updated;
  }

  static async deleteBlog(id: string) {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
    return true;
  }

  static async getBlogById(id: string) {
    const blog = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return blog[0];
  }

  static async getBlogBySlug(slug: string) {
    const blog = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return blog[0];
  }


static async getAllBlogs(status?: string,page:number=1,limit?:number) {
    const offset = (page - 1) * (limit || 20);
    let query = db
    .select({
      ...getTableColumns(blogPosts),
      authorName: sql`${adminUsers.firstName} || ' ' || ${adminUsers.lastName}`.as("authorName"),
    })
    .from(blogPosts)
    .leftJoin(adminUsers, eq(blogPosts.authorId, adminUsers.id))
    .where(status ? eq(blogPosts.status, status as any) : sql`1=1`)
    .orderBy(desc(blogPosts.createdAt))
    .$dynamic();
  
    if (limit !== undefined) {
      query = query.limit(limit as number);
    }
    
    if (offset !== undefined) {
      query = query.offset(offset);
    }
    const totalCountQuery = db.select({
      count: sql`COUNT(*)`.as("count"),
    }).from(blogPosts).where(status ? eq(blogPosts.status, status as any) : sql`1=1`);
    const [blogs, totalCountResult] = await Promise.all([query, totalCountQuery]);
    const totalCount = parseInt(totalCountResult[0].count as string, 10);
    console.log('>>>>>>>blogs>>>>>>',blogs)
    return {
      data: blogs,
      meta: { 
      totalCount,
      currentPage: page,
      totalPages: limit ? Math.ceil(totalCount / limit) : 1,
      }
    };
  }
}
