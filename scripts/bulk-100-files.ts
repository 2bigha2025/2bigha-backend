import { BulkJSONUploader, type BulkUploadSummary } from './bulk-upload-json';
import { GeoJsonService } from '../src/graphql/services/geo-json.service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Script to handle bulk upload of 100 JSON files
 * Usage examples:
 * 1. All files in a directory: node bulk-100-files.js --directory /path/to/files
 * 2. Specific file list: node bulk-100-files.js --files file1.json,file2.json,...
 * 3. Interactive mode: node bulk-100-files.js
 */

class Bulk100FilesUploader {
    private uploader: BulkJSONUploader;

    constructor() {
        this.uploader = new BulkJSONUploader();
    }

    /**
     * Upload all files from a directory with progress tracking
     */
    async uploadDirectory(directoryPath: string) {
        try {
            console.log('🚀 Starting bulk upload of 100 files...');
            console.log(`📂 Directory: ${directoryPath}\n`);

            // Create collection based on directory name
            const dirName = path.basename(directoryPath);
            console.log(`📁 Creating collection for: ${dirName}`);

            const newCollection = await GeoJsonService.createCollection({
                name: `${dirName} Collection`,
                description: `Collection for bulk upload of files from ${dirName} directory`,
                data: '[]'
            });

            console.log(`✅ Created collection: ${newCollection.name} (${newCollection.id})\n`);

            const startTime = Date.now();
            const result = await this.uploader.uploadFromDirectory(directoryPath, newCollection.id);
            const endTime = Date.now();

            this.displayResults(result, endTime - startTime);
            return result;

        } catch (error) {
            console.error('❌ Bulk directory upload failed:', error);
            throw error;
        }
    }

    /**
     * Upload files using batch processing (recommended for 100+ files)
     */
    async uploadFilesBatch(filePaths: string[], collectionId: string, batchSize: number = 10) {
        try {
            console.log('🚀 Starting batch upload of files...');
            console.log(`📊 Total files: ${filePaths.length}`);
            console.log(`📦 Batch size: ${batchSize}`);
            console.log(`📊 Collection ID: ${collectionId}\n`);

            const startTime = Date.now();
            const result = await this.uploader.uploadFilesBatch(filePaths, collectionId, batchSize);
            const endTime = Date.now();

            this.displayResults(result, endTime - startTime);
            return result;

        } catch (error) {
            console.error('❌ Batch upload failed:', error);
            throw error;
        }
    }

    /**
     * Display detailed results of the upload
     */
    private displayResults(result: BulkUploadSummary, duration: number) {
        console.log('\n🎉 BULK UPLOAD COMPLETED!');
        console.log('=========================');
        console.log(`⏱️  Total time: ${(duration / 1000).toFixed(2)} seconds`);
        console.log(`📁 Total files: ${result.summary.totalFiles}`);
        console.log(`✅ Successful: ${result.summary.successful}`);
        console.log(`❌ Failed: ${result.summary.failed}`);
        console.log(`📊 Total features uploaded: ${result.summary.totalFeatures}`);
        console.log(`📈 Success rate: ${result.summary.successRate.toFixed(1)}%`);
        console.log(`⚡ Average speed: ${(result.summary.totalFeatures / (duration / 1000)).toFixed(1)} features/second`);

        if (result.failedUploads.length > 0) {
            console.log('\n❌ Failed Files:');
            console.log('================');
            result.failedUploads.forEach((failed, index) => {
                console.log(`${index + 1}. ${path.basename(failed.file)}`);
                console.log(`   Error: ${failed.error}`);
            });
        }

        console.log('\n📈 Performance Stats:');
        console.log('====================');
        console.log(`Files per minute: ${((result.summary.successful / (duration / 60000))).toFixed(1)}`);
        console.log(`Features per minute: ${((result.summary.totalFeatures / (duration / 60000))).toFixed(1)}`);
    }

    /**
     * Validate all files before upload
     */
    async validateFiles(filePaths: string[]) {
        console.log('🔍 Validating files before upload...\n');

        const validFiles: string[] = [];
        const invalidFiles: { file: string; error: string }[] = [];

        for (const filePath of filePaths) {
            try {
                if (!fs.existsSync(filePath)) {
                    throw new Error('File not found');
                }

                const content = fs.readFileSync(filePath, 'utf8');
                const data = JSON.parse(content);

                // Basic validation
                if (Array.isArray(data)) {
                    // Feature array
                    if (data.length === 0) {
                        throw new Error('Empty array');
                    }
                } else if (data.type === 'FeatureCollection') {
                    // GeoJSON
                    if (!data.features || data.features.length === 0) {
                        throw new Error('No features in FeatureCollection');
                    }
                } else if (!data.geometry && !data.properties) {
                    throw new Error('Invalid feature format');
                }

                validFiles.push(filePath);
                console.log(`✅ ${path.basename(filePath)} - Valid`);

            } catch (error) {
                invalidFiles.push({
                    file: filePath,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                console.log(`❌ ${path.basename(filePath)} - ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        console.log(`\n📊 Validation Summary:`);
        console.log(`✅ Valid files: ${validFiles.length}`);
        console.log(`❌ Invalid files: ${invalidFiles.length}`);

        return { validFiles, invalidFiles };
    }

    /**
     * Generate a list of all JSON files in a directory
     */
    getFilesFromDirectory(directoryPath: string): string[] {
        if (!fs.existsSync(directoryPath)) {
            throw new Error(`Directory not found: ${directoryPath}`);
        }

        const files = fs.readdirSync(directoryPath)
            .filter(file => file.endsWith('.json'))
            .map(file => path.join(directoryPath, file));

        return files;
    }
}

// Main execution function
async function main() {
    console.log('📤 Bulk Upload Tool for 100 JSON Files');
    console.log('=======================================\n');

    try {
        const bulk100Uploader = new Bulk100FilesUploader();

        // Example usage - you can uncomment and modify based on your needs

        // Option 1: Upload from directory (RECOMMENDED FOR 100 FILES)
        const directoryPath = '/path/to/your/100/json/files'; // Update this path
        // await bulk100Uploader.uploadDirectory(directoryPath);

        // Create a new collection for specific files
        const newCollection = await GeoJsonService.createCollection({
            name: 'Manual Files Collection',
            description: 'Collection for manually specified JSON files',
            data: '[]'
        });
        console.log(`✅ Created collection: ${newCollection.name} (${newCollection.id})\n`);

        // Option 2: Upload specific files with validation (CURRENT - ALL 99 FILES)
        const filePaths = [
            // Existing uploaded files
            path.join(__dirname, 'ladiyaka.json'),
            path.join(__dirname, 'pinan_khasra.json'),
            // All 99 GeoJSON files from geo folder
            path.join(__dirname, 'geo', 'Alamshah_J.geojson'),
            path.join(__dirname, 'geo', 'Alghani_J.geojson'),
            path.join(__dirname, 'geo', 'Araji_isnaka_GEO.geojson'),
            path.join(__dirname, 'geo', 'Arsi_J.geojson'),
            path.join(__dirname, 'geo', 'Atru_Sector_22_J.geojson'),
            path.join(__dirname, 'geo', 'Balraka_GEO (3).geojson'),
            path.join(__dirname, 'geo', 'Barkhera_GEO.geojson'),
            path.join(__dirname, 'geo', 'Barsana_J.geojson'),
            path.join(__dirname, 'geo', 'Bharkhera_Faujdar_G.geojson'),
            path.join(__dirname, 'geo', 'Bhootka_J.geojson'),
            path.join(__dirname, 'geo', 'Birgawan_J.geojson'),
            path.join(__dirname, 'geo', 'Boochaka_J.geojson'),
            path.join(__dirname, 'geo', 'Chiraval Mali_G.geojson'),
            path.join(__dirname, 'geo', 'Daurala_J.geojson'),
            path.join(__dirname, 'geo', 'Dhandaka_J.geojson'),
            path.join(__dirname, 'geo', 'Dhandholi_G.geojson'),
            path.join(__dirname, 'geo', 'Gangawak_j.geojson'),
            path.join(__dirname, 'geo', 'Gira_Road1.geojson'),
            path.join(__dirname, 'geo', 'Ishnaka_J.geojson'),
            path.join(__dirname, 'geo', 'Jalooki_GEO.geojson'),
            path.join(__dirname, 'geo', 'Jheetredi_GEOJson.geojson'),
            path.join(__dirname, 'geo', 'Khakhawal_GEOJSON.geojson'),
            path.join(__dirname, 'geo', 'Kurkain_GEO.geojson'),
            path.join(__dirname, 'geo', 'Muriya_GEO.geojson'),
            path.join(__dirname, 'geo', 'Nagla Bhogra_J.geojson'),
            path.join(__dirname, 'geo', 'Nauganwa_j (1).geojson'),
            path.join(__dirname, 'geo', 'Naymatputr_J.geojson'),
            path.join(__dirname, 'geo', 'NeemKhera_GEO (2).geojson'),
            path.join(__dirname, 'geo', 'Neemki_j.geojson'),
            path.join(__dirname, 'geo', 'Peeploo_J.geojson'),
            path.join(__dirname, 'geo', 'Poochari_GeoJson.geojson'),
            path.join(__dirname, 'geo', 'Pooothka_J.geojson'),
            path.join(__dirname, 'geo', 'Ramsinghpur palki_J.geojson'),
            path.join(__dirname, 'geo', 'Sarangpur_j.geojson'),
            path.join(__dirname, 'geo', 'SemlaKhurd_J.geojson'),
            path.join(__dirname, 'geo', 'Semli_j.geojson'),
            path.join(__dirname, 'geo', 'Shekhpur_J.geojson'),
            path.join(__dirname, 'geo', 'Sirthala_J.geojson'),
            path.join(__dirname, 'geo', 'Tajipur_j.geojson'),
            path.join(__dirname, 'geo', 'Vadhaka_J.geojson'),
            path.join(__dirname, 'geo', 'akhbarpur_J.geojson'),
            path.join(__dirname, 'geo', 'alipur_GEO.geojson'),
            path.join(__dirname, 'geo', 'bhakrasani_J.geojson'),
            path.join(__dirname, 'geo', 'bhoora ka jalmal_J (1).geojson'),
            path.join(__dirname, 'geo', 'chak sundervali_J.geojson'),
            path.join(__dirname, 'geo', 'chakcheluwa_J.geojson'),
            path.join(__dirname, 'geo', 'dunawal.geojson'),
            path.join(__dirname, 'geo', 'ghankar_alwar_G.geojson'),
            path.join(__dirname, 'geo', 'kaldaheri_J.geojson'),
            path.join(__dirname, 'geo', 'kasbanagar_G.geojson'),
            path.join(__dirname, 'geo', 'kasot_j.geojson'),
            path.join(__dirname, 'geo', 'moondot_J.geojson'),
            path.join(__dirname, 'geo', 'moraka_J.geojson'),
            path.join(__dirname, 'geo', 'naglaratanra_geoJSON (1).geojson'),
            path.join(__dirname, 'geo', 'pharsaka_J.geojson'),
            path.join(__dirname, 'geo', 'rojki_J.geojson'),
            path.join(__dirname, 'geo', 'taraudar_G.geojson')
        ];
        const { validFiles } = await bulk100Uploader.validateFiles(filePaths);
        if (validFiles.length > 0) {
            await bulk100Uploader.uploadFilesBatch(validFiles, newCollection.id, 10);
        } else {
            console.log('❌ No valid files found to upload');
        }

        // Option 3: Interactive - ask user for directory path
        console.log('📋 To use this script with your 100 files:');
        console.log('==========================================');
        console.log('1. Put all your JSON files in a single directory');
        console.log('2. Uncomment and modify the directoryPath in the code');
        console.log('3. Run the script again');
        console.log('');
        console.log('Example:');
        console.log('const directoryPath = "/Users/niyati/my-json-files";');
        console.log('await bulk100Uploader.uploadDirectory(directoryPath, collectionId);');
        console.log('');
        console.log('Or provide file paths directly in an array if files are scattered.');

    } catch (error) {
        console.error('❌ Bulk upload process failed:', error);
        process.exit(1);
    }
}

// Export for use in other scripts
export { Bulk100FilesUploader };

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}
