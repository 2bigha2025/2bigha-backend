import { mergeResolvers } from '@graphql-tools/merge';
import { adminAuthResolvers } from './auth.resolvers';
import { propertyResolvers } from './property.resolvers';
import { rbacResolvers } from './rbac.resolvers';
import { propertyApprovalResolvers } from './property-approval-enhanced.resolvers';
import { adminDashboardResolvers } from './admin-dashboard.resolvers';
import { blogResolvers } from './blog.resolvers';
import { mapPropertiesResolvers } from './map-properties.resolvers';
import { seoResolvers } from './seo.resolvers';
import { savedPropertiesResolvers } from './saved-properties.resolvers';
import { geoJsonResolvers } from './geo-json.resolvers';
import { reportsResolvers } from './reports.resolvers';
import { crmResolver } from './crm.resolver';
import { ivrResolvers } from './ivr.resolvers';
import { PropertyManagementResolver } from './property-management.resolvers';
import { crmWhatsAppResolver } from './crm-whatsapp.resolver';
import { farmResolvers } from './farm.resolver';


export const resolvers: any = mergeResolvers([crmWhatsAppResolver,ivrResolvers,adminAuthResolvers, propertyResolvers, rbacResolvers, propertyApprovalResolvers, adminDashboardResolvers, mapPropertiesResolvers, blogResolvers, seoResolvers, savedPropertiesResolvers, geoJsonResolvers,reportsResolvers,crmResolver,farmResolvers]);

