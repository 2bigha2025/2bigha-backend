export const mapPropertiesTypeDefs = `#graphql
 type MapCoordinate {
    lat: Float!
    lng: Float!
  }
  

type PropertyImageVariants {

  medium: String
 
}

  type Location {
    name: String
    address: String
    placeId: String
    coordinates: MapCoordinate
  }
  type PropertyImage {

  variants: PropertyImageVariants
  
}
  # Map-specific property type optimized for rendering
  type MapProperty {
    id: ID!
    listingId: Int
    price: Float!
    areaUnit: AreaUnit!
    images: [PropertyImage!]!
    description: String
    area: String
    daysOnMarket: Int
    status: String!
    location: Location
    khasraNumber: String
    khewatNumber: String
    saleBy: String!
    isVerified: Boolean!
    boundaries: JSON
    createdAt: String
    updatedAt : Date
    listingType: String
    ownerName: String
    propertyType: String
    slug: String
    saved: Boolean
    seo : Seo
   
  }



  extend type Query {
    # Get all properties for map (optimized for speed)
    mapProperties: [MapProperty!]!
  }
`;
