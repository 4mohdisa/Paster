'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { Alert, AlertDescription } from '@aipaste/ui/components/alert';
import { FileText, Clock, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

export function FileConversionPanel() {
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [processingResult, setProcessingResult] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);

  // Convex hooks - just for reading history, saving is handled by provider
  const conversionHistory = useQuery(api.conversionHistory.getRecentConversions, { limit: 10 });


  // Get current Finder selection using existing IPC pattern
  const getFinderSelection = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('kash:get-finder-selection');
      if (result.success) {
        setSelectedFiles(result.files || []);
        toast.success(`Found ${result.files?.length || 0} selected files`);

        // Auto-convert if files are selected
        if (result.files && result.files.length > 0) {
          processFiles();
        }
      } else {
        toast.error('No files selected in Finder');
      }
    } catch (error) {
      console.error('Error getting Finder selection:', error);
      toast.error('Error getting Finder selection');
    }
  };

  // Process files with test action
  const processFiles = async () => {
    if (selectedFiles.length === 0) {
      toast.error('No files selected');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await window.electron.ipcRenderer.invoke('kash:process-files', {
        action: 'test-process',
        files: selectedFiles
      });

      if (result.success) {
        setProcessingResult(result);
        toast.success('Files processed successfully!');
      } else {
        toast.error(result.error || 'Processing failed');
      }
    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Error processing files');
    } finally {
      setIsProcessing(false);
    }
  };


  // Start monitoring Finder selection
  const toggleMonitoring = async () => {
    try {
      if (isMonitoring) {
        await window.electron.ipcRenderer.invoke('kash:stop-selection-monitor');
        setIsMonitoring(false);
        toast.success('Stopped monitoring');

        // Remove listener
        window.electron.ipcRenderer.removeAllListeners('kash:selection-changed');
      } else {
        const result = await window.electron.ipcRenderer.invoke('kash:start-selection-monitor');
        if (result.success) {
          setIsMonitoring(true);
          toast.success('Started monitoring Finder selection');

          // Listen for selection changes
          window.electron.ipcRenderer.on('kash:selection-changed', (_event: any, data: any) => {
            setSelectedFiles(data.files || []);
            toast.info(`Selection changed: ${data.files?.length || 0} files`);
          });
        } else {
          toast.error('Failed to start monitoring');
        }
      }
    } catch (error) {
      console.error('Error toggling monitor:', error);
      toast.error('Error toggling monitor');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title and Description */}
      <div>
        <h2 className="text-lg font-medium mb-1">Document Conversion</h2>
        <p className="text-sm text-muted-foreground">
          Automatically converts documents to Markdown format
        </p>
      </div>


      {/* Actions - simplified for automatic operation */}
      <div className="space-y-4">

        {/* Selected Files */}
        {selectedFiles.length > 0 && (
          <div className="bg-muted rounded-lg p-4">
            <div className="text-sm font-medium mb-2">
              Selected Files ({selectedFiles.length}):
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {selectedFiles.map((file, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs truncate">{file}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Processing Result */}
      {processingResult && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="text-sm font-medium mb-3">Conversion Complete</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Original File:</p>
              <p className="font-mono text-sm">{processingResult.original_file || selectedFiles[0]}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Converted File:</p>
              <p className="font-mono text-sm">{processingResult.workspace_path || 'Processing...'}</p>
            </div>
            {processingResult.markdown_preview && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                <div className="bg-muted rounded p-3 text-sm max-h-40 overflow-y-auto">
                  {processingResult.markdown_preview.substring(0, 200)}...
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <Alert>
        <AlertDescription className='py-4'>
          <strong>How it works:</strong>
          <p className="mt-2 text-sm">
            Select any document in Finder and press <kbd className="px-1 py-0.5 text-xs bg-muted rounded">Cmd+Shift+K</kbd> to instantly convert it to Markdown.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Supports: DOCX, HTML, PDF, and more
          </p>
        </AlertDescription>
      </Alert>

      {/* Conversion History */}
      {conversionHistory && conversionHistory.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Recent Conversions</h3>
          <div className="space-y-2">
            {conversionHistory.map((item) => (
              <div key={item._id} className="bg-card rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {item.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.originalName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.fromFormat.toUpperCase()} → {item.toFormat.toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>

                {item.success && (
                  <div className="pl-6 space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">Output:</span>
                      <span className="font-mono truncate">{item.convertedName}</span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono truncate">
                      {item.convertedPath}
                    </div>
                  </div>
                )}

                {item.error && (
                  <p className="pl-6 text-xs text-red-500">{item.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}