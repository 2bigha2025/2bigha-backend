import { pgEnum, pgTable, serial, text, timestamp, jsonb, uuid } from "drizzle-orm/pg-core"
import { adminUsers } from "./admin-user"

// Blog enums
export const blogStatusEnum = pgEnum("blog_status", ["DRAFT", "PUBLISHED", "ARCHIVED"])

// Blog posts table
export const blogPosts = pgTable("blog_posts", {
  id: uuid("id").defaultRandom().primaryKey(),
  uuid: text("uuid").notNull().default("uuid_generate_v4()"),
  authorId: uuid("author_id")
    .notNull()
    .references(() => adminUsers.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  featuredImage: text("featured_image"),
  status: blogStatusEnum("status").notNull().default("DRAFT"),
  tags: jsonb("tags"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  publishedAt: timestamp("published_at"),
  category : text('category'),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Blog categories table
export const blogCategories = pgTable("blog_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  color: text("color"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// Blog post categories junction table
export const blogPostCategories = pgTable("blog_post_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  postId: uuid("post_id")
    .notNull()
    .references(() => blogPosts.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => blogCategories.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
})

// Blog relations
export const blogRelations = {
  blogPosts: {
    author: {
      relation: "one",
      table: adminUsers,
      fields: [blogPosts.authorId],
      references: [adminUsers.id],
    },
    categories: {
      relation: "many",
      table: blogPostCategories,
      fields: [blogPosts.id],
      references: [blogPostCategories.postId],
    },
  },
  blogCategories: {
    posts: {
      relation: "many",
      table: blogPostCategories,
      fields: [blogCategories.id],
      references: [blogPostCategories.categoryId],
    },
  },
  blogPostCategories: {
    post: {
      relation: "one",
      table: blogPosts,
      fields: [blogPostCategories.postId],
      references: [blogPosts.id],
    },
    category: {
      relation: "one",
      table: blogCategories,
      fields: [blogPostCategories.categoryId],
      references: [blogCategories.id],
    },
  },
}
