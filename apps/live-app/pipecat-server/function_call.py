from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema

# Define a function using the standard schema
weather_function = FunctionSchema(
    name="get_current_weather",
    description="Get the current weather in a location",
    properties={
        "location": {
            "type": "string",
            "description": "The city and state, e.g. San Francisco, CA",
        },
        "format": {
            "type": "string",
            "enum": ["celsius", "fahrenheit"],
            "description": "The temperature unit to use.",
        },
    },
    required=["location", "format"]
)

# Create a tools schema with your functions
tools = ToolsSchema(standard_tools=[weather_function])

__all__ = ['tools']



# import { FunctionDeclaration, Type } from "@google/genai";

# export interface ToolList {
#   functionDeclarations: FunctionDeclaration;
#   functionExecutions: (args: any) => Promise<any>;
# }

# export const toolList: ToolList[] = [
#   {
#     functionDeclarations: {
#       name: "getParentStatus",
#       description:
#         "Gets the main status overview of all processed files. This is useful to get a high-level summary of what has been processed, what is currently processing, and what has failed. It includes total counts for completed, processing, and errored files, along with a list of all file objects.",
#       parameters: {
#         type: Type.OBJECT,
#         properties: {},
#         required: [],
#       },
#     },
#     functionExecutions: async (_args: any) => {
#       try {
#         const result = await window.electronAPI.getParentStatus();
#         return { success: true, result };
#       } catch (error) {
#         return { success: false, error: error.message };
#       }
#     },
#   },
#   {
#     functionDeclarations: {
#       name: "getDirectoryContents",
#       description:
#         "Lists all the generated file names (like 'summary.txt', 'status.json') within a specific processed file's directory. You must find the directory by providing one of the following: its hashed fileId, its original full path, or its original file name.",
#       parameters: {
#         type: Type.OBJECT,
#         properties: {
#           fileId: {
#             type: Type.STRING,
#             description: "The unique MD5 hash ID of the file.",
#           },
#           originalPath: {
#             type: Type.STRING,
#             description: "The original absolute path of the file before it was processed.",
#           },
#           originalFileName: {
#             type: Type.STRING,
#             description: "The original name of the file (e.g., 'mydocument.pdf').",
#           },
#         },
#       },
#     },
#     functionExecutions: async (args: any) => {
#       if (!args.fileId && !args.originalPath && !args.originalFileName) {
#         return {
#           success: false,
#           error: "You must provide at least one of fileId, originalPath, or originalFileName.",
#         };
#       }
#       try {
#         const result = await window.electronAPI.getDirectoryContents(args);
#         return { success: true, result };
#       } catch (error) {
#         return { success: false, error: error.message };
#       }
#     },
#   },
#   {
#     functionDeclarations: {
#       name: "getFileStatus",
#       description:
#         "Gets the detailed processing status for a single file. This includes the status of all its potential outputs (summary, text, transcript, etc.). You must find the file by providing one of the following: its hashed fileId, its original full path",
#       parameters: {
#         type: Type.OBJECT,
#         properties: {
#           fileId: {
#             type: Type.STRING,
#             description: "The unique MD5 hash ID of the file.",
#           },
#           originalPath: {
#             type: Type.STRING,
#             description: "The original absolute path of the file before it was processed.",
#           },
#           // originalFileName: {
#           //   type: Type.STRING,
#           //   description: "The original name of the file (e.g., 'mydocument.pdf').",
#           // },
#         },
#       },
#     },
#     functionExecutions: async (args: any) => {
#       if (!args.fileId && !args.originalPath && !args.originalFileName) {
#         return {
#           success: false,
#           error: "You must provide at least one of fileId, originalPath, or originalFileName.",
#         };
#       }
#       try {
#         const result = await window.electronAPI.getFileStatus(args);
#         return { success: true, result };
#       } catch (error) {
#         return { success: false, error: error.message };
#       }
#     },
#   },
#   {
#     functionDeclarations: {
#       name: "getFileContent",
#       description:
#         "Retrieves the actual text content of a generated file (e.g., a summary, a transcript, or a description). You must specify which file to look in (using fileId, originalPath, or originalFileName) and what type of content you want.",
#       parameters: {
#         type: Type.OBJECT,
#         properties: {
#           fileId: {
#             type: Type.STRING,
#             description: "The unique MD5 hash ID of the file.",
#           },
#           originalPath: {
#             type: Type.STRING,
#             description: "The original absolute path of the file before it was processed.",
#           },
#           originalFileName: {
#             type: Type.STRING,
#             description: "The original name of the file (e.g., 'my-image.png').",
#           },
#           contentType: {
#             type: Type.STRING,
#             description: "The type of content to retrieve.",
#             enum: [
#               "summary",
#               "text",
#               "description",
#               "transcript",
#               "transcript_with_timestamps",
#               "detailed_description",
#               "formatted_text",
#             ],
#           },
#         },
#         required: ["contentType"],
#       },
#     },
#     functionExecutions: async (args: any) => {
#       if (!args.fileId && !args.originalPath && !args.originalFileName) {
#         return {
#           success: false,
#           error: "You must provide at least one of fileId, originalPath, or originalFileName.",
#         };
#       }
#       try {
#         const result = await window.electronAPI.getFileContent(args, args.contentType);
#         return { success: true, result };
#       } catch (error) {
#         return { success: false, error: error.message };
#       }
#     },
#   },
#   {
#     functionDeclarations: {
#       name: "getActiveTab",
#       description:
#         "Gets information about the currently active tab in the browser. This is useful for knowing what the user is currently focused on.",
#       parameters: {
#         type: Type.OBJECT,
#         properties: {},
#         required: [],
#       },
#     },
#     functionExecutions: async (_args: any) => {
#       try {
#         const result = await window.electronAPI.getActiveTab();
#         return { success: true, result };
#       } catch (error) {
#         return { success: false, error: error.message };
#       }
#     },
#   },
#   {
#     functionDeclarations: {
#       name: "getFilesInContext",
#       description:
#         "Gets a list of all files that are currently available in the context window. This tool is useful for knowing what files are available to answer questions about.",
#       parameters: {
#         type: Type.OBJECT,
#         properties: {},
#         required: [],
#       },
#     },
#     functionExecutions: async (_args: any) => {
#       try {
#         const result = await window.electronAPI.getFilesInContext();
#         return { success: true, result };
#       } catch (error) {
#         return { success: false, error: error.message };
#       }
#     },
#   },
# ];
