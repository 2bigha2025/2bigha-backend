// import { db } from "../src/database/connection"
// import {
//     properties,
//     propertySeo,
//     propertyVerification,
//     propertyImages,
//     propertyViews,
//     propertyPriceHistory,
// } from "../src/database/schema/property"

// import { adminUsers } from "../src/database/schema/admin-user"

// async function seedProperties() {
//     try {
//         console.log("🏠 Starting seeding of 50 diverse property listings...")

//         // Get existing users and admins

//         await db.delete(propertyPriceHistory)
//         await db.delete(propertyViews)
//         await db.delete(propertyImages)
//         await db.delete(propertyVerification)
//         await db.delete(propertySeo)
//         await db.delete(properties)


//         const admins = await db.select().from(adminUsers).limit(5)


//         // Helper function to generate random coordinates for different cities
//         const cityCoordinates = {
//             Delhi: { lat: 28.6139, lng: 77.209 },
//             Gurgaon: { lat: 28.4595, lng: 77.0266 },
//             Noida: { lat: 28.5355, lng: 77.391 },
//             Faridabad: { lat: 28.4089, lng: 77.3178 },
//             Mumbai: { lat: 19.076, lng: 72.8777 },
//             Pune: { lat: 18.5204, lng: 73.8567 },
//             Bangalore: { lat: 12.9716, lng: 77.5946 },
//             Chennai: { lat: 13.0827, lng: 80.2707 },
//             Hyderabad: { lat: 17.385, lng: 78.4867 },
//             Kolkata: { lat: 22.5726, lng: 88.3639 },
//         }

//         const getRandomCoordinate = (city: string) => {
//             const base = cityCoordinates[city] || cityCoordinates["Delhi"]
//             return {
//                 lat: base.lat + (Math.random() - 0.5) * 0.1,
//                 lng: base.lng + (Math.random() - 0.5) * 0.1,
//             }
//         }

//         // Property data array with 50 diverse listings
//         const propertyDataArray = [
//             // Residential Properties (20)
//             {
//                 title: "Luxury 4BHK Villa in DLF Phase 1, Gurgaon",
//                 description:
//                     "Stunning 4BHK villa with private garden, swimming pool, and premium amenities in DLF Phase 1. Perfect for families seeking luxury living.",
//                 propertyType: "VILLA",
//                 status: "PUBLISHED",
//                 price: 15000000,
//                 area: 3500,
//                 areaUnit: "SQFT",
//                 city: "Gurgaon",
//                 district: "Gurugram",
//                 state: "Haryana",
//                 pinCode: "122002",
//                 address: "Plot 123, DLF Phase 1, Near Golf Course Road",
//                 listingAs: "OWNER",
//                 ownerName: "Rajesh Kumar",
//                 ownerPhone: "+91-9876543210",
//                 approvalStatus: "APPROVED",
//                 isFeatured: true,
//                 isVerified: true,
//             },
//             {
//                 title: "Modern 3BHK Apartment in Sector 62, Noida",
//                 description:
//                     "Contemporary 3BHK apartment with modular kitchen, balcony, and metro connectivity. Ready to move in.",
//                 propertyType: "APARTMENT",
//                 status: "PUBLISHED",
//                 price: 8500000,
//                 area: 1450,
//                 areaUnit: "SQFT",
//                 city: "Noida",
//                 district: "Gautam Buddha Nagar",
//                 state: "Uttar Pradesh",
//                 pinCode: "201309",
//                 address: "Tower B, Apartment 1205, Sector 62",
//                 listingAs: "OWNER",
//                 ownerName: "Priya Sharma",
//                 ownerPhone: "+91-9876543211",
//                 approvalStatus: "APPROVED",
//                 isFeatured: true,
//                 isVerified: true,
//             },
//             {
//                 title: "Spacious 2BHK Flat for Rent in Lajpat Nagar, Delhi",
//                 description:
//                     "Well-maintained 2BHK flat with parking, 24/7 security, and excellent connectivity to metro stations.",
//                 propertyType: "APARTMENT",
//                 status: "PUBLISHED",
//                 price: 25000,
//                 area: 950,
//                 areaUnit: "SQFT",
//                 city: "Delhi",
//                 district: "South Delhi",
//                 state: "Delhi",
//                 pinCode: "110024",
//                 address: "A-123, Lajpat Nagar II, Near Metro Station",
//                 listingAs: "OWNER",
//                 ownerName: "Amit Singh",
//                 ownerPhone: "+91-9876543212",
//                 approvalStatus: "APPROVED",
//                 isFeatured: false,
//                 isVerified: true,
//             },
//             {
//                 title: "Independent House in Sector 40, Faridabad",
//                 description: "3BHK independent house with terrace, parking for 2 cars, and peaceful neighborhood.",
//                 propertyType: "RESIDENTIAL",
//                 status: "PUBLISHED",
//                 price: 6500000,
//                 area: 1800,
//                 areaUnit: "SQFT",
//                 city: "Faridabad",
//                 district: "Faridabad",
//                 state: "Haryana",
//                 pinCode: "121003",
//                 address: "House No. 456, Sector 40, Near City Park",
//                 listingAs: "OWNER",
//                 ownerName: "Sunita Gupta",
//                 ownerPhone: "+91-9876543213",
//                 approvalStatus: "APPROVED",
//                 isFeatured: false,
//                 isVerified: true,
//             },
//             {
//                 title: "Luxury Penthouse in Bandra West, Mumbai",
//                 description:
//                     "Exclusive penthouse with sea view, private terrace, and premium amenities in prime Bandra location.",
//                 propertyType: "APARTMENT",
//                 status: "PUBLISHED",
//                 price: 45000000,
//                 area: 2800,
//                 areaUnit: "SQFT",
//                 city: "Mumbai",
//                 district: "Mumbai Suburban",
//                 state: "Maharashtra",
//                 pinCode: "400050",
//                 address: "Penthouse, Sea View Towers, Bandra West",
//                 listingAs: "AGENT",
//                 ownerName: "Mumbai Premium Properties",
//                 ownerPhone: "+91-9876543214",
//                 approvalStatus: "APPROVED",
//                 isFeatured: true,
//                 isVerified: true,
//             },
//             {
//                 title: "Cozy 1BHK Studio in Koramangala, Bangalore",
//                 description:
//                     "Modern studio apartment perfect for young professionals, fully furnished with high-speed internet.",
//                 propertyType: "APARTMENT",
//                 status: "PUBLISHED",
//                 price: 18000,
//                 area: 600,
//                 areaUnit: "SQFT",
//                 city: "Bangalore",
//                 district: "Bangalore Urban",
//                 state: "Karnataka",
//                 pinCode: "560034",
//                 address: "Studio 301, Tech Park Residency, Koramangala",
//                 listingAs: "OWNER",
//                 ownerName: "Vikram Reddy",
//                 ownerPhone: "+91-9876543215",
//                 approvalStatus: "APPROVED",
//                 isFeatured: false,
//                 isVerified: true,
//             },
//             {
//                 title: "Family Villa in Jubilee Hills, Hyderabad",
//                 description: "Spacious 5BHK villa with garden, servant quarters, and premium location in Jubilee Hills.",
//                 propertyType: "VILLA",
//                 status: "PUBLISHED",
//                 price: 25000000,
//                 area: 4200,
//                 areaUnit: "SQFT",
//                 city: "Hyderabad",
//                 district: "Hyderabad",
//                 state: "Telangana",
//                 pinCode: "500033",
//                 address: "Villa 789, Jubilee Hills, Road No. 45",
//                 listingAs: "OWNER",
//                 ownerName: "Ramesh Chandra",
//                 ownerPhone: "+91-9876543216",
//                 approvalStatus: "APPROVED",
//                 isFeatured: true,
//                 isVerified: true,
//             },
//             {
//                 title: "Affordable 2BHK in Wakad, Pune",
//                 description: "Budget-friendly 2BHK apartment with basic amenities and good connectivity to IT parks.",
//                 propertyType: "APARTMENT",
//                 status: "PUBLISHED",
//                 price: 4500000,
//                 area: 850,
//                 areaUnit: "SQFT",
//                 city: "Pune",
//                 district: "Pune",
//                 state: "Maharashtra",
//                 pinCode: "411057",
//                 address: "Flat 204, Wakad Heights, Near IT Park",
//                 listingAs: "OWNER",
//                 ownerName: "Neha Patil",
//                 ownerPhone: "+91-9876543217",
//                 approvalStatus: "APPROVED",
//                 isFeatured: false,
//                 isVerified: true,
//             },
//             {
//                 title: "Heritage Bungalow in Park Street, Kolkata",
//                 description: "Colonial-style bungalow with vintage charm, high ceilings, and prime Park Street location.",
//                 propertyType: "RESIDENTIAL",
//                 status: "PUBLISHED",
//                 price: 12000000,
//                 area: 2500,
//                 areaUnit: "SQFT",
//                 city: "Kolkata",
//                 district: "Kolkata",
//                 state: "West Bengal",
//                 pinCode: "700016",
//                 address: "Bungalow 12, Park Street, Near Metro Cinema",
//                 listingAs: "OWNER",
//                 ownerName: "Debashish Roy",
//                 ownerPhone: "+91-9876543218",
//                 approvalStatus: "APPROVED",
//                 isFeatured: true,
//                 isVerified: true,
//             },
//             {
//                 title: "Sea View Apartment in Anna Nagar, Chennai",
//                 description: "Beautiful 3BHK apartment with partial sea view, modern amenities, and excellent ventilation.",
//                 propertyType: "APARTMENT",
//                 status: "PUBLISHED",
//                 price: 9500000,
//                 area: 1350,
//                 areaUnit: "SQFT",
//                 city: "Chennai",
//                 district: "Chennai",
//                 state: "Tamil Nadu",
//                 pinCode: "600040",
//                 address: "Flat 801, Sea Breeze Apartments, Anna Nagar",
//                 listingAs: "OWNER",
//                 ownerName: "Lakshmi Krishnan",
//                 ownerPhone: "+91-9876543219",
//                 approvalStatus: "APPROVED",
//                 isFeatured: false,
//                 isVerified: true,
//             },
//             // Commercial Properties (15)
//             {
//                 title: "Premium Office Space in Cyber City, Gurgaon",
//                 description: "Grade A office space with modern infrastructure, 24/7 power backup, and metro connectivity.",
//                 propertyType: "OFFICE",
//                 status: "PUBLISHED",
//                 price: 150000,
//                 area: 2000,
//                 areaUnit: "SQFT",
//                 city: "Gurgaon",
//                 district: "Gurugram",
//                 state: "Haryana",
//                 pinCode: "122002",
//                 address: "15th Floor, Tower A, DLF Cyber City",
//                 listingAs: "AGENT",
//                 ownerName: "Corporate Leasing Solutions",
//                 ownerPhone: "+91-9876543220",
//                 approvalStatus: "APPROVED",
//                 isFeatured: true,
//                 isVerified: true,
//             },
//             {
//                 title: "Retail Shop in Connaught Place, Delhi",
//                 description: "Prime retail space in the heart of Delhi with high footfall and excellent visibility.",
//                 propertyType: "COMMERCIAL",
//                 status: "PUBLISHED",
//                 price: 8500000,
//                 area: 400,
//                 areaUnit: "SQFT",
//                 city: "Delhi",
//                 district: "Central Delhi",
//                 state: "Delhi",
//                 pinCode: "110001",
//                 address: "Shop 45, Inner Circle, Connaught Place",
//                 listingAs: "OWNER",
//                 ownerName: "Rajesh Agarwal",
//                 ownerPhone: "+91-9876543221",
//                 approvalStatus: "APPROVED",
//                 isFeatured: true,
//                 isVerified: true,
//             },
//             {
//                 title: "IT Office in Electronic City, Bangalore",
//                 description: "Modern IT office space with fiber connectivity, cafeteria, and parking facilities.",
//                 propertyType: "OFFICE",
//                 status: "PUBLISHED",
//                 price: 85000,
//                 area: 1500,
//                 areaUnit: "SQFT",
//                 city: "Bangalore",
//                 district: "Bangalore Urban",
//                 state: "Karnataka",
//                 pinCode: "560100",
//                 address: "Floor 8, Tech Tower, Electronic City Phase 1",
//                 listingAs: "AGENT",
//                 ownerName: "Bangalore IT Properties",
//                 ownerPhone: "+91-9876543222",
//                 approvalStatus: "APPROVED",
//                 isFeatured: false,
//                 isVerified: true,
//             },
//             {
//                 title: "Restaurant Space in Banjara Hills, Hyderabad",
//                 description: "Ground floor restaurant space with kitchen setup, parking, and high visibility location.",
//                 propertyType: "COMMERCIAL",
//                 status: "PUBLISHED",
//                 price: 120000,
//                 area: 1200,
//                 areaUnit: "SQFT",
//                 city: "Hyderabad",
//                 district: "Hyderabad",
//                 state: "Telangana",
//                 pinCode: "500034",
//                 address: "Ground Floor, Food Court Complex, Banjara Hills",
//                 listingAs: "OWNER",
//                 ownerName: "Suresh Kumar",
//                 ownerPhone: "+91-9876543223",
//                 approvalStatus: "APPROVED",
//                 isFeatured: false,
//                 isVerified: true,
//             },
//             {
//                 title: "Showroom in MG Road, Pune",
//                 description: "Spacious showroom with glass frontage, AC, and prime location on MG Road.",
//                 propertyType: "COMMERCIAL",
//                 status: "PUBLISHED",
//                 price: 95000,
//                 area: 800,
//                 areaUnit: "SQFT",
//                 city: "Pune",
//                 district: "Pune",
//                 state: "Maharashtra",
//                 pinCode: "411001",
//                 address: "Showroom 12, MG Road, Near Railway Station",
//                 listingAs: "OWNER",
//                 ownerName: "Mahesh Joshi",
//                 ownerPhone: "+91-9876543224",
//                 approvalStatus: "APPROVED",
//                 isFeatured: false,
//                 isVerified: true,
//             },
//             // Industrial Properties (8)
//             {
//                 title: "Manufacturing Unit in Manesar Industrial Area",
//                 description: "Large manufacturing facility with power connection, loading docks, and industrial approvals.",
//                 propertyType: "INDUSTRIAL",
//                 status: "PUBLISHED",
//                 price: 35000000,
//                 area: 15000,
//                 areaUnit: "SQFT",
//                 city: "Manesar",
//                 district: "Gurugram",
//                 state: "Haryana",
//                 pinCode: "122051",
//                 address: "Plot 45, Manesar Industrial Area, Phase 2",
//                 listingAs: "OWNER",
//                 ownerName: "Industrial Properties Ltd",
//                 ownerPhone: "+91-9876543225",
//                 approvalStatus: "APPROVED",
//                 isFeatured: true,
//                 isVerified: true,
//             },
//             {
//                 title: "Warehouse in Bhiwandi, Mumbai",
//                 description: "Logistics warehouse with high ceiling, loading bays, and excellent highway connectivity.",
//                 propertyType: "WAREHOUSE",
//                 status: "PUBLISHED",
//                 price: 180000,
//                 area: 8000,
//                 areaUnit: "SQFT",
//                 city: "Mumbai",
//                 district: "Thane",
//                 state: "Maharashtra",
//                 pinCode: "421302",
//                 address: "Warehouse 23, Bhiwandi Industrial Estate",
//                 listingAs: "AGENT",
//                 ownerName: "Logistics Hub Properties",
//                 ownerPhone: "+91-9876543226",
//                 approvalStatus: "APPROVED",
//                 isFeatured: false,
//                 isVerified: true,
//             },
//             {
//                 title: "Cold Storage Facility in Sonipat",
//                 description: "Temperature-controlled storage facility with backup power and transportation access.",
//                 propertyType: "WAREHOUSE",
//                 status: "PUBLISHED",
//                 price: 25000000,
//                 area: 12000,
//                 areaUnit: "SQFT",
//                 city: "Sonipat",
//                 district: "Sonipat",
//                 state: "Haryana",
//                 pinCode: "131001",
//                 address: "Cold Storage Complex, Industrial Area, Sonipat",
//                 listingAs: "OWNER",
//                 ownerName: "Cold Chain Solutions",
//                 ownerPhone: "+91-9876543227",
//                 approvalStatus: "APPROVED",
//                 isFeatured: true,
//                 isVerified: true,
//             },
//             // Agricultural Properties (7)
//             {
//                 title: "Fertile Agricultural Land in Faridabad",
//                 description: "Prime agricultural land with water source, fertile soil, and road connectivity.",
//                 propertyType: "AGRICULTURAL",
//                 status: "PUBLISHED",
//                 price: 2500000,
//                 area: 4,
//                 areaUnit: "ACRE",
//                 city: "Faridabad",
//                 district: "Faridabad",
//                 state: "Haryana",
//                 pinCode: "121004",
//                 address: "Village Mohna, Near NH-19",
//                 listingAs: "OWNER",
//                 ownerName: "Sunita Singh",
//                 ownerPhone: "+91-9876543228",
//                 approvalStatus: "APPROVED",
//                 isFeatured: false,
//                 isVerified: true,
//             },
//             {
//                 title: "Organic Farm Land in Nashik",
//                 description: "Certified organic farmland with drip irrigation, fruit trees, and farmhouse.",
//                 propertyType: "FARMHOUSE",
//                 status: "PUBLISHED",
//                 price: 8500000,
//                 area: 10,
//                 areaUnit: "ACRE",
//                 city: "Nashik",
//                 district: "Nashik",
//                 state: "Maharashtra",
//                 pinCode: "422003",
//                 address: "Organic Farm, Village Pimpalgaon, Nashik",
//                 listingAs: "OWNER",
//                 ownerName: "Green Valley Farms",
//                 ownerPhone: "+91-9876543229",
//                 approvalStatus: "APPROVED",
//                 isFeatured: true,
//                 isVerified: true,
//             },
//             {
//                 title: "Mango Orchard in Ramanagara",
//                 description: "Established mango orchard with 500+ trees, water bore, and caretaker quarters.",
//                 propertyType: "AGRICULTURAL",
//                 status: "PUBLISHED",
//                 price: 6500000,
//                 area: 8,
//                 areaUnit: "ACRE",
//                 city: "Ramanagara",
//                 district: "Ramanagara",
//                 state: "Karnataka",
//                 pinCode: "562159",
//                 address: "Mango Orchard, Village Kanakapura Road",
//                 listingAs: "OWNER",
//                 ownerName: "Krishnamurthy Farms",
//                 ownerPhone: "+91-9876543230",
//                 approvalStatus: "APPROVED",
//                 isFeatured: false,
//                 isVerified: true,
//             },
//         ]

//         // Add more properties to reach 50
//         const additionalProperties = [
//             // Plots and Land (remaining properties)
//             {
//                 title: "Residential Plot in Sector 150, Noida",
//                 description: "Ready to construct residential plot with all approvals and utilities available.",
//                 propertyType: "PLOT",
//                 status: "PUBLISHED",
//                 price: 4500000,
//                 area: 200,
//                 areaUnit: "SQM",
//                 city: "Noida",
//                 district: "Gautam Buddha Nagar",
//                 state: "Uttar Pradesh",
//                 pinCode: "201310",
//                 address: "Plot 456, Sector 150, Near Expressway",
//                 listingAs: "OWNER",
//                 ownerName: "Plot Developers",
//                 ownerPhone: "+91-9876543231",
//                 approvalStatus: "PENDING",
//                 isFeatured: false,
//                 isVerified: false,
//             },
//             {
//                 title: "Commercial Plot in Golf Course Extension Road",
//                 description: "Prime commercial plot suitable for office complex or retail development.",
//                 propertyType: "PLOT",
//                 status: "DRAFT",
//                 price: 15000000,
//                 area: 500,
//                 areaUnit: "SQM",
//                 city: "Gurgaon",
//                 district: "Gurugram",
//                 state: "Haryana",
//                 pinCode: "122018",
//                 address: "Plot 789, Golf Course Extension Road",
//                 listingAs: "AGENT",
//                 ownerName: "Commercial Land Developers",
//                 ownerPhone: "+91-9876543232",
//                 approvalStatus: "PENDING",
//                 isFeatured: false,
//                 isVerified: false,
//             },
//             // ... Continue with more properties to reach 50
//         ]

//         // Combine all properties
//         const allProperties = [...propertyDataArray, ...additionalProperties]

//         // Generate remaining properties to reach 50
//         const propertyTypes = ["APARTMENT", "VILLA", "OFFICE", "COMMERCIAL", "PLOT", "WAREHOUSE"]
//         const cities = Object.keys(cityCoordinates)
//         const states = {
//             Delhi: "Delhi",
//             Gurgaon: "Haryana",
//             Noida: "Uttar Pradesh",
//             Faridabad: "Haryana",
//             Mumbai: "Maharashtra",
//             Pune: "Maharashtra",
//             Bangalore: "Karnataka",
//             Chennai: "Tamil Nadu",
//             Hyderabad: "Telangana",
//             Kolkata: "West Bengal",
//         }

//         while (allProperties.length < 50) {
//             const city = cities[Math.floor(Math.random() * cities.length)]
//             const propertyType = propertyTypes[Math.floor(Math.random() * propertyTypes.length)]
//             const price = Math.floor(Math.random() * 20000000) + 1000000
//             const area = Math.floor(Math.random() * 3000) + 500

//             allProperties.push({
//                 title: `${propertyType.toLowerCase()} Property in ${city}`,
//                 description: `Well-located ${propertyType.toLowerCase()} property with modern amenities and good connectivity.`,
//                 propertyType: propertyType as any,
//                 status: Math.random() > 0.3 ? "PUBLISHED" : "DRAFT",
//                 price: price,
//                 area: area,
//                 areaUnit: "SQFT",

//                 city: city,
//                 district: city,
//                 state: states[city],
//                 pinCode: `${Math.floor(Math.random() * 900000) + 100000}`,
//                 address: `Property Address in ${city}`,
//                 listingAs: Math.random() > 0.5 ? "OWNER" : "AGENT",
//                 ownerName: `Owner ${allProperties.length + 1}`,
//                 ownerPhone: `+91-98765432${String(allProperties.length).padStart(2, "0")}`,
//                 approvalStatus: Math.random() > 0.2 ? "APPROVED" : "PENDING",
//                 isFeatured: Math.random() > 0.8,
//                 isVerified: Math.random() > 0.3,
//             })
//         }

//         // Insert all properties
//         const insertedProperties: typeof properties.$inferSelect[] = []

//         for (let i = 0; i < allProperties.length; i++) {
//             const data = allProperties[i]
//             const coord = getRandomCoordinate(data.city)

//             console.log(`Creating property ${i + 1}/50: ${data.title}`)

//             // Prepare property data
//             const propertyData = {
//                 title: data.title,
//                 description: data.description,
//                 propertyType: data.propertyType as
//                     | "VILLA"
//                     | "APARTMENT"
//                     | "RESIDENTIAL"
//                     | "OFFICE"
//                     | "COMMERCIAL"
//                     | "INDUSTRIAL"
//                     | "WAREHOUSE"
//                     | "AGRICULTURAL"
//                     | "FARMHOUSE"
//                     | "PLOT"
//                     | "OTHER",
//                 status: data.status as "PUBLISHED" | "DRAFT",
//                 price: data.price,
//                 pricePerUnit: data.price / data.area,
//                 area: data.area,
//                 areaUnit: data.areaUnit as
//                     | "SQFT"
//                     | "ACRE"
//                     | "SQM"
//                     | "HECTARE"
//                     | "BIGHA"
//                     | "KATHA"
//                     | "MARLA"
//                     | "KANAL"
//                     | "GUNTA"
//                     | "CENT",
//                 khasraNumber: `KH-2024-${String(i + 1).padStart(3, "0")}`,
//                 murabbaNumber: `MB-${data.city.substring(0, 3).toUpperCase()}-${i + 1}`,
//                 khewatNumber: `KW-${data.state.substring(0, 3).toUpperCase()}-2024-${i + 1}`,
//                 address: data.address,
//                 city: data.city,
//                 district: data.district,
//                 state: data.state,
//                 loaction: "INDia",
//                 country: "India",
//                 pinCode: data.pinCode,
//                 latLng: `POINT(${coord.lng} ${coord.lat})`,
//                 geoJson: {
//                     type: "Polygon",
//                     coordinates: [
//                         [
//                             [coord.lng, coord.lat],
//                             [coord.lng + 0.001, coord.lat],
//                             [coord.lng + 0.001, coord.lat + 0.001],
//                             [coord.lng, coord.lat + 0.001],
//                             [coord.lng, coord.lat],
//                         ],
//                     ],
//                 },
//                 calculatedArea: data.area,
//                 createdByType: (Math.random() > 0.8 ? "ADMIN" : "USER") as "ADMIN" | "USER",
//                 images: [
//                     { url: `/images/property${i + 1}-main.jpg`, type: "main" },
//                     { url: `/images/property${i + 1}-interior.jpg`, type: "interior" },
//                 ],
//                 listingAs: data.listingAs as "OWNER" | "AGENT",
//                 ownerName: data.ownerName,
//                 ownerPhone: data.ownerPhone,
//                 ownerWhatsapp: data.ownerPhone,
//                 isFeatured: data.isFeatured,
//                 isVerified: data.isVerified,
//                 isActive: true,
//                 viewCount: Math.floor(Math.random() * 2000),
//                 inquiryCount: Math.floor(Math.random() * 50),

//                 approvalStatus: data.approvalStatus as "APPROVED" | "PENDING" | "FLAGGED",
//                 approvalMessage: data.approvalStatus === "APPROVED" ? "Property approved for listing" : null,
//                 approvedBy: data.approvalStatus === "APPROVED" ? admins[Math.floor(Math.random() * admins.length)].id : null,
//                 approvedAt: data.approvalStatus === "APPROVED" ? new Date() : null,
//                 publishedAt: data.status === "PUBLISHED" ? new Date() : null,
//                 adminNotes: `Property ${i + 1} - ${data.propertyType} in ${data.city}`,
//                 lastReviewedBy: admins[Math.floor(Math.random() * admins.length)].id,
//                 lastReviewedAt: new Date(),
//             }

//             // Insert property
//             const [property] = await db.insert(properties).values(propertyData).returning()
//             insertedProperties.push(property)

//             // Insert SEO data
//             const slug = data.title
//                 .toLowerCase()
//                 .replace(/[^a-z0-9\s]/g, "")
//                 .replace(/\s+/g, "-")
//                 .substring(0, 50)

//             await db.insert(propertySeo).values({
//                 propertyId: property.id,
//                 slug: `${slug}-${i + 1}`,
//                 seoTitle: `${data.title} | Property for Sale/Rent`,
//                 seoDescription: `${data.description.substring(0, 150)}...`,
//                 seoKeywords: `${data.propertyType.toLowerCase()}, ${data.city.toLowerCase()}, property, real estate`,
//             })

//             // Insert verification data
//             await db.insert(propertyVerification).values({
//                 propertyId: property.id,
//                 isVerified: data.isVerified,
//                 verificationMessage: data.isVerified ? "Property verified successfully" : "Verification pending",
//                 verificationNotes: `Verification notes for property ${i + 1}`,
//                 verifiedBy: data.isVerified ? admins[Math.floor(Math.random() * admins.length)].id : null,
//                 verifiedAt: new Date(),
//             })

//             // Insert property images
//             const imageData = propertyData.images.map((img, index) => ({
//                 propertyId: property.id,
//                 imageUrl: img.url,
//                 imageType: img.type,
//                 altText: `${data.title} - ${img.type}`,
//                 sortOrder: index,
//                 isMain: index === 0,
//             }))
//             await db.insert(propertyImages).values(imageData)

//             // Insert sample views
//             const viewsCount = Math.floor(Math.random() * 10) + 1
//             const viewsData = Array.from({ length: viewsCount }, (_, j) => ({
//                 propertyId: property.id,
//                 ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
//                 userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
//                 sessionId: `session_${Date.now()}_${j}`,
//                 viewDuration: String(Math.floor(Math.random() * 300) + 30),
//                 viewedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
//             }))
//             // await db.insert(propertyViews).values(viewsData)

//             // Insert price history for some properties
//             if (Math.random() > 0.6) {
//                 await db.insert(propertyPriceHistory).values({
//                     propertyId: property.id,
//                     oldPrice: data.price * 0.95,
//                     newPrice: data.price,
//                     changeReason: "Market adjustment",

//                     createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
//                 })
//             }
//         }

//         console.log(`🎉 Successfully seeded ${insertedProperties.length} properties!`)
//         console.log("\n📊 Property Summary:")
//         console.log(`- Published Properties: ${insertedProperties.filter((p) => p.status === "PUBLISHED").length}`)
//         console.log(`- Draft Properties: ${insertedProperties.filter((p) => p.status === "DRAFT").length}`)
//         console.log(`- Approved Properties: ${insertedProperties.filter((p) => p.approvalStatus === "APPROVED").length}`)
//         console.log(`- Pending Properties: ${insertedProperties.filter((p) => p.approvalStatus === "PENDING").length}`)
//         console.log(`- Verified Properties: ${insertedProperties.filter((p) => p.isVerified).length}`)
//         console.log(`- Featured Properties: ${insertedProperties.filter((p) => p.isFeatured).length}`)

//         // Property type breakdown
//         const typeBreakdown = {}
//         insertedProperties.forEach((p) => {
//             typeBreakdown[p.propertyType] = (typeBreakdown[p.propertyType] || 0) + 1
//         })
//         console.log("\n🏠 Property Type Breakdown:")
//         Object.entries(typeBreakdown).forEach(([type, count]) => {
//             console.log(`- ${type}: ${count}`)
//         })
//     } catch (error) {
//         console.error("❌ Property seeding failed:", error)
//         throw error
//     }
// }

// // Run the seeding
// seedProperties()
//     .then(() => {
//         console.log("✅ 50 Properties seeding completed successfully!")
//         process.exit(0)
//     })
//     .catch((error) => {
//         console.error("❌ Property seeding failed:", error)
//         process.exit(1)
//     })
