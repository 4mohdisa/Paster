import { query } from "./_generated/server";

// Simple test function to check if S3 server is reachable from Convex
export const testS3Connection = query({
  args: {},
  handler: async (ctx) => {
    try {
      // Call our local S3 server health endpoint
      const response = await fetch("http://localhost:9000/health");
      const data = await response.json();

      return {
        success: true,
        s3Status: data,
        message: "Successfully connected to S3 server"
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: "Failed to connect to S3 server"
      };
    }
  },
});