import { GraphQLError } from "graphql";
import { AdminDashboardService } from "../services/admin-dashboard.service";
import { AdminContext } from "./auth.resolvers";
import { PlatformUserService } from "../../user/user.services";
import { resolveObjectURL } from "buffer";

export const adminDashboardResolvers = {
  Query: {
    adminDashboardStats: async (
      _: any,
      { filters }: { filters?: any },
      context: AdminContext
    ) => {
      if (!context.admin) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Check if user has admin role
      // if (!["super_admin", "admin", "moderator"].includes(context.admin.role)) {
      //     throw new GraphQLError("Insufficient permissions", {
      //         extensions: { code: "FORBIDDEN" },
      //     })
      // }

      try {
        return await AdminDashboardService.getDashboardStats(filters);
      } catch (error) {
        console.error("Admin dashboard stats error:", error);
        throw new GraphQLError("Failed to fetch dashboard statistics", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    realTimeDashboardMetrics: async (
      _: any,
      __: any,
      context: AdminContext
    ) => {
      console.log("dd");
      if (!context.admin) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // if (!["super_admin", "admin", "moderator"].includes(context.admin.role)) {
      //     throw new GraphQLError("Insufficient permissions", {
      //         extensions: { code: "FORBIDDEN" },
      //     })
      // }

      try {
        console.log("ddf");
        return await AdminDashboardService.getRealTimeMetrics();
      } catch (error) {
        console.error("Real-time dashboard metrics error:", error);
        throw new GraphQLError("Failed to fetch real-time metrics", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    adminActivityFeed: async (
      _: any,
      { limit = 50, offset = 0, activityTypes, dateRange }: any,
      context: AdminContext
    ) => {
      if (!context.admin) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // if (!["super_admin", "admin", "moderator"].includes(context.admin.role)) {
      //     throw new GraphQLError("Insufficient permissions", {
      //         extensions: { code: "FORBIDDEN" },
      //     })
      // }

      try {
        return await AdminDashboardService.getActivityFeed(
          limit,
          offset,
          activityTypes,
          dateRange
        );
      } catch (error) {
        console.error("Admin activity feed error:", error);
        throw new GraphQLError("Failed to fetch activity feed", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    agentPerformanceAnalytics: async (
      _: any,
      { agentIds, dateRange, limit = 20 }: any,
      context: AdminContext
    ) => {
      if (!context.admin) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // if (!["super_admin", "admin", "moderator"].includes(context.admin.role)) {
      //     throw new GraphQLError("Insufficient permissions", {
      //         extensions: { code: "FORBIDDEN" },
      //     })
      // }

      try {
        const filters = { agentIds, dateRange };
        return await AdminDashboardService.getAgentPerformance(filters, limit);
      } catch (error) {
        console.error("Agent performance analytics error:", error);
        throw new GraphQLError("Failed to fetch agent performance analytics", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
    SearchAgentByNamePhone: async (
      _: any,
      { searchTerm, limit = 10, page = 1 }: { searchTerm: string; limit?: number; page?: number },
      context: AdminContext
    ) => {
      if (!context.admin?.adminId) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }
      try {
        const result = await PlatformUserService.searchUsers(searchTerm, limit, page);
        console.log(result);
        return result;
      } catch (error) {
        //   logError("SearchAgentByNamePhone failed", error as Error, { searchTerm, limit, page });
        throw new GraphQLError("Internal server error", {
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        });
      }
    },
    propertyAnalytics: async (
      _: any,
      { filters }: { filters?: any },
      context: AdminContext
    ) => {
      if (!context.admin) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // if (!["super_admin", "admin", "moderator"].includes(context.admin.role)) {
      //     throw new GraphQLError("Insufficient permissions", {
      //         extensions: { code: "FORBIDDEN" },
      //     })
      // }

      try {
        return await AdminDashboardService.getPropertyAnalytics(filters);
      } catch (error) {
        console.error("Property analytics error:", error);
        throw new GraphQLError("Failed to fetch property analytics", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },
  
  // Type resolvers
  DashboardMetric: {
    // All fields resolved directly from service
  },

  TodayActivity: {
    // All fields resolved directly from service
  },

  RecentActivity: {
    // All fields resolved directly from service
  },

  PropertyStatusCount: {
    // All fields resolved directly from service
  },

  MonthlyTrend: {
    // All fields resolved directly from service
  },

  CityStats: {
    // All fields resolved directly from service
  },

  AgentPerformance: {
    // All fields resolved directly from service
  },

  PropertyAnalytics: {
    // All fields resolved directly from service
  },

  PropertyPerformance: {
    // All fields resolved directly from service
  },

  GeographicData: {
    // All fields resolved directly from service
  },
};
