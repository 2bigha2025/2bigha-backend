import { add } from "winston";
import { z } from "zod"

// Common validation schemas
export const emailSchema = z
  .string()
  .trim()
  .transform((val) => (val === "" ? undefined : val))
  .optional()
  .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: "Invalid email address",
  });

export const passwordSchema = z
  .string()
  .trim()
  .transform((val) => (val === "" ? undefined : val))
  .optional()
  .refine((val) => !val || val.length >= 8, {
    message: "Password must be at least 8 characters",
  });
export const phoneSchema = z.string().regex(/^\+?[\d\s-()]+$/, "Invalid phone number")
export const urlSchema = z.string().url("Invalid URL")

// Property validation schemas
export const propertyTypeSchema = z.enum([
  "agricultural",
  "commercial",
  "residential",
  "industrial",
  "villa",
  "apartment",
  "plot",
  "farmhouse",
  "warehouse",
  "office",
  "other",
])

export const listingTypeSchema = z.enum(["sale", "rent", "lease"])

export const coordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

// User validation schemas
export const createUserSchema = z.object({
  email: emailSchema,
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  password: passwordSchema,
  role: z.enum(["OWNER", "AGENT", "USER"]).optional(),
})

// export const updateUserSchema = createUserSchema.partial()

// Property validation schemas
export const createPropertySchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  propertyType: propertyTypeSchema,
  listingType: listingTypeSchema,
  price: z.number().positive("Price must be positive"),
  area: z.number().positive("Area must be positive"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  coordinates: coordinatesSchema.optional(),
})

export const updatePropertySchema = createPropertySchema.partial()

// Blog validation schemas
export const createBlogPostSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  excerpt: z.string().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  tags: z.array(z.string()).optional(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
})

export const updateBlogPostSchema = createBlogPostSchema.partial()

// Validation helper functions
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map((e) => e.message).join(", ")}`)
    }
    throw error
  }
}

export function validatePartialInput<T>(schema: z.ZodSchema<T>, data: unknown): Partial<T> {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.errors.map((e) => e.message).join(", ")}`)
    }
    throw error
  }
}




// Basic Information validation schema
export const updateUserSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().optional(),
  role: z.enum(["OWNER", "AGENT", "USER"]).optional(),
  email: emailSchema.optional(),
  phone: phoneSchema,
  address: z.string().optional(),
  // avatar: z.instanceof(File).optional(),
})

// Address Information validation schema



// Combined schema for backward compatibility
export const updatePlatformUserProfileSchema = z.object({
  firstName: z.string().min(1, "First name is required").optional(),
  lastName: z.string().min(1, "Last name is required").optional(),
  email: emailSchema.optional(),
  phone: phoneSchema.optional(),
  bio: z.string().max(500, "Bio cannot exceed 500 characters").optional(),
  avatar: urlSchema.optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pincode: z.string().optional(),
  website: urlSchema.optional(),
  socialLinks: z.record(z.string(), urlSchema).optional(),
  preferences: z.record(z.string(), z.any()).optional(),
  specializations: z.array(z.string()).optional(),
  serviceAreas: z.array(z.string()).optional(),
  languages: z.array(z.string()).optional(),
  experience: z.number().int().min(0).optional(),
  location: z.string().optional(),
})
