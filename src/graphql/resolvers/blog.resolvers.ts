import { GraphQLError } from "graphql"
import { BlogService } from "../services/blog.service"

interface AdminContext {
  admin?: {
    adminId: string
    email: string
    roles: string[]
  }
}

export const blogResolvers = {
  Query: {
    getBlog: async (_: any, { id }: { id: string }) => {
      try {
        const blog = await BlogService.getBlogById(id)
        if (!blog) {
          throw new GraphQLError("Blog not found", {
            extensions: { code: "NOT_FOUND" },
          })
        }
        return {
          ...blog,
          id: blog.id.toString(),
          authorId: blog.authorId.toString(),
          publishedAt: blog.publishedAt?.toISOString(),
          createdAt: blog.createdAt.toISOString(),
          updatedAt: blog.updatedAt.toISOString(),
        }
      } catch (error) {
        throw new GraphQLError(`Failed to get blog: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        })
      }
    },
    getAllBlogs: async () => {
      try {
        const blogs = await BlogService.getAllBlogs()
        return blogs.map(blog => ({
          ...blog,
          id: blog.id.toString(),
          authorId: blog.authorId.toString(),
          publishedAt: blog.publishedAt?.toISOString(),
          createdAt: blog.createdAt.toISOString(),
          updatedAt: blog.updatedAt.toISOString(),
        }))
      } catch (error) {
        throw new GraphQLError(`Failed to get blogs: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        })
      }
    },
  },
  Mutation: {
    createBlog: async (_: any, { input }: any, context: AdminContext) => {
      if (!context.admin) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        })
      }
      try {
        const blog = await BlogService.createBlog(input)
        return {
          ...blog,
          id: blog.id.toString(),
          authorId: blog.authorId.toString(),
          publishedAt: blog.publishedAt?.toISOString(),
          createdAt: blog.createdAt.toISOString(),
          updatedAt: blog.updatedAt.toISOString(),
        }
      } catch (error) {
        throw new GraphQLError(`Failed to create blog: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        })
      }
    },
    updateBlog: async (_: any, { id, input }: any, context: AdminContext) => {
      if (!context.admin) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        })
      }
      try {
        const blog = await BlogService.updateBlog(id, input)
        if (!blog) {
          throw new GraphQLError("Blog not found for update", {
            extensions: { code: "NOT_FOUND" },
          })
        }
        return {
          ...blog,
          id: blog.id.toString(),
          authorId: blog.authorId.toString(),
          publishedAt: blog.publishedAt?.toISOString(),
          createdAt: blog.createdAt.toISOString(),
          updatedAt: blog.updatedAt.toISOString(),
        }
      } catch (error) {
        throw new GraphQLError(`Failed to update blog: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        })
      }
    },
    deleteBlog: async (_: any, { id }: { id: string }, context: AdminContext) => {
      if (!context.admin) {
        throw new GraphQLError("Authentication required", {
          extensions: { code: "UNAUTHENTICATED" },
        })
      }
      try {
        const success = await BlogService.deleteBlog(id)
        return success
      } catch (error) {
        throw new GraphQLError(`Failed to delete blog: ${(error as Error).message}`, {
          extensions: { code: "INTERNAL_ERROR" },
        })
      }
    },
  },
} 