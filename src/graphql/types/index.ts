import { mergeTypeDefs } from '@graphql-tools/merge';
import { authTypeDefs } from './auth.types';
import { propertyTypeDefs } from './property.types';
import { rbacTypeDefs } from './rbac.types';
import { propertyApprovalEnhancedTypeDefs } from './property-approval.types';
import { mapPropertiesTypeDefs } from './map-properties.types';
import { adminDashboardTypeDefs } from './admin-dashboard.types';
import { blogTypeDefs } from './blog.types';
import { seoTypeDefs } from './seo.types';
import { userPropertyTypeDefs } from './save-user-property.types';
import { geoJsonTypeDefs } from './geoJson.types';
import { reportDefs } from './reports.types';
import { crmTypeDefs } from './crm.types';
import { ivrTypeDefs } from './ivr.types';
import { crmWhatsAppTypeDefs } from './crm-whatsapp-types';

export const typeDefs = mergeTypeDefs([crmWhatsAppTypeDefs,ivrTypeDefs,userPropertyTypeDefs, authTypeDefs, propertyTypeDefs, rbacTypeDefs, propertyApprovalEnhancedTypeDefs, adminDashboardTypeDefs, mapPropertiesTypeDefs, blogTypeDefs, seoTypeDefs, geoJsonTypeDefs,reportDefs,crmTypeDefs]);

