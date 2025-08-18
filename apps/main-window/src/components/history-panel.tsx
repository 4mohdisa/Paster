'use client';

import { useClipboardHistory } from '@/hooks/use-clipboard-history';
import { Button, ScrollArea } from '@aipaste/ui/components';
import { formatDistanceToNow } from 'date-fns';
import { ClipboardPaste, Copy, FileText, Trash2 } from 'lucide-react';

export function HistoryPanel() {
  const { history, isLoading, copyItem, pasteItem, clearHistory, isConvexReady } = useClipboardHistory();

  if (!isConvexReady) {
    return (
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-4">Clipboard History</h3>
        <div className="text-center py-8 text-gray-500">
          <p>Connecting to database...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-4">Clipboard History</h3>
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Clipboard History</h3>
        {history.length > 0 && (
          <Button
            variant="ghost"
            onClick={clearHistory}
            className="text-red-500 hover:text-red-600 flex "
          >
            <Trash2 className="h-4 w-4" />
            Clear All
          </Button>
        )}
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No clipboard history yet</p>
          <p className="text-sm mt-1">Copy formatted text to see it here</p>
        </div>
      ) : (
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item._id}
                className="border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="font-medium">{item.format.toUpperCase()}</span>
                      <span>•</span>
                      <span>
                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyItem(item)}
                      title="Copy to clipboard"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => pasteItem(item)}
                      title="Paste now"
                    >
                      <ClipboardPaste className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Original:</p>
                    <pre className="text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded overflow-x-auto max-h-20">
                      {item.content}
                    </pre>
                  </div>

                  <div>
                    <p className="text-xs text-gray-500 mb-1">Formatted:</p>
                    <pre className="text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded overflow-x-auto max-h-20">
                      {item.formatted}
                    </pre>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}