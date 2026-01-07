import { eq, desc, and } from "drizzle-orm";
import { db } from "../../config/database";
import * as schema from "../../database/schema/index";
import { logger } from "../../utils/logger";
import { propertyNotificationService } from "./property-notification.service";
import { PlatformUserService } from "../../user/user.services";
import { AdminAuthService } from "./auth.service";
import { PropertyManagementService } from './property-management.service';
const {
    properties,
    propertyApprovalHistory,
    propertyApprovalNotifications,
    adminUsers,
} = schema;

export interface ApprovalActionInput {
    propertyId: string;
    adminId: string;
    message?: string;
    adminNotes?: string;
    reason?: string;
    ipAddress?: string;
    userAgent?: string;
    adminUserId?: string;
    availablilityStatus?: "AVAILABLE" | "SOLD";
}

export class PropertyApprovalService {
    private static async notifyUser(property: any, userId: string, action: "APPROVE" | "REJECT" | "VERIFY" | "UNVERIFY" | "FLAG", message: string, reason?: string) {
        const user = await PlatformUserService.findUserById(userId);
        if (!user) throw new Error("User not found");

        await propertyNotificationService.sendPropertyStatusNotification({
            property: {
                id: property.id.toString(),
                title: property.title,
                ownerName: user.firstName || "Property Owner",
                ownerEmail: user.email,
                ownerPhone: user?.profile?.phone || "Not provided",
                price: property.price,
                address: property.address,
                city: property.city,
                state: property.state,
            },
            action,
            message,
            reason,
            adminName: "Admin Team",
            reviewDate: new Date().toLocaleDateString("en-IN"),
        });
    }

    private static async notifyAdmin(property: any, userId: string, action: "APPROVE" | "REJECT" | "VERIFY" | "UNVERIFY" | "FLAG", message: string, reason?: string) {
        const user = await AdminAuthService.findAdminById(userId)
        if (!user) throw new Error("User not found");

        await propertyNotificationService.sendPropertyStatusNotification({
            property: {
                id: property.id.toString(),
                title: property.title,
                ownerName: user.firstName || "Property Owner",
                ownerEmail: user.email,
                ownerPhone: user?.phone || "Not provided",
                price: property.price,
                address: property.address,
                city: property.city,
                state: property.state,
            },
            action,
            message,
            reason,
            adminName: "Admin Team",
            reviewDate: new Date().toLocaleDateString("en-IN"),
        });
    }

    static async approveProperty(input: ApprovalActionInput) {
        const { propertyId, adminId, adminUserId, message, adminNotes, reason, ipAddress, userAgent } = input;
        try {
            const [property] = await db.select().from(properties).where(eq(properties.id, propertyId.toString()));
            if (!property) throw new Error("Property not found");
            const previousStatus = property.approvalStatus;

            const [updatedProperty] = await db.update(properties).set({
                approvalStatus: "APPROVED",
                approvalMessage: message,
                approvedBy: adminId.toString(),
                approvedAt: new Date(),
                lastReviewedBy: adminId.toString(),
                lastReviewedAt: new Date(),
                adminNotes: adminNotes || property.adminNotes,
                updatedAt: new Date(),
            }).where(eq(properties.id, propertyId.toString())).returning();

            await db.insert(propertyApprovalHistory).values({
                propertyId: propertyId.toString(),
                adminId: adminId.toString(),
                action: "approve",
                previousStatus,
                newStatus: "approved",
                message,
                adminNotes,
                reason,
                ipAddress,
                userAgent,
            });
            if (adminUserId) {
                await PropertyManagementService.assignPropertyToAgent({ PropertyId: propertyId, agentId: adminUserId, assignedByAdminId: adminId });
            }
            // Notifying the owner safely
            try {
                if (property.createdByType === "USER" && property.createdByUserId) {
                    const user = await PlatformUserService.findUserById(property.createdByUserId);
                    if (user) {
                        await this.notifyUser(property, property.createdByUserId, "APPROVE", message || "Your property has been approved and is now live on our platform.");
                    } else {
                        logger.warn(`User with ID ${property.createdByUserId} not found. Skipping notification.`);
                    }
                }

                if (property.createdByType === "ADMIN" && property.createdByAdminId) {
                    this.notifyAdmin(property, property?.createdByAdminId, "APPROVE", message || "Your property has been approved and is now live on our platform.");
                }
            } catch (notifyError) {
                logger.error(`Failed to send notification for property ${propertyId}:`, notifyError);
                // Not breaking port - continue the flow
            }

            logger.info(`Property ${propertyId} approved by admin ${adminId}`);
            return updatedProperty;
        } catch (error) {
            logger.error(`Error approving property ${propertyId}:`, error);
            throw error;
        }
    }





    static async rejectProperty(input: ApprovalActionInput) {
        const { propertyId, adminId, message, adminNotes, reason, ipAddress, userAgent } = input;
        try {
            const [property] = await db.select().from(properties).where(eq(properties.id, propertyId));
            if (!property) throw new Error("Property not found");
            const previousStatus = property.approvalStatus;
            const [updatedProperty] = await db.update(properties).set({
                approvalStatus: "REJECTED",
                approvalMessage: message,
                rejectionReason: reason,
                rejectedBy: adminId.toString(),
                rejectedAt: new Date(),
                lastReviewedBy: adminId.toString(),
                lastReviewedAt: new Date(),
                adminNotes: adminNotes || property.adminNotes,
                updatedAt: new Date(),
            }).where(eq(properties.id, propertyId.toString())).returning();

            await db.insert(propertyApprovalHistory).values({
                propertyId: propertyId.toString(),
                adminId: adminId.toString(),
                action: "reject",
                previousStatus,
                newStatus: "rejected",
                message,
                adminNotes,
                reason,
                ipAddress,
                userAgent,
            });

            if (property.createdByType === "USER" && property.createdByUserId) {
                this.notifyUser(property, property.createdByUserId, "REJECT", message || "Your property submission has been rejected.", reason);
            }

            if (property.createdByType === "ADMIN" && property.createdByAdminId) {
                this.notifyAdmin(property, property.createdByAdminId, "REJECT", message || "Your property submission has been rejected.", reason);
            }

            logger.info(`Property ${propertyId} rejected by admin ${adminId}`);
            return updatedProperty;
        } catch (error) {
            logger.error(`Error rejecting property ${propertyId}:`, error);
            throw error;
        }
    }

    // static async MarkSoldProperty(input: ApprovalActionInput) {
    //     const { propertyId, adminId, message, adminNotes, reason, ipAddress, userAgent, availablilityStatus } = input;
    //     try {
    //         const [property] = await db.select().from(properties).where(and(eq(properties.id, propertyId.toString()),eq(properties.approvalStatus, 'APPROVED')));
    //         if (!property) throw new Error("Property not found");
    //         const normalizedStatus = availablilityStatus?.toUpperCase();
    //         if (normalizedStatus !== 'SOLD' && normalizedStatus !== 'AVAILABLE') {
    //             throw new Error("Invalid availability status. Must be either 'AVAILABLE' or 'SOLD'.");
    //         }
    //         let status = '';
    //         if(normalizedStatus ==='SOLD'){
    //             status = 'SOLD';
    //         }else{
    //             status = 'AVAILABLE'
    //         }
    //         const [updatedProperty] = await db.update(properties).set({
    //             availablilityStatus: status || "AVAILABLE" as "AVAILABLE" | "SOLD",
    //             lastReviewedBy: adminId.toString(),
    //             lastReviewedAt: new Date(),
    //             adminNotes: adminNotes || property.adminNotes,
    //             updatedAt: new Date(),
    //         }).where(eq(properties.id, propertyId.toString())).returning();
    //     }catch (error) {
    //         logger.error(`Error marking property ${propertyId} as sold:`, error);
    //         throw error;
    //     }   
    // }

    static async verifyProperty(input: ApprovalActionInput) {
        const { propertyId, adminId, message, adminNotes } = input;
        try {
            const [property] = await db.select().from(properties).where(eq(properties.id, propertyId.toString()));
            if (!property) throw new Error("Property not found");
            const previousStatus = property.approvalStatus;

            const [updatedProperty] = await db.update(properties).set({
                approvalStatus: "APPROVED",
                approvalMessage: message,
                approvedBy: adminId.toString(),
                approvedAt: new Date(),
                isVerified: true,
                lastReviewedBy: adminId.toString(),
                lastReviewedAt: new Date(),
                adminNotes: adminNotes || property.adminNotes,
                updatedAt: new Date(),
            }).where(eq(properties.id, propertyId.toString())).returning();

            await db.insert(propertyApprovalHistory).values({
                propertyId: propertyId.toString(),
                adminId: adminId.toString(),
                action: "approve",
                previousStatus,
                newStatus: "approved",
                message,
                adminNotes,
                reason: "Auto Approved when admin verified the property",

            });
            await db.insert(schema.propertyVerification).values({
                propertyId: propertyId.toString(),
                isVerified: true,
                verificationMessage: message,
                verificationNotes: adminNotes,
                verifiedBy: adminId.toString(),
                verifiedAt: new Date(),
            });

            if (property.createdByType === "USER" && property.createdByUserId) {
                this.notifyUser(property, property?.createdByUserId, "VERIFY", message || "Your property has been verified and marked as authentic.");
            }
            if (property.createdByType === "ADMIN" && property.createdByAdminId) {
                this.notifyAdmin(property, property?.createdByAdminId, "VERIFY", message || "Your property has been verified and marked as authentic.");
            }




            logger.info(`Property ${propertyId} verified by admin ${adminId}`);
            return property;
        } catch (error) {
            logger.error(`Error verifying property ${propertyId}:`, error);
            throw error;
        }
    }

    static async getApprovalHistory(propertyId: number, limit = 20, offset = 0) {
        return await db.select({
            id: propertyApprovalHistory.id,
            action: propertyApprovalHistory.action,
            previousStatus: propertyApprovalHistory.previousStatus,
            newStatus: propertyApprovalHistory.newStatus,
            message: propertyApprovalHistory.message,
            adminNotes: propertyApprovalHistory.adminNotes,
            reason: propertyApprovalHistory.reason,
            createdAt: propertyApprovalHistory.createdAt,
            admin: {
                id: adminUsers.id,
                firstName: adminUsers.firstName,
                lastName: adminUsers.lastName,
                email: adminUsers.email,
            },
        }).from(propertyApprovalHistory)
            .leftJoin(adminUsers, eq(propertyApprovalHistory.adminId, adminUsers.id))
            .where(eq(propertyApprovalHistory.propertyId, propertyId.toString()))
            .orderBy(desc(propertyApprovalHistory.createdAt))
            .limit(limit)
            .offset(offset);
    }

    static async getPendingApprovalProperties(limit = 20, offset = 0) {
        return await db.select().from(properties)
            .where(eq(properties.approvalStatus, "PENDING"))
            .orderBy(desc(properties.createdAt))
            .limit(limit).offset(offset);
    }

    static async getRejectedProperties(limit = 20, offset = 0) {
        return await db.select().from(properties)
            .where(eq(properties.approvalStatus, "PENDING"))
            .orderBy(desc(properties.createdAt))
            .limit(limit).offset(offset);
    }


    static async getPropertiesByApprovalStatus(status: "PENDING" | "APPROVED" | "FLAGGED", limit = 20, offset = 0) {
        return await db.select().from(properties)
            .where(eq(properties.approvalStatus, status))
            .orderBy(desc(properties.updatedAt))
            .limit(limit).offset(offset);
    }

    static async getApprovalNotifications(userId: number, limit = 20, offset = 0) {
        return await db.select().from(propertyApprovalNotifications)
            .where(eq(propertyApprovalNotifications.userId, userId.toString()))
            .orderBy(desc(propertyApprovalNotifications.createdAt))
            .limit(limit).offset(offset);
    }

    static async markNotificationAsRead(notificationId: number) {
        const [notification] = await db.update(propertyApprovalNotifications).set({
            isRead: true,
            readAt: new Date(),
        }).where(eq(propertyApprovalNotifications.id, notificationId.toString())).returning();

        return notification;
    }
}
