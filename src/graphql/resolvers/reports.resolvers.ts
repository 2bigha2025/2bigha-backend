import { GraphQLError } from "graphql"
import { SavedPropertiesService } from '../services/saved-properties.service'
import { requirePlatformUser } from '../../utils/auth-helpers'
import { PropertyService } from "../services/property.services";
import GraphQLJSON from "graphql-type-json/lib";
import { getReportByIds, getUsers } from "../services/reports.service";

interface Context {
    user?: {
        userId: string
        email: string
        role: string
    }
    admin?: any
}

export const reportsResolvers = {
    JSON : GraphQLJSON,
    Query: {
      getReportById: async (
        _: any,
        { input }: { input: { fromDate: string; toDate: string,reportId : number,users : [] } }
      ) => {
        const { fromDate, toDate,reportId,users } = input;
        return {
            data: getReportByIds(reportId,users,fromDate,toDate)
          };
          
      },


      getAllUsers: async (
        _: any,
      ) => {
        const users = await getUsers();
        return users;
      },

  },
}