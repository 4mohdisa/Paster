import React from "react";

import { FileProcessingStatus, FileStatus } from "../types/electron-api";

interface ContentVariant {
  contentType: string;
  status: string;
  key: string;
  displayName: string;
}

interface FilePillsProps {
  files: FileProcessingStatus[];
  contentInContext: Set<string>; // "fileId-contentType" combinations
  onAddContentToContext: (fileId: string, fileName: string, contentType: string) => void;
}

const FilePills: React.FC<FilePillsProps> = ({ files, contentInContext, onAddContentToContext }) => {
  const truncateFileName = (fileName: string, maxLength: number = 25): string => {
    if (fileName.length <= maxLength) {
      return fileName;
    }
    return fileName.substring(0, maxLength - 3) + "...";
  };

  const getContentTypeDisplayName = (contentType: string): string => {
    const displayNames: { [key: string]: string } = {
      'summary': 'Summary',
      'text': 'Text',
      'description': 'Description',
      'transcript': 'Transcript',
      'transcript_with_timestamps': 'Transcript + Times',
      'detailed_description': 'Detailed Desc',
      'formatted_text': 'Formatted Text',
    };
    return displayNames[contentType] || contentType;
  };

  const getFileContentVariants = (file: FileProcessingStatus): ContentVariant[] => {
    const variants: ContentVariant[] = [];
    const contentTypeMap: { [key: string]: string } = {
      summaryFile: 'summary',
      textFile: 'text',
      descriptionFile: 'description',
      transcriptFile: 'transcript',
      transcriptWithTimestampsFile: 'transcript_with_timestamps',
      detailedDescriptionFile: 'detailed_description',
      formattedTextFile: 'formatted_text',
    };

    Object.entries(contentTypeMap).forEach(([fileKey, contentType]) => {
      const fileStatus = (file as any)[fileKey] as FileStatus | undefined;
      // Only show pills for content types that have a meaningful status
      if (
        fileStatus && 
        fileStatus.status &&
        ['pending', 'processing', 'completed', 'error'].includes(fileStatus.status)
      ) {
        variants.push({
          contentType,
          status: fileStatus.status,
          key: `${file.fileId}-${contentType}`,
          displayName: getContentTypeDisplayName(contentType),
        });
      }
    });

    return variants;
  };

  const getVariantStatusColor = (status: string, isInContext: boolean): string => {
    if (isInContext) {
      return "bg-blue-500 text-white hover:bg-blue-600"; // In context
    }

    switch (status) {
    case "pending":
    case "processing":
      return "bg-yellow-200 text-yellow-800 hover:bg-yellow-300"; // Processing
    case "error":
      return "bg-red-200 text-red-800 hover:bg-red-300"; // Error
    case "completed":
      return "bg-gray-200 text-gray-800 hover:bg-gray-300"; // Available
    case "skipped":
      return "bg-gray-100 text-gray-500 hover:bg-gray-200"; // Skipped
    default:
      return "bg-gray-200 text-gray-800 hover:bg-gray-300";
    }
  };

  const handleVariantClick = (file: FileProcessingStatus, contentType: string) => {
    const contentKey = `${file.fileId}-${contentType}`;
    const variant = getFileContentVariants(file).find(v => v.contentType === contentType);
    
    if (variant?.status === "completed" && !contentInContext.has(contentKey)) {
      const fileName = file.fileName + file.fileExtension;
      onAddContentToContext(file.fileId, fileName, contentType);
    }
  };

  if (files.length === 0) {
    return (
      <div className="flex flex-col gap-3 p-2 h-64 overflow-y-auto">
        <div className="text-sm text-gray-400 italic text-center">No files available</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-2 h-64 overflow-y-auto">
      {files.map(file => {
        const variants = getFileContentVariants(file);
        const activeVariants = variants.filter(v => contentInContext.has(v.key));
        const availableVariants = variants.filter(v => !contentInContext.has(v.key));
        const fileName = file.fileName + file.fileExtension;

        return (
          <div key={file.fileId} className="border border-gray-200 rounded-lg p-3">
            {/* File Header */}
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              {truncateFileName(fileName)}
            </h3>

            {/* Active Content Pills */}
            {activeVariants.length > 0 ? (
              <div className="mb-3">
                <h4 className="text-[10px] font-semibold text-blue-600 mb-2 uppercase tracking-wide">
                  IN CONTEXT
                </h4>
                <div className="flex flex-wrap gap-1">
                  {activeVariants.map(variant => (
                    <button
                      key={variant.key}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-colors cursor-default h-6 ${
                        getVariantStatusColor(variant.status, true)
                      }`}
                      disabled={true}
                    >
                      {variant.displayName}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-3">
                <h4 className="text-[10px] font-semibold text-blue-600 mb-2 uppercase tracking-wide">
                  IN CONTEXT
                </h4>
                <div className="text-xs text-gray-400 italic">No active context</div>
              </div>
            )}

            {/* Available Content Pills */}
            {availableVariants.length > 0 ? (
              <div>
                <h4 className="text-[10px] font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                  AVAILABLE
                </h4>
                <div className="flex flex-wrap gap-1">
                  {availableVariants.map(variant => (
                    <button
                      key={variant.key}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-colors h-6 ${
                        getVariantStatusColor(variant.status, false)
                      } ${
                        variant.status === "completed"
                          ? "cursor-pointer"
                          : "cursor-default"
                      }`}
                      onClick={() => handleVariantClick(file, variant.contentType)}
                      disabled={variant.status !== "completed"}
                    >
                      {variant.displayName}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <h4 className="text-[10px] font-semibold text-gray-600 mb-2 uppercase tracking-wide">
                  AVAILABLE
                </h4>
                <div className="text-xs text-gray-400 italic">No available data</div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default FilePills;