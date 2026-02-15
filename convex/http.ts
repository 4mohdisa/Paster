import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

// HTTP endpoint for storing S3 metadata
http.route({
  path: "/storeS3Metadata",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();

    // Call the mutation
    const result = await ctx.runMutation(api.s3Integration.storeS3Metadata, {
      objectKey: body.objectKey,
      fileName: body.fileName,
      fileSize: body.fileSize,
      mimeType: body.mimeType,
      storageType: body.storageType,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }),
});

export default http;
