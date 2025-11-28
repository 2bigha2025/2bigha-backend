import { GraphQLError } from "graphql";

import { logInfo, logError } from "../utils/logger";
import { PlatformUserService } from "./user.services";
import { PropertyService } from "../graphql/services/property.services";
import { seoService } from "../graphql/services/seo.service";
import { GeoJsonService } from "../graphql/services/geo-json.service";

interface PlatformUserContext {
    user?: {
        userId: string;
        email: string;
        roles: string[];
    };
    req: any;
    ip: string;
    userAgent: string;
}

export const platformUserResolvers = {
    Query: {
        me: async (_: any, __: any, context: PlatformUserContext) => {
            if (!context.user) {
                throw new GraphQLError("Not authenticated", {
                    extensions: { code: "UNAUTHENTICATED" },
                });
            }

            try {
                const user = await PlatformUserService.findUserById(
                    context.user.userId
                );
                if (!user) {
                    throw new GraphQLError("User not found", {
                        extensions: { code: "NOT_FOUND" },
                    });
                }

                return {
                    id: user.id.toString(),

                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    isActive: user.isActive,
                    isVerified: user.isVerified,
                    emailVerifiedAt: user.emailVerifiedAt?.toISOString(),
                    lastLoginAt: user.lastLoginAt?.toISOString(),
                    twoFactorEnabled: user.twoFactorEnabled,

                    createdAt: user.createdAt.toISOString(),
                    updatedAt: user.updatedAt.toISOString(),
                    profile: user.profile
                        ? {
                            id: user.profile.id.toString(),
                            bio: user.profile.bio,
                            avatar: user.profile.avatar,
                            phone: user.profile.phone,
                            address: user.profile.address,
                            city: user.profile.city,
                            state: user.profile.state,
                            country: user.profile.country,
                            pincode: user.profile.pincode,
                            website: user.profile.website,
                            socialLinks: user.profile.socialLinks,
                            preferences: user.profile.preferences,
                            specializations: user.profile.specializations,
                            serviceAreas: user.profile.serviceAreas,
                            languages: user.profile.languages,
                            experience: user.profile.experience,
                            rating: user.profile.rating,
                            totalReviews: user.profile.totalReviews,
                            createdAt: user.profile.createdAt.toISOString(),
                            updatedAt: user.profile.updatedAt.toISOString(),
                        }
                        : null,
                };
            } catch (error) {
                logError("Failed to get current user", error as Error, {
                    userId: context.user.userId,
                });
                throw new GraphQLError("Failed to get user profile", {
                    extensions: { code: "INTERNAL_ERROR" },
                });
            }
        },

        getUser: async (_: any, { id }: { id: string }) => {
            try {
                const user = await PlatformUserService.findUserById(id);
                if (!user) {
                    throw new GraphQLError("User not found", {
                        extensions: { code: "NOT_FOUND" },
                    });
                }

                return {
                    id: user.id.toString(),

                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    role: user.role,
                    isActive: user.isActive,

                    createdAt: user.createdAt.toISOString(),
                    profile: user.profile
                        ? {
                            id: user.profile.id.toString(),
                            bio: user.profile.bio,
                            avatar: user.profile.avatar,
                            city: user.profile.city,
                            state: user.profile.state,
                            specializations: user.profile.specializations,
                            serviceAreas: user.profile.serviceAreas,
                            languages: user.profile.languages,
                            experience: user.profile.experience,
                            rating: user.profile.rating,
                            totalReviews: user.profile.totalReviews,
                        }
                        : null,
                };
            } catch (error) {
                logError("Failed to get user", error as Error, { id });
                throw new GraphQLError("Failed to get user", {
                    extensions: { code: "INTERNAL_ERROR" },
                });
            }
        },

        getUserProfile: async (_: any, { uuid }: { uuid: string }) => {
            try {
                // const user = users.find((u: any) => u.uuid === uuid)
                // if (!user) {
                //     throw new GraphQLError("User not found", {
                //         extensions: { code: "NOT_FOUND" },
                //     })
                // }
                // return {
                //     id: user.id.toString(),
                //     uuid: user.uuid,
                //     firstName: user.firstName,
                //     lastName: user.lastName,
                //     role: user.role,
                //     companyName: user.companyName,
                //     profile: user.profile,
                // }
            } catch (error) {
                logError("Failed to get user profile", error as Error, { uuid });
                throw new GraphQLError("Failed to get user profile", {
                    extensions: { code: "INTERNAL_ERROR" },
                });
            }
        },

        getPropertiesByUser: async (
            _: any,
            { input }: { input: { page: number; limit: number } },
            context: PlatformUserContext
        ) => {
            try {
                // const user = users.find((u: any) => u.uuid === uuid)
                if (!context.user) {
                    throw new GraphQLError("Not authenticated", {
                        extensions: { code: "UNAUTHENTICATED" },
                    });
                }

                const properties = await PropertyService.getPropertiesByUser(
                    context.user.userId,
                    input.page,
                    input.limit
                );
                return properties;

                // return {
                //     id: user.id.toString(),
                //     uuid: user.uuid,
                //     firstName: user.firstName,
                //     lastName: user.lastName,
                //     role: user.role,
                //     companyName: user.companyName,
                //     profile: user.profile,
                // }
            } catch (error) {
                console.log(error)
                throw new GraphQLError("Failed to get user profile", {
                    extensions: { code: "INTERNAL_ERROR" },
                });
            }
        },

        getPropertyBySlug: async (
            _: any,
            { input }: { input: { slug: string; } }
        ) => {
            const results = await PropertyService.getPropertyBySlug(
                input.slug
            );

            return results;
        },
         getPropertiesByLocation: async (
      _: any,
      { input }: { input: { lat?: number; lng?: number; radius?: number; limit?: number } }
    ) => {
      try {
        const results = await PropertyService.getPropertiesByLocation(
          input.lat,
          input.lng,
          input.radius,
          input.limit || 10
        );
        return results;
      } catch (error) {
        console.error("❌ Resolver error in getPropertiesByLocation:", error);
        throw new Error("Unable to fetch properties by location");
      }
    },

    getPropertiesByViewCount: async (
      _: any,
      { input }: { input: { limit?: number; minViewCount?: number } }
    ) => {
      try {
        const results = await PropertyService.getPropertiesByViewCount(
          input.limit || 10,
          input.minViewCount
        );
        return results;
      } catch (error) {
        console.error("❌ Resolver error in getPropertiesByViewCount:", error);
        throw new Error("Unable to fetch properties by view count");
      }
    },
        getTopProperties: async (
            _: any,
            { },
            context: PlatformUserContext
        ) => {
            try {
                // const user = users.find((u: any) => u.uuid === uuid)
                // if (!context.user) {
                //     throw new GraphQLError("Not authenticated", {
                //         extensions: { code: "UNAUTHENTICATED" },
                //     });
                // }

                const userId = context.user?.userId;
                const properties = await PropertyService.getTopProperties(userId?.toString() || '');
                return properties;


            } catch (error) {
                throw new GraphQLError("Failed to get user profile", {
                    extensions: { code: "INTERNAL_ERROR" },
                });
            }
        },

        getSeoPageByUrl: async (_: any, { url }: { url: string }) => {
            return await seoService.getSeoPageByUrl(url)
        },

        getHomePageSeo: async (_: any, { url }: { url: string }) => {
            return await seoService.getGlobalSeoSettings()
        },

        findGeoJsonFeaturesWithinRadius: (
            _: any,
            { lat, lng, radiusKm }: { lat: number; lng: number; radiusKm: number }
        ) => GeoJsonService.findFeaturesWithinRadius(lat, lng, radiusKm),
    },



    Mutation: {
        signupUser: async (
            _: any,
            { input }: { input: any },
            context: PlatformUserContext
        ) => {
            try {
                if (!input.agreeToTerms) {
                    throw new GraphQLError("You must agree to the terms and conditions", {
                        extensions: { code: "VALIDATION_ERROR" },
                    });
                }
                const {profile, ...userdata} = input;
                const createUserData = {
                    ...userdata, 
                    phone: profile?.phone,
                    profileImage: profile?.avatar,
                    address : profile?.address,
                }
                 console.log(input,createUserData);
                const user = await PlatformUserService.createUser(createUserData);
                const sessionToken = PlatformUserService.createUserSession(
                    user.id,
                    user?.email || "",
                    user.role
                );

                logInfo("User signed up successfully", {
                    userId: user.id,
                    email: user.email,
                    ip: context.ip,
                });

                return {
                    success: true,
                    message: "Account created successfully",
                    token: sessionToken,
                    user: {
                        id: user.id.toString(),
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        role: user.role,
                        isActive: user.isActive,
                        isVerified: user.isVerified,
                        createdAt: user.createdAt.toISOString(),
                    },
                    requiresEmailVerification: !user.isVerified,
                };
            } catch (error) {
                logError("User signup failed", error as Error, {
                    email: input.email,
                    ip: context.ip,
                });
            
                throw new GraphQLError((error as Error).message, {
                    extensions: { code: "SIGNUP_FAILED" },
                });
            }
        },

        loginUser: async (
            _: any,
            { input }: { input: any },
            context: PlatformUserContext
        ) => {
            try {
                const user = await PlatformUserService.findUserByEmail(input.email);
                if (!user) {
                    throw new GraphQLError("Invalid credentials", {
                        extensions: { code: "INVALID_CREDENTIALS" },
                    });
                }

                if (!user.isActive) {
                    throw new GraphQLError("Account is deactivated", {
                        extensions: { code: "ACCOUNT_DEACTIVATED" },
                    });
                }

                const isValidPassword = await PlatformUserService.verifyPassword(
                    input.password,
                    user.password || ""
                );
                if (!isValidPassword) {
                    throw new GraphQLError("Invalid credentials", {
                        extensions: { code: "INVALID_CREDENTIALS" },
                    });
                }

                await PlatformUserService.updateLastLogin(user.id);
                const sessionToken = PlatformUserService.createUserSession(
                    user.id,
                    user?.email || "",
                    user.role
                );

                logInfo("User logged in successfully", {
                    userId: user.id,
                    email: user.email,
                    ip: context.ip,
                });

                return {
                    success: true,
                    message: "Login successful",
                    token: sessionToken,
                    user: {
                        id: user.id.toString(),

                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        role: user.role,
                        isActive: user.isActive,
                        isVerified: user.isVerified,
                        lastLoginAt: new Date().toISOString(),
                    },
                    requiresEmailVerification: !user.isVerified,
                };
            } catch (error) {
                logError("User login failed", error as Error, {
                    email: input.email,
                    ip: context.ip,
                });

                if (error instanceof GraphQLError) throw error;
                throw new GraphQLError("Login failed", {
                    extensions: { code: "LOGIN_FAILED" },
                });
            }
        },

        requestPhoneOTP: async (
            _: any,
            { input }: { input: any },
            context: PlatformUserContext
        ) => {
            try {
                const result = await PlatformUserService.sendPhoneOTP(input.phone);

                logInfo("Phone OTP requested", {
                    phone: input.phone,
                    ip: context.ip,
                });

                return {
                    success: result.success,
                    message: "OTP sent to your phone",
                    otpSent: true,
                    expiresIn: result.expiresIn,
                    remainingAttempts: result.remainingAttempts,
                };
            } catch (error) {
                logError("Phone OTP request failed", error as Error, {
                    phone: input.phone,
                    ip: context.ip,
                });

                throw new GraphQLError((error as Error).message, {
                    extensions: { code: "OTP_REQUEST_FAILED" },
                });
            }
        },

        verifyPhoneOTP: async (
            _: any,
            { input }: { input: any },
            context: PlatformUserContext
        ) => {
            try {
                const result = await PlatformUserService.verifyPhoneOTP(
                    input.phone,
                    input.otp
                );
                const user = result?.user as any
                const profile = result?.profile
                if (!user) {
                    throw new GraphQLError("User not found", {
                        extensions: { code: "USER_NOT_FOUND" },
                    });
                }
                const sessionToken = PlatformUserService.createUserSession(
                    user.id,
                    user?.email || "",
                    user.role
                );

                logInfo("Phone OTP verified successfully", {
                    userId: user.id,
                    phone: input.phone,
                    ip: context.ip,
                });

                return {
                    success: true,
                    message: "Phone verification successful",
                    token: sessionToken,
                    user: {
                        id: user.id.toString(),

                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        role: user.role,
                        isActive: user.isActive,
                        isVerified: user.isVerified,
                        lastLoginAt: new Date().toISOString(),
                    },
                    profile: profile,
                };
            } catch (error) {
                logError("Phone OTP verification failed", error as Error, {
                    phone: input.phone,
                    ip: context.ip,
                });

                throw new GraphQLError((error as Error).message, {
                    extensions: { code: "OTP_VERIFICATION_FAILED" },
                });
            }
        },

        googleAuth: async (
            _: any,
            { input }: { input: any },
            context: PlatformUserContext
        ) => {
            try {
                const { user, isNewUser } =
                    await PlatformUserService.authenticateWithGoogle(input.googleToken);
                const sessionToken = PlatformUserService.createUserSession(
                    user.id,
                    user?.email|| "",
                    user.role
                );

                logInfo("Google authentication successful", {
                    userId: user.id,
                    email: user.email,
                    isNewUser,
                    ip: context.ip,
                });

                return {
                    success: true,
                    message: isNewUser
                        ? "Account created successfully"
                        : "Login successful",
                    token: sessionToken,
                    user: {
                        id: user.id.toString(),

                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        role: user.role,
                        isActive: user.isActive,
                        isVerified: user.isVerified,
                        lastLoginAt: new Date().toISOString(),
                    },
                    isNewUser,
                };
            } catch (error) {
                logError("Google authentication failed", error as Error, {
                    ip: context.ip,
                });

                throw new GraphQLError((error as Error).message, {
                    extensions: { code: "GOOGLE_AUTH_FAILED" },
                });
            }
        },

        updateProfile: async (
            _: any,
            { input }: { input: any },
            context: PlatformUserContext
        ) => {
            if (!context.user) {
                throw new GraphQLError("Not authenticated", {
                    extensions: { code: "UNAUTHENTICATED" },
                });
            }

            try {
                const updatedUser = await PlatformUserService.updateUser(
                    context.user.userId,
                    context.user.userId,
                    input
                );

                // if (!updatedUser) {
                //     throw new GraphQLError("Failed to update profile", {
                //         extensions: { code: "UPDATE_FAILED" },
                //     });
                // }

                // logInfo("Profile updated successfully", {
                //     userId: context.user.userId,
                // });

                return {
                    id: updatedUser.id.toString(),
                    email: updatedUser.email,
                    firstName: updatedUser.firstName,
                    lastName: updatedUser.lastName,
                    role: updatedUser.role,
                    isActive: updatedUser.isActive,
                    isVerified: updatedUser.isVerified,
                    updatedAt: new Date().toISOString(),
                    profile: updatedUser.profile
                        ? {
                            id: updatedUser.profile.id.toString(),
                            bio: updatedUser.profile.bio,
                            avatar: updatedUser.profile.avatar,
                            phone: updatedUser.profile.phone,
                            address: updatedUser.profile.address,
                            city: updatedUser.profile.city,
                            state: updatedUser.profile.state,
                            country: updatedUser.profile.country,
                            pincode: updatedUser.profile.pincode,
                            website: updatedUser.profile.website,
                            socialLinks: updatedUser.profile.socialLinks,
                            preferences: updatedUser.profile.preferences,
                            specializations: updatedUser.profile.specializations,
                            serviceAreas: updatedUser.profile.serviceAreas,
                            languages: updatedUser.profile.languages,
                            experience: updatedUser.profile.experience,
                            rating: updatedUser.profile.rating,
                            totalReviews: updatedUser.profile.totalReviews,
                            updatedAt: new Date().toISOString(),
                        }
                        : null,
                };
            } catch (error) {
                logError("Profile update failed", error as Error, {
                    userId: context.user.userId,
                });

                throw new GraphQLError((error as Error).message, {
                    extensions: { code: "UPDATE_FAILED" },
                });
            }
        },

        sendEmailVerification: async (
            _: any,
            __: any,
            context: PlatformUserContext
        ) => {
            if (!context.user) {
                throw new GraphQLError("Not authenticated", {
                    extensions: { code: "UNAUTHENTICATED" },
                });
            }

            try {
                await PlatformUserService.sendEmailVerification(context.user.userId);

                return {
                    success: true,
                    message: "Verification email sent successfully",
                };
            } catch (error) {
                logError("Email verification send failed", error as Error, {
                    userId: context.user.userId,
                });

                throw new GraphQLError((error as Error).message, {
                    extensions: { code: "EMAIL_VERIFICATION_FAILED" },
                });
            }
        },

        verifyEmail: async (_: any, { token }: { token: string }) => {
            try {
                const user = await PlatformUserService.verifyEmail(token);

                if (!user) {
                    throw new GraphQLError("Email verification failed", {
                        extensions: { code: "VERIFICATION_FAILED" },
                    });
                }

                return {
                    success: true,
                    message: "Email verified successfully",
                    user: {
                        id: user.id.toString(),

                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        isVerified: user.isVerified,
                        emailVerifiedAt: user.emailVerifiedAt?.toISOString(),
                    },
                };
            } catch (error) {
                logError("Email verification failed", error as Error, { token });

                throw new GraphQLError((error as Error).message, {
                    extensions: { code: "VERIFICATION_FAILED" },
                });
            }
        },

        logout: async (_: any, __: any, context: PlatformUserContext) => {
            try {
                if (context.user) {
                    // In a real implementation, you might want to blacklist the token
                    logInfo("User logged out", { userId: context.user.userId });
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

        createPropertyByUser: async (
            _: any,
            { input }: { input: any },
            context: PlatformUserContext
        ) => {
            if (!context.user) {
                throw new GraphQLError("Not authenticated", {
                    extensions: { code: "UNAUTHENTICATED" },
                });
            }

            try {
                const property = await PropertyService.createPropertyByUser(
                    input,
                    context.user.userId
                );
                return property;
            } catch (error) {
                console.log(error)
                console.error("Create property error:", error);
                throw new GraphQLError("Failed to create property", {
                    extensions: { code: "INTERNAL_ERROR" },
                });
            }
        }
    },
};
