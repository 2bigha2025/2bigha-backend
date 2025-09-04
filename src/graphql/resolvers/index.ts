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

export const resolvers: any = mergeResolvers([adminAuthResolvers, propertyResolvers, rbacResolvers, propertyApprovalResolvers, adminDashboardResolvers, mapPropertiesResolvers, blogResolvers,seoResolvers,savedPropertiesResolvers]);

