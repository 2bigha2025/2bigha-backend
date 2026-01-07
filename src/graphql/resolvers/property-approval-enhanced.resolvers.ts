import { db } from "../../config/database";
import { eq } from "drizzle-orm";
import * as schema from "../../database/schema/index";
import { logInfo, logError } from "../../utils/logger";
import { PropertyApprovalService } from "../services/property-approval.service";
import { propertyNotificationService } from "../services/property-notification.service";
import { Context } from "./property.resolvers";
import { AdminContext } from "./auth.resolvers";

const { adminUsers, properties } = schema;

export const propertyApprovalResolvers = {
    Query: {
        // Get properties pending approval with enhanced data

        // Get property approval statistics
        // propertyApprovalStatistics: async () => {
        //     try {
        //         // const stats = await PropertyApprovalService.getApprovalStatistics()
        //         // return {
        //         //     approval: stats.approval.map((item: any) => ({
        //         //         status: item.status.toUpperCase(),
        //         //         count: item.count,
        //         //     })),
        //         //     verification: stats.verification.map((item: any) => ({
        //         //         status: item.status.toUpperCase(),
        //         //         count: item.count,
        //         //     })),
        //         // }
        //     } catch (error) {
        //         logError("Failed to fetch approval statistics", error as Error);
        //         throw new Error("Failed to fetch statistics");
        //     }
        // },
    },

    Mutation: {
        // Enhanced approve property with notifications
        approveProperty: async (_: any, { input }: any, context: AdminContext) => {
            const { propertyId, adminUserId, message, adminNotes, reason } = input;
            const adminId = context.admin?.adminId;

            if (!adminId) {
                throw new Error("Admin authentication required");
            }

            try {
                // Approve property
                const property = await PropertyApprovalService.approveProperty({
                    propertyId,
                    adminId,
                    adminUserId,
                    message,
                    adminNotes,
                    reason,
                    ipAddress: context.req?.ip,
                    userAgent: context.req?.get("User-Agent"),
                });

                // Get admin details for notification
                const [admin] = await db
                    .select()
                    .from(adminUsers)
                    .where(eq(adminUsers.id, adminId.toString()));

                logInfo("Property approved with notifications", {
                    propertyId,
                    adminId,
                });

                return {
                    ...property,
                };
            } catch (error) {
                logError(
                    "Failed to approve property with notifications",
                    error as Error,
                    { propertyId, adminId }
                );
                throw new Error("Failed to approve property");
            }
        },

        // Enhanced reject property with notifications
        rejectProperty: async (_: any, { input }: any, context: AdminContext) => {
            const { propertyId, message, adminNotes, reason } = input;
            const adminId = context.admin?.adminId;

            if (!adminId) {
                throw new Error("Admin authentication required");
            }

            try {
                // Reject property
                const property = await PropertyApprovalService.rejectProperty({
                    propertyId: propertyId,
                    adminId: adminId,
                    message,
                    adminNotes,
                    reason,
                    ipAddress: context.req?.ip,
                    userAgent: context.req?.get("User-Agent"),
                });

                logInfo("Property rejected with notifications", {
                    propertyId,
                    adminId,
                });

                console.log("Property after rejection:", property);


                return {
                    ...property,
                };
            } catch (error) {
                console.log(error)
                // logError(
                //     "Failed to reject property with notifications",
                //     error as Error,
                //     { propertyId, adminId }
                // );
                throw new Error("Failed to reject property");
            }
        },

        // Enhanced verify property with notifications
        verifyProperty: async (_: any, { input }: any, context: AdminContext) => {
            const { propertyId, message, adminNotes, reason } = input;
            const adminId = context.admin?.adminId;

            if (!adminId) {
                throw new Error("Admin authentication required");
            }

            try {
                // Verify property
                const property = await PropertyApprovalService.verifyProperty({
                    propertyId,
                    adminId: adminId,
                    message,
                    adminNotes,
                    reason,
                    ipAddress: context.req?.ip,
                    userAgent: context.req?.get("User-Agent"),
                });

                //     // Get admin details for notification
                //     const [admin] = await db
                //         .select()
                //         .from(adminUsers)
                //         .where(eq(adminUsers.id, Number.parseInt(adminId)))

                //     // Send notifications
                //     const notificationResult = await propertyNotificationService.sendPropertyStatusNotification({
                //         property: {
                //             id: property.id.toString(),
                //             title: property.title,
                //             ownerName: property.ownerName || "Property Owner",
                //             ownerEmail: property.ownerEmail || `owner${property.id}@example.com`,
                //             ownerPhone: property.ownerPhone || `+91-9876543210`,
                //             price: property.price,
                //             address: property.address,
                //             city: property.city,
                //             state: property.state,
                //         },
                //         action: "VERIFY",
                //         message: message || "Your property has been verified and marked as authentic.",
                //         adminName: admin ? `${admin.firstName} ${admin.lastName}` : "Admin Team",
                //         reviewDate: new Date().toLocaleDateString("en-IN"),
                //     })

                //     logInfo("Property verified with notifications", {
                //         propertyId,
                //         adminId,
                //         emailSent: notificationResult.emailSent,
                //         smsSent: notificationResult.smsSent,
                //         errors: notificationResult.errors,
                //     })

                return {
                    ...property,
                };
            } catch (error) {
                logError(
                    "Failed to verify property with notifications",
                    error as Error,
                    { propertyId, adminId }
                );
                throw new Error("Failed to verify property");
            }
        },

        // // Enhanced flag property with notifications
        // flagProperty: async (_: any, { input }: any, context: any) => {
        //     const { propertyId, message, adminNotes, reason } = input;
        //     const adminId = context.user?.id;

        //     if (!adminId) {
        //         throw new Error("Admin authentication required");
        //     }

        //     // try {
        //     //     // Flag property
        //     //     const property = await PropertyApprovalService.flagProperty({
        //     //         propertyId: Number.parseInt(propertyId),
        //     //         adminId: Number.parseInt(adminId),
        //     //         message,
        //     //         adminNotes,
        //     //         reason,
        //     //         ipAddress: context.req?.ip,
        //     //         userAgent: context.req?.get("User-Agent"),
        //     //     })

        //     //     // Get admin details for notification
        //     //     const [admin] = await db
        //     //         .select()
        //     //         .from(adminUsers)
        //     //         .where(eq(adminUsers.id, Number.parseInt(adminId)))

        //     //     // Send notifications
        //     //     const notificationResult = await propertyNotificationService.sendPropertyStatusNotification({
        //     //         property: {
        //     //             id: property.id.toString(),
        //     //             title: property.title,
        //     //             ownerName: property.ownerName || "Property Owner",
        //     //             ownerEmail: property.ownerEmail || `owner${property.id}@example.com`,
        //     //             ownerPhone: property.ownerPhone || `+91-9876543210`,
        //     //             price: property.price,
        //     //             address: property.address,
        //     //             city: property.city,
        //     //             state: property.state,
        //     //         },
        //     //         action: "FLAG",
        //     //         message: message || "Your property has been flagged for review due to policy concerns.",
        //     //         adminName: admin ? `${admin.firstName} ${admin.lastName}` : "Admin Team",
        //     //         reviewDate: new Date().toLocaleDateString("en-IN"),
        //     //         reason,
        //     //     })

        //     //     logInfo("Property flagged with notifications", {
        //     //         propertyId,
        //     //         adminId,
        //     //         emailSent: notificationResult.emailSent,
        //     //         smsSent: notificationResult.smsSent,
        //     //         errors: notificationResult.errors,
        //     //     })

        //     //     return {
        //     //         ...property,
        //     //         id: property.id.toString(),
        //     //         propertyType: property.propertyType.toUpperCase(),
        //     //         listingType: property.listingType.toUpperCase(),
        //     //         status: property.status.toUpperCase(),
        //     //         approvalStatus: property.approvalStatus.toUpperCase(),
        //     //         verificationStatus: property.verificationStatus.toUpperCase(),
        //     //         createdAt: property.createdAt.toISOString(),
        //     //         updatedAt: property.updatedAt.toISOString(),
        //     //         notificationResult,
        //     //     }
        //     // } catch (error) {
        //     //     logError("Failed to flag property with notifications", error as Error, { propertyId, adminId })
        //     //     throw new Error("Failed to flag property")
        //     // }
        // },

        // Bulk property actions with notifications
        // bulkPropertyActions: async (_: any, { input }: any, context: any) => {
        //     const { propertyIds, action, message, adminNotes, reason } = input;
        //     const adminId = context.user?.id;

        //     // if (!adminId) {
        //     //     throw new Error("Admin authentication required")
        //     // }

        //     // try {
        //     //     const results = []
        //     //     const notifications = []

        //     //     // Get admin details
        //     //     const [admin] = await db
        //     //         .select()
        //     //         .from(adminUsers)
        //     //         .where(eq(adminUsers.id, Number.parseInt(adminId)))

        //     //     for (const propertyId of propertyIds) {
        //     //         try {
        //     //             let property

        //     //             // Perform the action based on type
        //     //             switch (action) {
        //     //                 case "APPROVE":
        //     //                     property = await PropertyApprovalService.approveProperty({
        //     //                         propertyId: Number.parseInt(propertyId),
        //     //                         adminId: Number.parseInt(adminId),
        //     //                         message,
        //     //                         adminNotes,
        //     //                         reason,
        //     //                         ipAddress: context.req?.ip,
        //     //                         userAgent: context.req?.get("User-Agent"),
        //     //                     })
        //     //                     break
        //     //                 case "REJECT":
        //     //                     property = await PropertyApprovalService.rejectProperty({
        //     //                         propertyId: Number.parseInt(propertyId),
        //     //                         adminId: Number.parseInt(adminId),
        //     //                         message,
        //     //                         adminNotes,
        //     //                         reason,
        //     //                         ipAddress: context.req?.ip,
        //     //                         userAgent: context.req?.get("User-Agent"),
        //     //                     })
        //     //                     break
        //     //                 case "VERIFY":
        //     //                     property = await PropertyApprovalService.verifyProperty({
        //     //                         propertyId: Number.parseInt(propertyId),
        //     //                         adminId: Number.parseInt(adminId),
        //     //                         message,
        //     //                         adminNotes,
        //     //                         reason,
        //     //                         ipAddress: context.req?.ip,
        //     //                         userAgent: context.req?.get("User-Agent"),
        //     //                     })
        //     //                     break
        //     //                 case "FLAG":
        //     //                     property = await PropertyApprovalService.flagProperty({
        //     //                         propertyId: Number.parseInt(propertyId),
        //     //                         adminId: Number.parseInt(adminId),
        //     //                         message,
        //     //                         adminNotes,
        //     //                         reason,
        //     //                         ipAddress: context.req?.ip,
        //     //                         userAgent: context.req?.get("User-Agent"),
        //     //                     })
        //     //                     break
        //     //                 default:
        //     //                     throw new Error(`Invalid action: ${action}`)
        //     //             }

        //     //             results.push({
        //     //                 propertyId,
        //     //                 success: true,
        //     //                 property: {
        //     //                     ...property,
        //     //                     id: property.id.toString(),
        //     //                     propertyType: property.propertyType.toUpperCase(),
        //     //                     listingType: property.listingType.toUpperCase(),
        //     //                     status: property.status.toUpperCase(),
        //     //                     approvalStatus: property.approvalStatus.toUpperCase(),
        //     //                     verificationStatus: property.verificationStatus.toUpperCase(),
        //     //                     createdAt: property.createdAt.toISOString(),
        //     //                     updatedAt: property.updatedAt.toISOString(),
        //     //                 },
        //     //             })

        //     //             // Prepare notification data
        //     //             notifications.push({
        //     //                 property: {
        //     //                     id: property.id.toString(),
        //     //                     title: property.title,
        //     //                     ownerName: property.ownerName || "Property Owner",
        //     //                     ownerEmail: property.ownerEmail || `owner${property.id}@example.com`,
        //     //                     ownerPhone: property.ownerPhone || `+91-9876543210`,
        //     //                     price: property.price,
        //     //                     address: property.address,
        //     //                     city: property.city,
        //     //                     state: property.state,
        //     //                 },
        //     //                 action: action as "APPROVE" | "REJECT" | "VERIFY" | "FLAG",
        //     //                 message: message || `Your property has been ${action.toLowerCase()}d.`,
        //     //                 adminName: admin ? `${admin.firstName} ${admin.lastName}` : "Admin Team",
        //     //                 reviewDate: new Date().toLocaleDateString("en-IN"),
        //     //                 reason,
        //     //             })
        //     //         } catch (error) {
        //     //             results.push({
        //     //                 propertyId,
        //     //                 success: false,
        //     //                 error: (error as Error).message,
        //     //             })
        //     //         }
        //     //     }

        //     //     // Send bulk notifications
        //     //     const notificationResults = await propertyNotificationService.sendBulkPropertyNotifications(notifications)

        //     //     logInfo("Bulk property actions completed", {
        //     //         totalProperties: propertyIds.length,
        //     //         successfulActions: results.filter((r) => r.success).length,
        //     //         failedActions: results.filter((r) => !r.success).length,
        //     //         notificationResults,
        //     //     })

        //     //     return {
        //     //         results,
        //     //         notificationResults,
        //     //         summary: {
        //     //             total: propertyIds.length,
        //     //             successful: results.filter((r) => r.success).length,
        //     //             failed: results.filter((r) => !r.success).length,
        //     //             emailsSent: notificationResults.emailsSent,
        //     //             smsSent: notificationResults.smsSent,
        //     //         },
        //     //     }
        //     // } catch (error) {
        //     //     logError("Failed to perform bulk property actions", error as Error, { propertyIds, action, adminId })
        //     //     throw new Error("Failed to perform bulk actions")
        //     // }
        // },
    },
};
