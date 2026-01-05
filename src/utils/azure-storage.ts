import { BlobServiceClient, type ContainerClient, type BlockBlobClient } from "@azure/storage-blob"
import sharp from "sharp"
import { v4 as uuidv4 } from "uuid"
// Removed watermarking; no additional imports needed
export interface FileUpload {
  filename: string
  mimetype: string
  encoding: string
  createReadStream: () => NodeJS.ReadableStream
}


export interface File {
  filename: string
  mimetype: string
  encoding: string
  createReadStream: () => NodeJS.ReadableStream
}

interface UploadResult {
  filename: string
  originalName: string
  mimetype: string
  encoding: string
  url: string
  size: number
  width?: number
  height?: number
  variant: string
}

interface ImageVariant {
  name: string
  width: number
  height: number
  quality: number
}

interface BulkUploadResult {
  success: boolean
  results: UploadResult[]
  errors: string[]
  totalUploaded: number
  totalFailed: number
}

export class AzureStorageService {
  private blobServiceClient: BlobServiceClient
  private containerClient: ContainerClient
  private containerName: string
  private baseUrl: string

  // Image variants for property images
  private static readonly IMAGE_VARIANTS: ImageVariant[] = [
    { name: "thumbnail", width: 300, height: 200, quality: 80 },
    { name: "medium", width: 800, height: 600, quality: 85 },
    { name: "large", width: 1200, height: 900, quality: 90 },
    { name: "original", width: 1920, height: 1440, quality: 95 },
  ]

  constructor() {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING
    const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || "property-images"

    if (!connectionString) {
      throw new Error("AZURE_STORAGE_CONNECTION_STRING environment variable is required")
    }

    this.containerName = containerName
    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString)
    this.containerClient = this.blobServiceClient.getContainerClient(containerName)
    this.baseUrl = process.env.AZURE_STORAGE_BASE_URL || `https://${this.getStorageAccountName()}.blob.core.windows.net`

    // Initialize container
    this.initializeContainer()
  }

  private getStorageAccountName(): string {
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING || ""
    const match = connectionString.match(/AccountName=([^;]+)/)
    return match ? match[1] : "unknown"
  }

  private async initializeContainer(): Promise<void> {
    try {
      await this.containerClient.createIfNotExists({
        access: "blob", // Public read access for blobs
      })
      console.log(`✅ Azure Storage container '${this.containerName}' initialized`)
    } catch (error) {
      console.error("❌ Failed to initialize Azure Storage container:", error)
    }
  }

  private sanitizeMetadataValue(value: string): string {
    return value
      .replace(/[^\x20-\x7E]/g, "")     // remove non-ASCII
      .replace(/[^\w\-_.]/g, "_")       // replace special chars
      .substring(0, 128);               // Azure metadata limit
  }

  // Validate image file
  private validateImageFile(file: File): { valid: boolean; error?: string } {
    // Check file type

    // if (!file.mimetype.startsWith("image/")) {
    //   return { valid: false, error: "Only image files are allowed" }
    // }

    // // Check supported formats
    // const supportedFormats = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
    // if (!supportedFormats.includes(file.mimetype.toLowerCase())) {
    //   return { valid: false, error: "Unsupported image format. Supported: JPEG, PNG, WebP" }
    // }

    return { valid: true }
  }

  // Upload single file with multiple variants
  // Upload single file with multiple WebP variants
  async uploadFile(file: File, folder = "properties", bypassCompression = false): Promise<UploadResult[]> {
    const { filename, mimetype, encoding, createReadStream } = file;

    const validation = this.validateImageFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const stream = createReadStream();
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }

    const buffer = Buffer.concat(chunks);
    const originalSize = buffer.length;
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (originalSize > maxSize) {
      throw new Error("File size exceeds 10MB limit");
    }

    const results: UploadResult[] = [];

    const timestamp = Date.now();
    const uuid = uuidv4().substring(0, 8);
    const extension = "webp";
    const baseName = filename
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9-_]/g, "-"); // Slugify base name
    const baseFilename = `${baseName}-${timestamp}-${uuid}`;

    for (const variant of AzureStorageService.IMAGE_VARIANTS) {
      try {
        let processedBuffer: Buffer;
        let width: number;
        let height: number;
        let extension = "webp";
    
        if (bypassCompression) {
          // 🚀 Directly use the original buffer (no sharp)
          processedBuffer = buffer;
          extension = filename.split(".").pop() || "bin"; // keep original extension
          const image = sharp(buffer);
          const metadata = await image.metadata();
          width = metadata.width || 0;
          height = metadata.height || 0;
        } else {
          // 🔧 Use sharp compression as before
          const processed = await sharp(buffer)
            .resize(variant.width, variant.height, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: variant.quality })
            .toBuffer({ resolveWithObject: true });
    
          processedBuffer = processed.data;
          width = processed.info.width;
          height = processed.info.height;
        }
    
        const variantFilename = `${baseFilename}-${variant.name}.${extension}`;
        const blobPath = `${folder}/${variantFilename}`;
    
        const blockBlobClient: BlockBlobClient =
          this.containerClient.getBlockBlobClient(blobPath);
    
        await blockBlobClient.uploadData(processedBuffer, {
          blobHTTPHeaders: {
            blobContentType: bypassCompression
              ? mimetype // keep original mimetype
              : "image/webp",
            blobCacheControl: "public, max-age=31536000",
          },
          metadata: {
            originalname: this.sanitizeMetadataValue(filename),
            variant: this.sanitizeMetadataValue(variant.name),
            uploadedat: new Date().toISOString().replace(/[^0-9T:.Z]/g, "_"),
            width: width.toString(),
            height: height.toString(),
          },
        });
    
        const url = `${this.baseUrl}/${this.containerName}/${blobPath}`;
    
        results.push({
          filename: baseFilename,
          originalName: filename,
          mimetype: bypassCompression ? mimetype : "image/webp",
          encoding,
          url,
          size: processedBuffer.length,
          width,
          height,
          variant: variant.name,
        });
    

        console.log(`✅ Uploaded ${variant.name} variant: ${variantFilename}`);
      } catch (error) {
        console.error(`❌ Failed to upload ${variant.name} variant:`, error);
        throw new Error(`Failed to upload ${variant.name} variant: ${error}`);
      }
    }

    return results;
  }




  // Bulk upload multiple files with progress tracking
  // Bulk upload multiple files with progress tracking
  async uploadBulkFiles(files: FileUpload[], folder = "properties"): Promise<BulkUploadResult> {
    const results: UploadResult[] = []
    const errors: string[] = []
    let totalUploaded = 0
    let totalFailed = 0

    // console.log(files, "files")
    console.log(`🚀 Starting bulk upload of ${files.length} files...`)

    // 🧹 Filter out invalid entries
    // files = files.filter((f) => {
    //   console.log(f)
    //   const isValid = f && f.file && typeof f.file.filename === "string"
    //   if (!isValid) {
    //     console.warn("⚠️ Skipping invalid file entry:", f)
    //   }
    //   return isValid
    // })

    if (files.length === 0) {
      return {
        success: false,
        results: [],
        errors: ["No valid files provided for upload."],
        totalUploaded: 0,
        totalFailed: 0,
      }
    }

    // Process files in chunks
    const concurrencyLimit = 3
    const chunks = []

    for (let i = 0; i < files.length; i += concurrencyLimit) {
      chunks.push(files.slice(i, i + concurrencyLimit))
    }

    for (const chunk of chunks) {
      console.log(chunk)
      const promises = chunk.map(async (file, index) => {
        const filename = file?.filename || "unknown"
        try {
          console.log(`📤 Uploading file: ${filename}`)
          const fileResults = await this.uploadFile(file, folder)
          results.push(...fileResults)
          totalUploaded++
          console.log(`✅ Successfully uploaded: ${filename}`)
          return { success: true, filename }
        } catch (error) {
          const errorMessage = `Failed to upload ${filename}: ${error instanceof Error ? error.message : String(error)}`
          errors.push(errorMessage)
          totalFailed++
          console.error(`❌ ${errorMessage}`)
          return { success: false, filename, error: errorMessage }
        }
      })

      await Promise.all(promises)
    }

    const bulkResult: BulkUploadResult = {
      success: totalFailed === 0,
      results,
      errors,
      totalUploaded,
      totalFailed,
    }

    console.log(`🎉 Bulk upload completed: ${totalUploaded} successful, ${totalFailed} failed`)
    return bulkResult
  }


  // Upload multiple files (legacy method for backward compatibility)
  async uploadMultipleFiles(files: FileUpload[], folder = "properties"): Promise<UploadResult[][]> {
    const bulkResult = await this.uploadBulkFiles(files, folder)

    if (!bulkResult.success) {
      throw new Error(`Bulk upload failed: ${bulkResult.errors.join(", ")}`)
    }

    // Group results by original file
    const groupedResults: UploadResult[][] = []
    const fileNames = [...new Set(files.map((f) => f.filename))]

    console.log(`📂 Grouping results by original file names: ${fileNames.join(", ")}`)
    for (const fileName of fileNames) {
      const fileResults = bulkResult.results.filter((r) => r.originalName === fileName)
      groupedResults.push(fileResults)
    }

    return groupedResults
  }

  // Delete file and all its variants
  async deleteFile(filename: string, folder = "properties"): Promise<boolean> {
    try {
      // Extract base filename without variant suffix
      const baseFilename = filename.replace(/-(?:thumbnail|medium|large|original)\./, ".")

      // Delete all variants
      for (const variant of AzureStorageService.IMAGE_VARIANTS) {
        const variantFilename = baseFilename.replace(/\.([^.]+)$/, `-${variant.name}.$1`)
        const blobPath = `${folder}/${variantFilename}`

        console.log('>>>>>>>blobPath>>>>>',blobPath)

        try {
          const blockBlobClient = this.containerClient.getBlockBlobClient(blobPath)
          await blockBlobClient.deleteIfExists()
          console.log(`🗑️ Deleted variant: ${variantFilename}`)
        } catch (error) {
          console.warn(`⚠️ Could not delete variant ${variantFilename}:`, error)
        }
      }

      return true
    } catch (error) {
      console.error("❌ Failed to delete file:", error)
      return false
    }
  }

  // Bulk delete multiple files
  async deleteBulkFiles(
    filenames: string[],
    folder = "properties",
  ): Promise<{ success: boolean; deleted: number; failed: number }> {
    let deleted = 0
    let failed = 0

    for (const filename of filenames) {
      try {
        const result = await this.deleteFile(filename, folder)
        if (result) {
          deleted++
        } else {
          failed++
        }
      } catch (error) {
        console.error(`Failed to delete ${filename}:`, error)
        failed++
      }
    }

    return { success: failed === 0, deleted, failed }
  }

  // Get file URL
  getFileUrl(filename: string, folder = "properties"): string {
    return `${this.baseUrl}/${this.containerName}/${folder}/${filename}.webp`
  }

  // Get specific variant URL
  getVariantUrl(filename: string, variant: string, folder = "properties"): string {
    const variantFilename = `${filename}-${variant}`

    return this.getFileUrl(variantFilename, folder)
  }

  // Get all variant URLs for a file
  getAllVariantUrls(filename: string, folder = "properties"): Record<string, string> {
    const urls: Record<string, string> = {}

    for (const variant of AzureStorageService.IMAGE_VARIANTS) {

      urls[variant.name] = this.getVariantUrl(filename, variant.name, folder)
    }



    return urls
  }

  // List files in a folder
  async listFiles(folder = "properties", maxResults = 100): Promise<string[]> {
    const files: string[] = []

    try {
      const prefix = `${folder}/`
      const iterator = this.containerClient.listBlobsFlat({ prefix }).byPage({ maxPageSize: maxResults })

      for await (const page of iterator) {
        for (const blob of page.segment.blobItems) {
          files.push(blob.name.replace(prefix, ""))
        }
      }
    } catch (error) {
      console.error("❌ Failed to list files:", error)
    }

    return files
  }

  // Get file metadata
  async getFileMetadata(filename: string, folder = "properties"): Promise<any> {
    try {
      const blobPath = `${folder}/${filename}`
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobPath)
      const properties = await blockBlobClient.getProperties()

      return {
        filename,
        size: properties.contentLength,
        contentType: properties.contentType,
        lastModified: properties.lastModified,
        metadata: properties.metadata,
      }
    } catch (error) {
      console.error("❌ Failed to get file metadata:", error)
      return null
    }
  }

  // Generate signed URL for temporary access (if needed)
  async generateSasUrl(filename: string, folder = "properties", expiryHours = 24): Promise<string> {
    try {
      const blobPath = `${folder}/${filename}`
      const blockBlobClient = this.containerClient.getBlockBlobClient(blobPath)

      // For public containers, just return the regular URL
      // For private containers, you would generate a SAS token here
      return blockBlobClient.url
    } catch (error) {
      console.error("❌ Failed to generate SAS URL:", error)
      throw error
    }
  }
}

// Export singleton instance
export const azureStorage = new AzureStorageService()
