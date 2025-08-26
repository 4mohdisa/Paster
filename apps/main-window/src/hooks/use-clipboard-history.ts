'use client';

import { useQuery, useMutation } from 'convex/react';
import { api } from '../../../../convex/_generated/api';
import { useEffect, useState } from 'react';
import { toast } from '@aipaste/ui/components/sonner';

export interface ClipboardHistoryItem {
  _id: string;
  content: string;
  formatted: string;
  format: string;
  timestamp: number;
}

export function useClipboardHistory() {
  const [isConvexReady, setIsConvexReady] = useState(false);

  // Query history from Convex
  const convexHistory = useQuery(api.clipboardHistory.list,
    isConvexReady ? { limit: 50 } : 'skip'
  );

  // Mutations
  const addToHistory = useMutation(api.clipboardHistory.add);
  const clearHistory = useMutation(api.clipboardHistory.clear);

  // Listen for Convex ready event
  useEffect(() => {
    const handleConvexReady = () => {
      console.log('Convex is ready, enabling queries');
      setIsConvexReady(true);
    };

    // Check if Convex is already ready
    window.electron.convex.getInfo().then((info) => {
      if (info.data?.running) {
        setIsConvexReady(true);
      }
    });

    // Listen for ready event
    window.electron.ipcRenderer.on('convex-ready', handleConvexReady);

    return () => {
      window.electron.ipcRenderer.removeListener('convex-ready', handleConvexReady);
    };
  }, []);

  // Copy item to clipboard
  const copyItem = async (item: ClipboardHistoryItem) => {
    try {
      await navigator.clipboard.writeText(item.formatted);
      toast.success('Copied to clipboard');

      // Notify Electron about the copy
      window.electron.ipcRenderer.send('history-copied', {
        id: item._id,
        content: item.formatted
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast.error('Failed to copy to clipboard');
    }
  };

  // Paste item (trigger system paste)
  const pasteItem = async (item: ClipboardHistoryItem) => {
    try {
      // Set clipboard content
      await navigator.clipboard.writeText(item.formatted);

      // Trigger system paste via Electron
      await window.electron.executePaste({
        content: item.formatted,
        format: item.format
      });

      toast.success('Pasted');

      // Notify Electron about the paste
      window.electron.ipcRenderer.send('history-pasted', {
        id: item._id,
        content: item.formatted
      });
    } catch (error) {
      console.error('Failed to paste:', error);
      toast.error('Failed to paste');
    }
  };

  // Clear all history
  const clearAll = async () => {
    try {
      await clearHistory({});
      toast.success('History cleared');
    } catch (error) {
      console.error('Failed to clear history:', error);
      toast.error('Failed to clear history');
    }
  };

  return {
    history: convexHistory || [],
    isLoading: !isConvexReady || convexHistory === undefined,
    copyItem,
    pasteItem,
    clearHistory: clearAll,
    isConvexReady
  };
}