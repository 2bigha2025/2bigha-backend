import { GeoJsonService } from '../src/graphql/services/geo-json.service';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

interface BulkFeature {
    collectionId: string;
    type: string;
    properties: string;
    geometry: string;
    bounds?: string;
}

interface BulkFeatureInput {
    collectionId: string;
    type: string;
    properties: string | object;
    geometry: string | object;
    bounds?: string | object;
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

class BulkFeatureUploader {

    /**
     * Upload features from a JSON array
     */
    async uploadFromArray(features: BulkFeatureInput[]) {
        try {
            console.log(`📤 Uploading ${features.length} features...`);

            // Convert input features to the correct format
            const processedFeatures: BulkFeature[] = features.map(feature => ({
                collectionId: feature.collectionId,
                type: feature.type,
                properties: typeof feature.properties === 'string' ? feature.properties : JSON.stringify(feature.properties),
                geometry: typeof feature.geometry === 'string' ? feature.geometry : JSON.stringify(feature.geometry),
                bounds: feature.bounds ? (typeof feature.bounds === 'string' ? feature.bounds : JSON.stringify(feature.bounds)) : undefined
            }));

            const startTime = Date.now();
            const result = await GeoJsonService.bulkCreateFeatures(processedFeatures);
            const endTime = Date.now();

            console.log(`✅ Successfully uploaded ${result.length} features in ${endTime - startTime}ms`);
            return result;

        } catch (error) {
            console.error('❌ Error uploading features:', error);
            throw error;
        }
    }

    /**
     * Upload features from a GeoJSON file
     */
    async uploadFromGeoJSONFile(filePath: string, collectionId: string) {
        try {
            console.log(`📂 Reading GeoJSON file: ${filePath}`);

            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const fileContent = fs.readFileSync(filePath, 'utf8');
            const geoJsonData: GeoJSONCollection = JSON.parse(fileContent);

            console.log(`📊 Found ${geoJsonData.features?.length || 0} features in GeoJSON file`);

            return await GeoJsonService.importGeoJsonData(collectionId, geoJsonData);

        } catch (error) {
            console.error('❌ Error uploading from GeoJSON file:', error);
            throw error;
        }
    }

    /**
     * Upload features from a CSV file
     */
    async uploadFromCSVFile(filePath: string, collectionId: string, mapping: {
        typeColumn: string;
        propertiesColumns: string[];
        geometryColumn: string;
        boundsColumn?: string;
    }) {
        try {
            console.log(`📂 Reading CSV file: ${filePath}`);

            if (!fs.existsSync(filePath)) {
                throw new Error(`File not found: ${filePath}`);
            }

            const csv = require('csv-parser');
            const features: BulkFeature[] = [];

            return new Promise((resolve, reject) => {
                fs.createReadStream(filePath)
                    .pipe(csv())
                    .on('data', (row: any) => {
                        try {
                            const properties: any = {};
                            mapping.propertiesColumns.forEach(col => {
                                if (row[col] !== undefined) {
                                    properties[col] = row[col];
                                }
                            });

                            const feature: BulkFeature = {
                                collectionId,
                                type: row[mapping.typeColumn] || 'Feature',
                                properties: JSON.stringify(properties),
                                geometry: row[mapping.geometryColumn],
                                bounds: mapping.boundsColumn ? row[mapping.boundsColumn] : undefined
                            };

                            features.push(feature);
                        } catch (error) {
                            console.warn('⚠️ Skipping invalid row:', error);
                        }
                    })
                    .on('end', async () => {
                        try {
                            console.log(`📊 Processed ${features.length} features from CSV`);
                            const result = await GeoJsonService.bulkCreateFeatures(features);
                            resolve(result);
                        } catch (error) {
                            reject(error);
                        }
                    })
                    .on('error', reject);
            });

        } catch (error) {
            console.error('❌ Error uploading from CSV file:', error);
            throw error;
        }
    }

    /**
     * Create sample features for testing
     */
    async createSampleFeatures(collectionId: string, count: number = 5) {
        try {
            console.log(`🧪 Creating ${count} sample features...`);

            const sampleFeatures: BulkFeature[] = [];

            // Sample coordinates around Rajasthan, India
            const baseLatitude = 27.0238;
            const baseLongitude = 74.2179;

            for (let i = 0; i < count; i++) {
                // Add some random offset to create different locations
                const lat = baseLatitude + (Math.random() - 0.5) * 0.1;
                const lng = baseLongitude + (Math.random() - 0.5) * 0.1;

                const sampleGeometry = {
                    type: "Point",
                    coordinates: [lng, lat]
                };

                const sampleProperties = {
                    id: i + 1,
                    name: `Sample Feature ${i + 1}`,
                    description: `This is a sample feature created for testing`,
                    area: `${(Math.random() * 10).toFixed(2)} hectares`,
                    price: `${Math.floor(Math.random() * 100) + 20} lakhs`,
                    state: "Rajasthan",
                    district: "Sample District",
                    village: `Sample Village ${i + 1}`,
                    createdAt: new Date().toISOString()
                };

                sampleFeatures.push({
                    collectionId,
                    type: "Feature",
                    properties: JSON.stringify(sampleProperties),
                    geometry: JSON.stringify(sampleGeometry)
                });
            }

            return await this.uploadFromArray(sampleFeatures);

        } catch (error) {
            console.error('❌ Error creating sample features:', error);
            throw error;
        }
    }

    /**
     * Validate features before upload
     */
    validateFeatures(features: BulkFeatureInput[]): { valid: BulkFeatureInput[], invalid: any[] } {
        const valid: BulkFeatureInput[] = [];
        const invalid: any[] = [];

        features.forEach((feature, index) => {
            try {
                // Validate required fields
                if (!feature.collectionId || !feature.type) {
                    throw new Error('Missing required fields: collectionId or type');
                }

                // Validate and parse geometry
                let geometry;
                if (typeof feature.geometry === 'string') {
                    geometry = JSON.parse(feature.geometry);
                } else {
                    geometry = feature.geometry;
                }

                if (!geometry.type || !geometry.coordinates) {
                    throw new Error('Invalid geometry: missing type or coordinates');
                }

                // Validate properties
                if (typeof feature.properties === 'string') {
                    JSON.parse(feature.properties);
                }

                valid.push(feature);

            } catch (error) {
                invalid.push({
                    index,
                    feature,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        });

        return { valid, invalid };
    }
}

// Test functions
async function testBulkUploadFromArray(collectionId: string) {
    try {
        console.log('🧪 Testing bulk upload from array...\n');

        const uploader = new BulkFeatureUploader();

        const sampleFeatures: BulkFeatureInput[] = [
            {
                collectionId,
                type: "Feature",
                properties: {
                    id: 101,
                    name: "Test Property 1",
                    area: "2.5 hectares",
                    price: "50 lakhs",
                    state: "Rajasthan"
                },
                geometry: {
                    type: "Point",
                    coordinates: [76.7447, 27.2810]
                }
            },
            {
                collectionId,
                type: "Feature",
                properties: {
                    id: 102,
                    name: "Test Property 2",
                    area: "1.8 hectares",
                    price: "35 lakhs",
                    state: "Rajasthan"
                },
                geometry: {
                    type: "Point",
                    coordinates: [76.7500, 27.2850]
                }
            }
        ];

        // Validate features first
        const validation = uploader.validateFeatures(sampleFeatures);
        console.log(`✅ ${validation.valid.length} valid features`);
        console.log(`❌ ${validation.invalid.length} invalid features`);

        if (validation.invalid.length > 0) {
            console.log('Invalid features:', validation.invalid);
        }

        if (validation.valid.length > 0) {
            const result = await uploader.uploadFromArray(validation.valid);
            console.log('Upload result:', result.length, 'features created');
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

async function testBulkUploadFromGeoJSON(collectionId: string, filePath?: string) {
    try {
        console.log('🧪 Testing bulk upload from GeoJSON...\n');

        const uploader = new BulkFeatureUploader();

        // If no file path provided, create a sample GeoJSON file
        if (!filePath) {
            const sampleGeoJSON = {
                type: "FeatureCollection",
                features: [
                    {
                        type: "Feature",
                        properties: {
                            id: 201,
                            name: "GeoJSON Test Property 1",
                            area: "3.2 hectares",
                            price: "65 lakhs"
                        },
                        geometry: {
                            type: "Point",
                            coordinates: [76.7400, 27.2800]
                        }
                    },
                    {
                        type: "Feature",
                        properties: {
                            id: 202,
                            name: "GeoJSON Test Property 2",
                            area: "4.1 hectares",
                            price: "80 lakhs"
                        },
                        geometry: {
                            type: "Point",
                            coordinates: [76.7450, 27.2820]
                        }
                    }
                ]
            };

            filePath = path.join(__dirname, 'sample-features.geojson');
            fs.writeFileSync(filePath, JSON.stringify(sampleGeoJSON, null, 2));
            console.log(`📝 Created sample GeoJSON file: ${filePath}`);
        }

        const result = await uploader.uploadFromGeoJSONFile(filePath, collectionId);
        console.log('Upload result:', result.length, 'features created');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

async function testCreateSampleFeatures(collectionId: string, count: number = 5) {
    try {
        console.log('🧪 Testing sample feature creation...\n');

        const uploader = new BulkFeatureUploader();
        const result = await uploader.createSampleFeatures(collectionId, count);

        console.log('Sample features created:', result.length);

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Main function
async function main() {
    console.log('📤 GeoJSON Bulk Feature Upload Tool');
    console.log('====================================\n');

    try {
        // First, let's list available collections
        const collections = await GeoJsonService.listCollections();

        if (collections.length === 0) {
            console.log('❌ No collections found. Creating a test collection...\n');
            const testCollection = await GeoJsonService.createCollection({
                name: 'Bulk Upload Test Collection',
                description: 'Collection created for testing bulk uploads',
                data: '[]'
            });
            console.log(`✅ Created test collection: ${testCollection.name} (${testCollection.id})\n`);
        }

        // Use the first available collection for testing
        const targetCollection = collections.length > 0 ? collections[0] : await GeoJsonService.listCollections().then(cols => cols[0]);
        const collectionId = targetCollection.id;

        console.log(`🎯 Using collection: ${targetCollection.name} (${collectionId})\n`);

        // Run different tests
        console.log('1️⃣ Testing array-based bulk upload...');
        await testBulkUploadFromArray(collectionId);

        console.log('\n2️⃣ Testing GeoJSON file upload...');
        await testBulkUploadFromGeoJSON(collectionId);

        console.log('\n3️⃣ Testing sample feature creation...');
        await testCreateSampleFeatures(collectionId, 3);

        console.log('\n✅ All bulk upload tests completed successfully!');

    } catch (error) {
        console.error('❌ Bulk upload tests failed:', error);
        process.exit(1);
    }
}

// Export the uploader class and test functions
export { BulkFeatureUploader, testBulkUploadFromArray, testBulkUploadFromGeoJSON, testCreateSampleFeatures };

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}
