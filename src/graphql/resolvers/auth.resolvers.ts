import { GraphQLError } from "graphql";
import { AdminAuthService } from "../services/auth.service";
import { createSession } from "../../config/auth";
import { PlatformUserService } from "../../user/user.services";
export interface AdminContext {
    admin?: {
        adminId: string;
        email: string;
        roles: string[];
        phone: string;
    };
    req: any;
}

export const adminAuthResolvers = {
    Query: {
        me: async (_: any, __: any, context: AdminContext) => {
            if (!context.admin) {
                throw new GraphQLError("Not authenticated", {
                    extensions: { code: "UNAUTHENTICATED" },
                });
            }

            const adminData = await AdminAuthService.getAdminWithPermissions(
                context.admin.adminId
            );

            if (!adminData) {
                throw new GraphQLError("Admin not found", {
                    extensions: { code: "NOT_FOUND" },
                });
            }

            return {
                id: adminData.admin.id.toString(),
                firstName: adminData.admin.firstName,
                lastName: adminData.admin.lastName,
                email: adminData.admin.email,
                department: adminData.admin.department,
                employeeId: adminData.admin.employeeId,
                phone: adminData.admin.phone,
                isActive: adminData.admin.isActive,
                isVerified: adminData.admin.isVerified,
                lastLoginAt: adminData.admin.lastLoginAt?.toISOString(),
                createdAt: adminData.admin.createdAt.toISOString(),
                updatedAt: adminData.admin.updatedAt.toISOString(),
                roles: adminData.roles.map((role) => ({
                    id: role.roleId,
                    name: role.roleName,
                    slug: role.roleSlug,
                    description: role.roleDescription,
                    color: role.roleColor,
                })),
                permissions: adminData.permissions.map((perm) => ({
                    id: perm.permissionId,
                    name: perm.permissionName,
                    resource: perm.resource,
                    action: perm.action,
                    description: perm.description,
                })),
            };
        },

        verifyAdminToken: async (
            _: any,
            { token }: { token: string },
            context: AdminContext
        ) => {
            try {
                const token = context.req.headers.authorization?.replace("Bearer ", "");

                const session = AdminAuthService.getAdminSession(token);

                if (!session) {
                    return { valid: false, admin: null };
                }

                const admin = await AdminAuthService.findAdminById(session.userId);

                if (!admin) {
                    return { valid: false, admin: null };
                }

                return {
                    valid: true,
                    admin: {
                        id: admin.id.toString(),
                        firstName: admin.firstName,
                        lastName: admin.lastName,
                        email: admin.email,
                        department: admin.department,
                        employeeId: admin.employeeId,
                    },
                };
            } catch (error) {
                return { valid: false, admin: null };
            }
        },

        // adminUsers: async (
        //     _: any,
        //     { limit = 20, offset = 0 }: { limit?: number; offset?: number },
        //     context: AdminContext,
        // ) => {
        //     if (!context.admin) {
        //         throw new GraphQLError("Not authenticated", {
        //             extensions: { code: "UNAUTHENTICATED" },
        //         })
        //     }

        //     // Check if admin has permission to view admin users
        //     const hasPermission = await AdminAuthService.hasPermission(context.admin.adminId, "system:view")
        //     if (!hasPermission) {
        //         throw new GraphQLError("Insufficient permissions", {
        //             extensions: { code: "FORBIDDEN" },
        //         })
        //     }

        //     const admins = await AdminAuthService.getAllAdminsWithRoles()

        //     return admins.slice(offset, offset + limit).map((admin) => ({
        //         id: admin.adminId.toString(),
        //         uuid: admin.adminUuid,
        //         email: admin.email,
        //         firstName: admin.firstName,
        //         lastName: admin.lastName,
        //         department: admin.department,
        //         employeeId: admin.employeeId,
        //         phone: admin.phone,
        //         isActive: admin.isActive,
        //         lastLoginAt: admin.lastLoginAt?.toISOString(),
        //         createdAt: admin.createdAt.toISOString(),
        //         role: admin.roleName
        //             ? {
        //                 name: admin.roleName,
        //                 slug: admin.roleSlug,
        //                 color: admin.roleColor,
        //             }
        //             : null,
        //     }))
        // },
    },

    Mutation: {
        adminLogin: async (_: any, { input }: { input: any }) => {
            const { email, password, ipAddress } = input;

            try {
                const admin = await AdminAuthService.findAdminByEmail(email);

                if (!admin) {
                    throw new GraphQLError("Invalid credentials", {
                        extensions: { code: "INVALID_CREDENTIALS" },
                    });
                }

                const isValidPassword = await AdminAuthService.verifyPassword(
                    password,
                    admin.password || ""
                );
                if (!isValidPassword) {
                    throw new GraphQLError("Invalid credentials", {
                        extensions: { code: "INVALID_CREDENTIALS" },
                    });
                }

                // Get admin roles
                const adminData = await AdminAuthService.getAdminWithPermissions(
                    admin.id
                );
                const roles = adminData?.roles.map((role) => role.roleSlug) || [];

                const sessionId = AdminAuthService.createAdminSession(
                    admin.id,
                    admin.email,
                    roles,
                    admin.phone || ""
                );

                await AdminAuthService.updateLastLogin(admin.id);

                await AdminAuthService.logAdminActivity(
                    admin.id,
                    "login",
                    "admin_auth",
                    admin.id,
                    { email, success: true },
                    ipAddress || "127.0.0.1"
                );

                return {
                    success: true,
                    message: "Login successful",
                    requiresOTP: false,
                    token: sessionId,
                    refreshToken: sessionId,
                    admin: {
                        id: admin.id.toString(),
                        firstName: admin.firstName,
                        lastName: admin.lastName,
                        email: admin.email,
                        department: admin.department,
                        roles:
                            adminData?.roles.map((role) => ({
                                name: role.roleName,
                                slug: role.roleSlug,
                                color: role.roleColor,
                            })) || [],
                    },
                };
            } catch (error) {
                console.error("Admin login error:", error);
                if (error instanceof GraphQLError) throw error;
                throw new GraphQLError("Login failed", {
                    extensions: { code: "INTERNAL_ERROR" },
                });
            }
        },        adminCreateUser: async (
            _: any,
            { input }: { input: any },
            context: AdminContext
          ) => {
            try {
              if (!context.admin?.adminId) {
                throw new GraphQLError("Not Authenticated", {
                  extensions: { code: "UNAUTHENTICATED" },
                });
              }
      
              // Extract user data and profile data from input
              const { profile, ...userData } = input;
                            const createUserData = {
                                ...userData,
                                phone: profile?.phone,
                                whatsappNumber: profile?.whatsappNumber,
                                profileImage: profile?.avatar,
                                address: profile?.address,
                            };
      
              const user = await PlatformUserService.createUser(createUserData, context.admin?.adminId);
              
              // Get the full user with profile
            //   const fullUser = await PlatformUserService.findUserById(user.id);
              
              return {
                success: true,
                message: "Account created successfully",
                user: {
                  id: user?.id.toString(),
                  uuid: user?.id, // Using id as uuid since uuid field doesn't exist
                  email: user?.email || "",
                  firstName: user?.firstName,
                  lastName: user?.lastName,
                  role: user?.role,
                  isActive: user?.isActive,
                  isVerified: user?.isVerified,
                  emailVerifiedAt: user?.emailVerifiedAt?.toISOString(),
                  lastLoginAt: user?.lastLoginAt?.toISOString(),
                  twoFactorEnabled: user?.twoFactorEnabled,
                  licenseNumber: null, // These fields don't exist in the schema
                  companyName: null,
                  businessType: null,
                  taxId: null,
                  createdAt: user?.createdAt.toISOString(),
                  updatedAt: user?.updatedAt.toISOString(),
                },
                requiresEmailVerification: !user?.isVerified,
                requiresPhoneVerification: false,
              };
            } catch (error) {
              throw new GraphQLError((error as Error).message, {
                extensions: { code: "SIGNUP_FAILED" },
              });
            }
        },
        UpdatePlatformUser: async (
              _: any, { userId, profiledata }: { userId: string, profiledata:any }, context: AdminContext
            ) => {
              if (!context.admin?.adminId) {
                throw new GraphQLError("Not authenticated",
                  {
                    extensions: { code: "UNAUTHENTICATED" },
                  });
              } try {
                const result = await PlatformUserService.updateUser(userId, context.admin.adminId, profiledata);
                return result;
              }
              catch (error) {
                throw new GraphQLError("Internal server error",
                  { extensions: { code: "INTERNAL_SERVER_ERROR" }, });
              }
            },       
        verifyAdminOTP: async (_: any, { input }: { input: any }) => {
            const { email, otp, type } = input;

            try {
                const admin = await AdminAuthService.findAdminByEmail(email);

                if (!admin) {
                    throw new GraphQLError("Admin not found", {
                        extensions: { code: "NOT_FOUND" },
                    });
                }

                const otpRecord = await AdminAuthService.verifyAdminOTP(
                    admin.id,
                    otp,
                    type
                );

                if (!otpRecord) {
                    throw new GraphQLError("Invalid or expired OTP", {
                        extensions: { code: "INVALID_OTP" },
                    });
                }

                const adminData = await AdminAuthService.getAdminWithPermissions(
                    admin.id
                );
                const roles = adminData?.roles.map((role) => role.roleSlug) || [];

                const sessionId = AdminAuthService.createAdminSession(
                    admin.id,
                    admin.email,
                    roles,
                    admin?.phone || ""
                );

                return {
                    success: true,
                    message: "OTP verified successfully",
                    token: sessionId,
                    refreshToken: sessionId,
                    admin: {
                        id: admin.id.toString(),

                        firstName: admin.firstName,
                        lastName: admin.lastName,
                        email: admin.email,
                        department: admin.department,
                    },
                };
            } catch (error) {
                console.error("Admin OTP verification error:", error);
                if (error instanceof GraphQLError) throw error;
                throw new GraphQLError("OTP verification failed", {
                    extensions: { code: "INTERNAL_ERROR" },
                });
            }
        },

        adminLogout: async (
            _: any,
            { token }: { token: string },
            context: AdminContext
        ) => {
            try {
                if (token) {
                    AdminAuthService.deleteAdminSession(token);
                }

                if (context.admin) {
                    await AdminAuthService.logAdminActivity(
                        context.admin.adminId,
                        "logout",
                        "admin_auth",
                        context.admin.adminId,
                        { email: context.admin.email },
                        "127.0.0.1"
                    );
                }

                return {
                    success: true,
                    message: "Logged out successfully",
                };
            } catch (error) {
                return {
                    success: true,
                    message: "Logged out successfully",
                };
            }
        },

        resendOTP: async (_: any, { input }: { input: any }) => {
            try {
                const { email, type, ipAddress } = input;

                // Find admin
                const admin = await AdminAuthService.findAdminByEmail(email);
                if (!admin) {
                    return {
                        success: false,
                        message: "Admin account not found with this email address.",
                    };
                }

                if (!admin.isActive) {
                    return {
                        success: false,
                        message:
                            "Your account has been deactivated. Please contact support.",
                    };
                }

                // Check OTP rate limiting
                const otpStatus = await AdminAuthService.getOTPStatus(email, type);
                if (!otpStatus.canResend) {
                    if (otpStatus.isBlocked) {
                        return {
                            success: false,
                            message: "Too many OTP attempts. Please try again after 1 hour.",
                        };
                    } else {
                        return {
                            success: false,
                            message: `Please wait ${otpStatus.nextResendIn} seconds before requesting another OTP.`,
                        };
                    }
                }

                // Create and send OTP
                await AdminAuthService.createOTP(admin.id, type, email);

                // Get appropriate message based on OTP type
                let message = "OTP sent successfully to your email address.";
                switch (type) {
                    case "LOGIN_2FA":
                        message = "Login verification code sent to your email.";
                        break;
                    case "PASSWORD_RESET":
                        message = "Password reset code sent to your email.";
                        break;
                    case "EMAIL_VERIFICATION":
                        message = "Email verification code sent.";
                        break;
                    case "ACCOUNT_RECOVERY":
                        message = "Account recovery code sent to your email.";
                        break;
                }

                return {
                    success: true,
                    message,
                };
            } catch (error) {
                console.error("Resend OTP error:", error);
                return {
                    success: false,
                    message: "Failed to send OTP. Please try again.",
                };
            }
        },

        refreshToken: async (_: any, { input }: { input: any }) => {
            try {
                const { refreshToken, deviceId, ipAddress } = input;

                // Validate refresh token
                const session = await AdminAuthService.validateRefreshToken(
                    refreshToken
                );
                if (!session) {
                    return {
                        success: false,
                        token: null,
                        refreshToken: null,
                    };
                }

                // Get admin
                const admin = await AdminAuthService.findAdminById(session.adminId);
                if (!admin || !admin.isActive) {
                    return {
                        success: false,
                        token: null,
                        refreshToken: null,
                    };
                }

                // Get admin permissions
                const adminData = await AdminAuthService.getAdminWithPermissions(
                    admin.id
                );
                const roles = adminData?.roles.map((role) => role.roleSlug) || [];
                // Create new tokens
                const newAccessToken = createSession(
                    admin.id,
                    admin.email,
                    roles.join(","),
                    admin?.phone || ""
                );
                const newRefreshToken = await AdminAuthService.createRefreshToken(
                    admin.id,
                    ipAddress || "127.0.0.1",
                    `Device: ${deviceId || "Unknown"}`
                );

                // Revoke old refresh token
                await AdminAuthService.revokeRefreshToken(refreshToken);

                return {
                    success: true,
                    token: newAccessToken,
                    refreshToken: newRefreshToken,
                };
            } catch (error) {
                console.error("Token refresh error:", error);
                return {
                    success: false,
                    token: null,
                    refreshToken: null,
                };
            }
        },
    },
};
