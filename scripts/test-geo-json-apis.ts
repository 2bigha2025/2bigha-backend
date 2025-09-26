import { GeoJsonService } from '../src/graphql/services/geo-json.service';

async function testFindFeaturesWithinRadius() {
    try {
        console.log('🧪 Testing findFeaturesWithinRadius function...\n');

        // Test coordinates provided by user
        const lat = 27.281020051816224;  // Corrected: swapped lat/lng as the original seemed reversed
        const lng = 76.74473121536492;

        console.log(`📍 Searching for features within radius of:`);
        console.log(`   Latitude: ${lat}`);
        console.log(`   Longitude: ${lng}`);
        console.log(`   Radius: 100 km\n`);

        const startTime = Date.now();
        const results = await GeoJsonService.findFeaturesWithinRadius(lat, lng);
        const endTime = Date.now();

        console.log(`⚡ Query executed in ${endTime - startTime}ms`);
        console.log(`📊 Found ${results.length} features within radius\n`);

        if (results.length > 0) {
            console.log('🎯 Results:');
            results.forEach((feature, index) => {
                console.log(`\n${index + 1}. Feature ID: ${feature.id}`);
                console.log(`   Collection ID: ${feature.collectionId}`);
                console.log(`   Type: ${feature.type}`);
                console.log(`   Properties: ${JSON.stringify(feature.properties, null, 2)}`);
                if (feature.geojson && typeof feature.geojson === 'object' && 'type' in feature.geojson) {
                    console.log(`   Geometry Type: ${(feature.geojson as any).type}`);
                }
            });
        } else {
            console.log('❌ No features found within the specified radius');
            console.log('\n💡 Possible reasons:');
            console.log('   - No features exist in the database');
            console.log('   - Features are outside the 100km radius');
            console.log('   - Geometry column (geom) is not populated');
            console.log('   - PostGIS extensions might not be enabled');
        }

    } catch (error) {
        console.error('❌ Error testing findFeaturesWithinRadius:');
        console.error(error instanceof Error ? error.message : error);

        // Additional debugging information
        console.log('\n🔍 Debugging tips:');
        console.log('1. Ensure PostGIS is installed and enabled in your database');
        console.log('2. Check if the geom column exists and has spatial data');
        console.log('3. Verify that features have been created with proper geometry');
        console.log('4. Consider creating a spatial index: CREATE INDEX idx_geojson_features_geom ON geojson_features USING GIST(geom);');
    }
}

async function testListAllFeatures() {
    try {
        console.log('\n📋 Listing all collections and their features...\n');

        const collections = await GeoJsonService.listCollections();

        if (collections.length === 0) {
            console.log('❌ No collections found in the database');
            return;
        }

        collections.forEach((collection, index) => {
            console.log(`${index + 1}. Collection: ${collection.name} (ID: ${collection.id})`);
            console.log(`   Description: ${collection.description || 'No description'}`);
            console.log(`   Features count: ${collection.features?.length || 0}`);

            if (collection.features && collection.features.length > 0) {
                collection.features.forEach((feature, featureIndex) => {
                    console.log(`     ${featureIndex + 1}. ${feature.type} - ${feature.id}`);
                });
            }
            console.log('');
        });

    } catch (error) {
        console.error('❌ Error listing collections:', error);
    }
}

// Main test function
async function main() {
    console.log('🌍 GeoJSON Service Test Suite');
    console.log('==============================\n');

    try {
        // First list all available data
        await testListAllFeatures();

        // Then test the radius search
        await testFindFeaturesWithinRadius();

        console.log('\n✅ Test suite completed successfully');

    } catch (error) {
        console.error('❌ Test suite failed:', error);
        process.exit(1);
    }
}

// Run the tests
if (require.main === module) {
    main().catch(console.error);
}

export { testFindFeaturesWithinRadius, testListAllFeatures };
