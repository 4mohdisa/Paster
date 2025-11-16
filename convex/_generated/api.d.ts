/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import type * as clipboardHistory from "../clipboardHistory.js";
import type * as conversionHistory from "../conversionHistory.js";
import type * as fileVariants from "../fileVariants.js";
import type * as http from "../http.js";
import type * as s3Integration from "../s3Integration.js";
import type * as s3Test from "../s3Test.js";
import type * as testConvexS3 from "../testConvexS3.js";
import type * as testVariants from "../testVariants.js";

/**
 * A utility for referencing Convex functions in your app's API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
declare const fullApi: ApiFromModules<{
  clipboardHistory: typeof clipboardHistory;
  conversionHistory: typeof conversionHistory;
  fileVariants: typeof fileVariants;
  http: typeof http;
  s3Integration: typeof s3Integration;
  s3Test: typeof s3Test;
  testConvexS3: typeof testConvexS3;
  testVariants: typeof testVariants;
}>;
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;
