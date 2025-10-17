export const reportDefs = `#graphql
  # Custom Scalar
  scalar JSON

  type reports {
    data : [JSON]
  }

  input reportsInput {
    fromDate: String!
    toDate: String!
    reportId: Int!
    users: [String]
  }

  type ReportUser {
    id : ID!
    first_name : String
    last_name : String
    role : String
  }


    type Query {
    getReportById(input: reportsInput!): reports!
    getAllUsers: [ReportUser]!
  }
  `