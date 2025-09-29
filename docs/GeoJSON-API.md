# GeoJSON API Documentation

This document outlines all available GraphQL queries and mutations for the GeoJSON feature in the 2Bigha backend.

## Queries

### 1. Get All Collections
Retrieves a list of all GeoJSON collections.

```graphql
query GetAllCollections {
  listGeoJsonCollections {
    id
    name
    description
    data
    createdAt
    updatedAt
    features {
      id
      type
    }
  }
}
```

### 2. Get Single Collection
Retrieves a specific collection by ID.

```graphql
query GetCollection($id: ID!) {
  getGeoJsonCollection(id: $id) {
    id
    name
    description
    data
    createdAt
    updatedAt
    features {
      id
      type
      properties
      geometry
      isEnabled
    }
  }
}
```

### 3. Get All Features in a Collection
Retrieves all features belonging to a specific collection.

```graphql
query GetFeaturesByCollection($collectionId: ID!) {
  listGeoJsonFeatures(collectionId: $collectionId) {
    id
    type
    properties
    geometry
    bounds
    isEnabled
    createdAt
    updatedAt
  }
}
```

### 4. Get Single Feature
Retrieves a specific feature by ID.

```graphql
query GetFeature($id: ID!) {
  getGeoJsonFeature(id: $id) {
    id
    collectionId
    type
    properties
    geometry
    bounds
    isEnabled
    createdAt
    updatedAt
    collection {
      name
    }
  }
}
```

### 5. Find Features Within Radius
Finds all features within a specified radius from a point.

```graphql
query FindNearbyFeatures($lat: Float!, $lng: Float!, $radiusKm: Float!) {
  findGeoJsonFeaturesWithinRadius(lat: $lat, lng: $lng, radiusKm: $radiusKm) {
    id
    type
    properties
    geometry
    isEnabled
  }
}
```

## Mutations

### 1. Upload GeoJSON File
Upload a GeoJSON file and create a new collection.

```graphql
mutation UploadGeoJson($file: Upload!, $name: String!, $description: String) {
  uploadGeoJsonFile(file: $file, collectionName: $name, description: $description) {
    success
    collection {
      id
      name
      description
    }
    featuresCount
    error
  }
}
```

### 2. Create Collection
Create a new empty GeoJSON collection.

```graphql
mutation CreateCollection($input: GeoJsonCollectionInput!) {
  createGeoJsonCollection(input: $input) {
    id
    name
    description
    createdAt
  }
}
```

### 3. Update Collection
Update an existing collection's details.

```graphql
mutation UpdateCollection($id: ID!, $input: GeoJsonCollectionInput!) {
  updateGeoJsonCollection(id: $id, input: $input) {
    id
    name
    description
    updatedAt
  }
}
```

### 4. Delete Collection
Delete a collection and all its features.

```graphql
mutation DeleteCollection($id: ID!) {
  deleteGeoJsonCollection(id: $id)
}
```

### 5. Create Feature
Add a new feature to a collection.

```graphql
mutation CreateFeature($input: GeoJsonFeatureInput!) {
  createGeoJsonFeature(input: $input) {
    id
    type
    properties
    geometry
    bounds
    isEnabled
  }
}
```

### 6. Update Feature
Update an existing feature.

```graphql
mutation UpdateFeature($id: ID!, $input: GeoJsonFeatureInput!) {
  updateGeoJsonFeature(id: $id, input: $input) {
    id
    type
    properties
    geometry
    bounds
    isEnabled
    updatedAt
  }
}
```

### 7. Delete Feature
Delete a feature from a collection.

```graphql
mutation DeleteFeature($id: ID!) {
  deleteGeoJsonFeature(id: $id)
}
```

### 8. Bulk Create Features
Create multiple features at once.

```graphql
mutation BulkCreateFeatures($input: [GeoJsonFeatureInput!]!) {
  bulkCreateGeoJsonFeatures(input: $input) {
    id
    type
    properties
    geometry
  }
}
```

### 9. Import GeoJSON Data
Import GeoJSON data into an existing collection.

```graphql
mutation ImportGeoJson($collectionId: ID!, $data: String!) {
  importGeoJsonData(collectionId: $collectionId, geoJsonData: $data) {
    id
    type
    properties
    geometry
  }
}
```

### 10. Update All Features in Collection
Update all features in a collection at once.

```graphql
mutation UpdateAllFeatures($collectionId: ID!, $input: UpdateAllFeaturesInput!) {
  updateAllCollectionFeatures(collectionId: $collectionId, input: $input) {
    success
    message
    featuresCount
  }
}
```

### 11. Toggle Feature Status
Enable or disable a feature.

```graphql
mutation ToggleFeature($id: ID!) {
  toggleFeatureStatus(id: $id) {
    success
    feature {
      id
      isEnabled
    }
    error
  }
}
```

## Input Types

### GeoJsonCollectionInput
```graphql
input GeoJsonCollectionInput {
  name: String!
  description: String
  data: String!
}
```

### GeoJsonFeatureInput
```graphql
input GeoJsonFeatureInput {
  collectionId: ID!
  type: String!
  properties: JSON!
  geometry: JSON!
  bounds: JSON
  isEnabled: Boolean
}
```

### UpdateAllFeaturesInput
```graphql
input UpdateAllFeaturesInput {
  properties: JSON
  geometry: JSON
  type: String
  isEnabled: Boolean
}
```

## Response Types

### UploadGeoJsonResponse
```graphql
type UploadGeoJsonResponse {
  success: Boolean!
  collection: GeoJsonCollection
  featuresCount: Int
  error: String
}
```

### UpdateFeaturesResponse
```graphql
type UpdateFeaturesResponse {
  success: Boolean!
  message: String!
  featuresCount: Int!
}
```

### ToggleFeatureResponse
```graphql
type ToggleFeatureResponse {
  success: Boolean!
  feature: GeoJsonFeature
  error: String
}
```

## Example Usage

### Creating and Uploading Data

1. First, create a collection:
```javascript
const CREATE_COLLECTION = gql`
  mutation CreateCollection($input: GeoJsonCollectionInput!) {
    createGeoJsonCollection(input: $input) {
      id
      name
    }
  }
`;

// Usage
const result = await client.mutate({
  mutation: CREATE_COLLECTION,
  variables: {
    input: {
      name: "My Collection",
      description: "Contains property boundaries",
      data: "[]"
    }
  }
});
```

2. Upload a GeoJSON file:
```javascript
const UPLOAD_GEOJSON = gql`
  mutation UploadGeoJson($file: Upload!, $name: String!) {
    uploadGeoJsonFile(file: $file, collectionName: $name) {
      success
      collection {
        id
        name
      }
      featuresCount
    }
  }
`;

// Usage with file input
const file = event.target.files[0];
const result = await client.mutate({
  mutation: UPLOAD_GEOJSON,
  variables: {
    file,
    name: "Uploaded Collection"
  }
});
```

3. Query features in a radius:
```javascript
const GET_NEARBY = gql`
  query GetNearby($lat: Float!, $lng: Float!, $radius: Float!) {
    findGeoJsonFeaturesWithinRadius(lat: $lat, lng: $lng, radiusKm: $radius) {
      id
      type
      properties
      geometry
    }
  }
`;

// Usage
const result = await client.query({
  query: GET_NEARBY,
  variables: {
    lat: 28.7041,
    lng: 77.1025,
    radius: 5
  }
});
```
