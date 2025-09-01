

export const mapPropertiesTypeDefs = `#graphql
 type MapCoordinate {
    lat: Float!
    lng: Float!
  }
  

type PropertyImageVariants {

  medium: String
 
}
  type PropertyImage {

  variants: PropertyImageVariants
  
}
  # Map-specific property type optimized for rendering
  type MapProperty {
    id: ID!
  
    price: Float!
    areaUnit: AreaUnit!
    images: [PropertyImage!]!
    description: String
   area: String
    daysOnMarket: Int
    status: String!
    location: JSON
    khasraNumber: String
    khewatNumber: String
    saleBy: String!
    isVerified: Boolean!
    boundaries: JSON
    listingType: String
    ownerName: String
    propertyType: String
    slug: String
    saved: Boolean
   
  }



  extend type Query {
    # Get all properties for map (optimized for speed)
    mapProperties: [MapProperty!]!

  }
`
