'use client';

import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ReactNode, useEffect, useState } from 'react';

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<ConvexReactClient | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize Convex client with backend URL from Electron
    const initializeConvex = async () => {
      try {
        // Get Convex backend info from Electron
        const info = await window.electron.convex.getInfo();
        
        if (!info.data?.running) {
          // Backend should already be running (started by main process)
          // If not, wait and retry
          console.log('Waiting for Convex backend to be ready...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Try getting info again
          const retryInfo = await window.electron.convex.getInfo();
          if (!retryInfo.data?.running || !retryInfo.data?.backendUrl) {
            throw new Error('Convex backend is not running. Please restart the app.');
          }
          
          const convexClient = new ConvexReactClient(retryInfo.data.backendUrl);
          setClient(convexClient);
          setIsReady(true);
        } else if (info.data?.backendUrl) {
          const convexClient = new ConvexReactClient(info.data.backendUrl);
          setClient(convexClient);
          setIsReady(true);
        } else {
          throw new Error('Convex backend URL not available');
        }
      } catch (err: any) {
        console.error('Failed to initialize Convex:', err);
        setError(err.message);
        // Still mark as ready even if Convex fails - app can work without it
        setIsReady(true);
      }
    };

    // Listen for Convex events
    const handleConvexReady = (event: any, info: any) => {
      console.log('Convex backend ready:', info);
      if (info.backendUrl && !client) {
        const convexClient = new ConvexReactClient(info.backendUrl);
        setClient(convexClient);
        setError(null);
      }
    };

    const handleConvexError = (event: any, error: any) => {
      console.error('Convex backend error:', error);
      setError(error.message);
    };

    // Subscribe to events
    window.electron.ipcRenderer.on('convex-ready', handleConvexReady);
    window.electron.ipcRenderer.on('convex-error', handleConvexError);

    // Initialize
    initializeConvex();

    // Cleanup
    return () => {
      window.electron.ipcRenderer.removeListener('convex-ready', handleConvexReady);
      window.electron.ipcRenderer.removeListener('convex-error', handleConvexError);
    };
  }, []);

  // Show loading state
  if (!isReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-600">Initializing Convex backend...</p>
        </div>
      </div>
    );
  }

  // If no client but ready, render children without Convex (offline mode)
  if (!client) {
    console.warn('Running without Convex backend (offline mode)');
    return <>{children}</>;
  }

  // Render with Convex provider
  return (
    <ConvexProvider client={client}>
      {children}
    </ConvexProvider>
  );
}