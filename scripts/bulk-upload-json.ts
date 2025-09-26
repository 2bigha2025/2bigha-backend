import { GeoJsonService } from '../src/graphql/services/geo-json.service';
import * as fs from 'fs';
import * as path from 'path';

interface FeatureInput {
    collectionId: string;
    type: string;
    properties: any;
    geometry: any;
    bounds?: any;
}

interface GeoJSONFeature {
    type: string;
    properties?: any;
    geometry: {
        type: string;
        coordinates: any[];
    };
    bbox?: number[];
}

interface GeoJSONCollection {
    type: string;
    features: GeoJSONFeature[];
}

interface UploadResult {
    file: string;
    success: boolean;
    featuresCount?: number;
    result?: any;
    error?: string;
}

interface BulkUploadSummary {
    successfulUploads: UploadResult[];
    failedUploads: UploadResult[];
    totalFeatures: number;
    summary: {
        totalFiles: number;
        successful: number;
        failed: number;
        totalFeatures: number;
        successRate: number;
    };
}

class BulkJSONUploader {

    /**
     * Upload features from a JSON array file
     */
    async uploadFromJSONFile(filePath: string, collectionId: string) {
        try {
            console.log(`📂 Reading JSON file: ${filePath}`);

            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const fileContent = fs.readFileSync(filePath, 'utf8');
            const jsonData = JSON.parse(fileContent);

            let features: FeatureInput[] = [];

            // Handle different JSON formats
            if (Array.isArray(jsonData)) {
                // Direct array of features
                features = jsonData.map(item => ({
                    collectionId,
                    type: item.type || 'Feature',
                    properties: item.properties || item,
                    geometry: item.geometry,
                    bounds: item.bounds || item.bbox
                }));
            } else if (jsonData.type === 'FeatureCollection' && jsonData.features) {
                // GeoJSON FeatureCollection
                features = jsonData.features.map((feature: GeoJSONFeature) => ({
                    collectionId,
                    type: feature.type || 'Feature',
                    properties: feature.properties || {},
                    geometry: feature.geometry,
                    bounds: feature.bbox
                }));
            } else {
                // Single feature object
                features = [{
                    collectionId,
                    type: jsonData.type || 'Feature',
                    properties: jsonData.properties || jsonData,
                    geometry: jsonData.geometry,
                    bounds: jsonData.bounds || jsonData.bbox
                }];
            }

            console.log(`📊 Found ${features.length} features in JSON file`);

            if (features.length === 0) {
                throw new Error('No valid features found in JSON file');
            }

            return await this.processAndUpload(features);

        } catch (error) {
            console.error('❌ Error uploading from JSON file:', error);
            throw error;
        }
    }

    /**
     * Upload features from GeoJSON format
     */
    async uploadFromGeoJSON(geoJsonData: GeoJSONCollection | string, collectionId: string) {
        try {
            console.log('📤 Processing GeoJSON data...');

            const data = typeof geoJsonData === 'string' ? JSON.parse(geoJsonData) : geoJsonData;

            if (!data.type || data.type !== 'FeatureCollection' || !data.features) {
                throw new Error('Invalid GeoJSON format - must be a FeatureCollection');
            }

            const features: FeatureInput[] = data.features.map((feature: GeoJSONFeature) => ({
                collectionId,
                type: feature.type || 'Feature',
                properties: feature.properties || {},
                geometry: feature.geometry,
                bounds: feature.bbox
            }));

            console.log(`📊 Processing ${features.length} GeoJSON features`);

            return await this.processAndUpload(features);

        } catch (error) {
            console.error('❌ Error uploading GeoJSON:', error);
            throw error;
        }
    }

    /**
     * Process and upload features with proper validation
     */
    private async processAndUpload(features: FeatureInput[]) {
        try {
            // Convert to the format expected by the service
            const processedFeatures = features.map(feature => ({
                collectionId: feature.collectionId,
                type: feature.type,
                properties: JSON.stringify(feature.properties),
                geometry: JSON.stringify(feature.geometry),
                bounds: feature.bounds ? JSON.stringify(feature.bounds) : undefined
            }));

            console.log(`📤 Uploading ${processedFeatures.length} features...`);

            const startTime = Date.now();
            const result = await GeoJsonService.bulkCreateFeatures(processedFeatures);
            const endTime = Date.now();

            console.log(`✅ Successfully uploaded ${result.length} features in ${endTime - startTime}ms`);
            return result;

        } catch (error) {
            console.error('❌ Error processing and uploading features:', error);
            throw error;
        }
    }

    /**
     * Create sample JSON files for testing
     */
    async createSampleFiles() {
        try {
            console.log('📝 Creating sample JSON files...');

            // Sample 1: Direct feature array
            const sampleFeatures = [
                {
                    type: "Feature",
                    properties: {
                        id: 1,
                        name: "Sample Property 1",
                        area: "2.5 hectares",
                        price: "50 lakhs",
                        state: "Rajasthan",
                        district: "Alwar",
                        village: "Test Village 1"
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [76.7447, 27.2810]
                    }
                },
                {
                    type: "Feature",
                    properties: {
                        id: 2,
                        name: "Sample Property 2",
                        area: "1.8 hectares",
                        price: "35 lakhs",
                        state: "Rajasthan",
                        district: "Alwar",
                        village: "Test Village 2"
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [76.7500, 27.2850]
                    }
                }
            ];

            // Sample 2: GeoJSON FeatureCollection
            const geoJsonSample = {
                type: "FeatureCollection",
                features: [
                    {
                        type: "Feature",
                        properties: {
                            id: 101,
                            name: "GeoJSON Property 1",
                            area: "3.2 hectares",
                            price: "65 lakhs",
                            state: "Rajasthan"
                        },
                        geometry: {
                            type: "Point",
                            coordinates: [76.7400, 27.2800]
                        }
                    },
                    {
                        type: "Feature",
                        properties: {
                            id: 102,
                            name: "GeoJSON Property 2",
                            area: "4.1 hectares",
                            price: "80 lakhs",
                            state: "Rajasthan"
                        },
                        geometry: {
                            type: "Point",
                            coordinates: [76.7450, 27.2820]
                        }
                    }
                ]
            };

            const featuresFile = path.join(__dirname, 'sample-features.json');
            const geoJsonFile = path.join(__dirname, 'sample-geojson.json');

            fs.writeFileSync(featuresFile, JSON.stringify(sampleFeatures, null, 2));
            fs.writeFileSync(geoJsonFile, JSON.stringify(geoJsonSample, null, 2));

            console.log(`✅ Created sample files:`);
            console.log(`   - ${featuresFile}`);
            console.log(`   - ${geoJsonFile}`);

            return { featuresFile, geoJsonFile };

        } catch (error) {
            console.error('❌ Error creating sample files:', error);
            throw error;
        }
    }

    /**
     * Upload all JSON files from a directory
     */
    async uploadFromDirectory(directoryPath: string, collectionId: string, filePattern: string = '*.json') {
        try {
            console.log(`📂 Scanning directory: ${directoryPath}`);

            if (!fs.existsSync(directoryPath)) {
                throw new Error(`Directory not found: ${directoryPath}`);
            }

            // Get all JSON files in the directory
            const files = fs.readdirSync(directoryPath)
                .filter(file => file.endsWith('.json'))
                .map(file => path.join(directoryPath, file));

            console.log(`📊 Found ${files.length} JSON files to process`);

            if (files.length === 0) {
                throw new Error('No JSON files found in directory');
            }

            return await this.uploadMultipleFiles(files, collectionId);

        } catch (error) {
            console.error('❌ Error uploading from directory:', error);
            throw error;
        }
    }

    /**
     * Upload multiple JSON files from a list of file paths
     */
    async uploadMultipleFiles(filePaths: string[], collectionId: string): Promise<BulkUploadSummary> {
        try {
            console.log(`📤 Processing ${filePaths.length} files...`);

            const results: UploadResult[] = [];
            const errors: UploadResult[] = [];
            let totalFeatures = 0;
            let processedFiles = 0;

            for (const filePath of filePaths) {
                try {
                    console.log(`\n📄 Processing file ${processedFiles + 1}/${filePaths.length}: ${path.basename(filePath)}`);

                    const result = await this.uploadFromJSONFile(filePath, collectionId);

                    results.push({
                        file: filePath,
                        success: true,
                        featuresCount: result.length,
                        result
                    });

                    totalFeatures += result.length;
                    processedFiles++;

                    console.log(`✅ ${path.basename(filePath)}: ${result.length} features uploaded`);

                } catch (error) {
                    console.error(`❌ Failed to process ${path.basename(filePath)}:`, error instanceof Error ? error.message : error);

                    errors.push({
                        file: filePath,
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error'
                    });
                }
            }

            console.log(`\n📈 Bulk Upload Summary:`);
            console.log(`========================`);
            console.log(`✅ Successfully processed: ${results.length} files`);
            console.log(`❌ Failed: ${errors.length} files`);
            console.log(`📊 Total features uploaded: ${totalFeatures}`);
            console.log(`📈 Success rate: ${((results.length / filePaths.length) * 100).toFixed(1)}%`);

            if (errors.length > 0) {
                console.log(`\n❌ Failed files:`);
                errors.forEach(error => {
                    console.log(`   - ${path.basename(error.file)}: ${error.error}`);
                });
            }

            return {
                successfulUploads: results,
                failedUploads: errors,
                totalFeatures,
                summary: {
                    totalFiles: filePaths.length,
                    successful: results.length,
                    failed: errors.length,
                    totalFeatures,
                    successRate: (results.length / filePaths.length) * 100
                }
            };

        } catch (error) {
            console.error('❌ Error in bulk upload:', error);
            throw error;
        }
    }

    /**
     * Upload files with batch processing (for better performance with many files)
     */
    async uploadFilesBatch(filePaths: string[], collectionId: string, batchSize: number = 10): Promise<BulkUploadSummary> {
        try {
            console.log(`📤 Processing ${filePaths.length} files in batches of ${batchSize}...`);

            const results: UploadResult[] = [];
            const errors: UploadResult[] = [];
            let totalFeatures = 0;

            // Process files in batches
            for (let i = 0; i < filePaths.length; i += batchSize) {
                const batch = filePaths.slice(i, i + batchSize);
                const batchNumber = Math.floor(i / batchSize) + 1;
                const totalBatches = Math.ceil(filePaths.length / batchSize);

                console.log(`\n🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} files)...`);

                // Process batch files in parallel
                const batchPromises = batch.map(async (filePath) => {
                    try {
                        const result = await this.uploadFromJSONFile(filePath, collectionId);
                        return {
                            file: filePath,
                            success: true,
                            featuresCount: result.length,
                            result
                        };
                    } catch (error) {
                        return {
                            file: filePath,
                            success: false,
                            error: error instanceof Error ? error.message : 'Unknown error'
                        };
                    }
                });

                const batchResults = await Promise.all(batchPromises);

                // Separate successful and failed results
                batchResults.forEach(result => {
                    if (result.success && result.featuresCount) {
                        results.push(result);
                        totalFeatures += result.featuresCount;
                        console.log(`✅ ${path.basename(result.file)}: ${result.featuresCount} features`);
                    } else {
                        errors.push(result);
                        console.log(`❌ ${path.basename(result.file)}: ${result.error}`);
                    }
                });

                console.log(`📊 Batch ${batchNumber} completed: ${batchResults.filter(r => r.success).length}/${batch.length} successful`);

                // Small delay between batches to avoid overwhelming the database
                if (i + batchSize < filePaths.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            console.log(`\n📈 Batch Upload Summary:`);
            console.log(`=========================`);
            console.log(`✅ Successfully processed: ${results.length} files`);
            console.log(`❌ Failed: ${errors.length} files`);
            console.log(`📊 Total features uploaded: ${totalFeatures}`);
            console.log(`📈 Success rate: ${((results.length / filePaths.length) * 100).toFixed(1)}%`);

            return {
                successfulUploads: results,
                failedUploads: errors,
                totalFeatures,
                summary: {
                    totalFiles: filePaths.length,
                    successful: results.length,
                    failed: errors.length,
                    totalFeatures,
                    successRate: (results.length / filePaths.length) * 100
                }
            };

        } catch (error) {
            console.error('❌ Error in batch upload:', error);
            throw error;
        }
    }

    // ...existing code...
}

// Test functions
async function testJSONUpload(collectionId: string) {
    try {
        console.log('🧪 Testing JSON file upload...\n');

        const uploader = new BulkJSONUploader();

        // Create sample files
        const { featuresFile, geoJsonFile } = await uploader.createSampleFiles();

        console.log('\n1️⃣ Testing feature array upload...');
        const result1 = await uploader.uploadFromJSONFile(featuresFile, collectionId);
        console.log(`✅ Uploaded ${result1.length} features from array format`);

        console.log('\n2️⃣ Testing GeoJSON upload...');
        const result2 = await uploader.uploadFromJSONFile(geoJsonFile, collectionId);
        console.log(`✅ Uploaded ${result2.length} features from GeoJSON format`);

        return { result1, result2 };

    } catch (error) {
        console.error('❌ Test failed:', error);
        throw error;
    }
}

async function testWithExistingFile(filePath: string, collectionId: string) {
    try {
        console.log(`🧪 Testing upload from existing file: ${filePath}\n`);

        const uploader = new BulkJSONUploader();
        const result = await uploader.uploadFromJSONFile(filePath, collectionId);

        console.log(`✅ Successfully uploaded ${result.length} features`);
        return result;

    } catch (error) {
        console.error('❌ Test with existing file failed:', error);
        throw error;
    }
}

// New bulk upload test functions
async function testBulkUploadFromDirectory(directoryPath: string, collectionId: string) {
    try {
        console.log(`🧪 Testing bulk upload from directory: ${directoryPath}\n`);

        const uploader = new BulkJSONUploader();
        const result = await uploader.uploadFromDirectory(directoryPath, collectionId);

        console.log(`\n🎉 Bulk upload completed!`);
        console.log(`✅ ${result.summary.successful} files processed successfully`);
        console.log(`❌ ${result.summary.failed} files failed`);
        console.log(`📊 ${result.summary.totalFeatures} total features uploaded`);

        return result;

    } catch (error) {
        console.error('❌ Bulk directory upload test failed:', error);
        throw error;
    }
}

async function testBulkUploadFromFileList(filePaths: string[], collectionId: string, useBatch: boolean = false) {
    try {
        console.log(`🧪 Testing bulk upload from file list (${filePaths.length} files)\n`);

        const uploader = new BulkJSONUploader();
        let result;

        if (useBatch) {
            console.log('Using batch processing...');
            result = await uploader.uploadFilesBatch(filePaths, collectionId, 5); // Process 5 files at a time
        } else {
            console.log('Using sequential processing...');
            result = await uploader.uploadMultipleFiles(filePaths, collectionId);
        }

        console.log(`\n🎉 Bulk upload completed!`);
        console.log(`✅ ${result.summary.successful} files processed successfully`);
        console.log(`❌ ${result.summary.failed} files failed`);
        console.log(`📊 ${result.summary.totalFeatures} total features uploaded`);

        return result;

    } catch (error) {
        console.error('❌ Bulk file list upload test failed:', error);
        throw error;
    }
}

// Main function
async function main() {
    console.log('📤 JSON Bulk Feature Upload Tool');
    console.log('=================================\n');

    try {
        // Get or create a collection
        const collections = await GeoJsonService.listCollections();

        let collectionId: string;

        if (collections.length === 0) {
            console.log('❌ No collections found. Creating a test collection...\n');
            const testCollection = await GeoJsonService.createCollection({
                name: 'JSON Upload Test Collection',
                description: 'Collection created for testing JSON uploads',
                data: '[]'
            });
            console.log(`✅ Created test collection: ${testCollection.name} (${testCollection.id})\n`);
            collectionId = testCollection.id;
        } else {
            collectionId = collections[0].id;
            console.log(`🎯 Using existing collection: ${collections[0].name} (${collectionId})\n`);
        }

        // Run tests
        await testJSONUpload(collectionId);

        console.log('\n✅ All JSON upload tests completed successfully!');

        // Show usage instructions
        console.log('\n📋 Usage Instructions:');
        console.log('========================');
        console.log('1. Upload single JSON file:');
        console.log(`   const uploader = new BulkJSONUploader();`);
        console.log(`   await uploader.uploadFromJSONFile('path/to/file.json', 'collection-id');`);
        console.log('');
        console.log('2. Upload all JSON files from a directory:');
        console.log(`   await uploader.uploadFromDirectory('/path/to/directory', 'collection-id');`);
        console.log('');
        console.log('3. Upload specific files:');
        console.log(`   const files = ['file1.json', 'file2.json', ...];`);
        console.log(`   await uploader.uploadMultipleFiles(files, 'collection-id');`);
        console.log('');
        console.log('4. Upload with batch processing (recommended for 100+ files):');
        console.log(`   await uploader.uploadFilesBatch(files, 'collection-id', 10);`);
        console.log('');
        console.log('5. Supported JSON formats:');
        console.log('   - Feature Array: [{ properties: {...}, geometry: {...} }, ...]');
        console.log('   - GeoJSON FeatureCollection: { type: "FeatureCollection", features: [...] }');
        console.log('   - Single Feature: { properties: {...}, geometry: {...} }');
        console.log('');
        console.log('💡 For 100 files, use one of these approaches:');
        console.log('   - Put all files in a directory and use uploadFromDirectory()');
        console.log('   - Use uploadFilesBatch() for better performance and error handling');

    } catch (error) {
        console.error('❌ JSON bulk upload failed:', error);
        process.exit(1);
    }
}

// Export the uploader class and test functions
export {
    BulkJSONUploader,
    testJSONUpload,
    testWithExistingFile,
    testBulkUploadFromDirectory,
    testBulkUploadFromFileList,
    type UploadResult,
    type BulkUploadSummary
};

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}
