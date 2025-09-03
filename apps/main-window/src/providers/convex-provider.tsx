'use client';

import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ReactNode, useEffect, useState } from 'react';
import { toast } from '@aipaste/ui/components/sonner';

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<ConvexReactClient | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if Convex backend is healthy by directly pinging the HTTP endpoint
    const checkConvexHealth = async (url: string): Promise<boolean> => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const response = await fetch(url, { 
          signal: controller.signal,
          mode: 'no-cors' // Just check if endpoint responds
        });
        
        clearTimeout(timeoutId);
        return true; // If we get any response, backend is up
      } catch {
        return false;
      }
    };

    // Initialize Convex client with retries
    const initializeConvex = async () => {
      const MAX_RETRIES = 10;
      const RETRY_DELAY = 2000; // 2 seconds between retries
      const BACKEND_URL = 'http://127.0.0.1:52100';
      
      let retryCount = 0;
      let connected = false;
      
      // Show initial toast
      const toastId = toast.loading('Connecting to Convex backend...');
      
      while (retryCount < MAX_RETRIES && !connected) {
        try {
          // Check health directly via HTTP
          const isHealthy = await checkConvexHealth(BACKEND_URL);
          
          if (isHealthy) {
            // Backend is ready, create client
            const convexClient = new ConvexReactClient(BACKEND_URL);
            setClient(convexClient);
            setError(null);
            setIsReady(true);
            connected = true;
            
            toast.success('Connected to Convex backend', { id: toastId });
            console.log('Convex backend connected successfully');
          } else {
            throw new Error('Backend not responding');
          }
        } catch (err: any) {
          retryCount++;
          console.log(`Convex connection attempt ${retryCount}/${MAX_RETRIES} failed`);
          
          if (retryCount >= MAX_RETRIES) {
            // Final failure
            console.error('Failed to connect to Convex after all retries:', err);
            setError('Convex backend unavailable');
            setIsReady(true); // Still allow app to work offline
            
            toast.error('Please restart the app - Convex backend unavailable', { 
              id: toastId,
              duration: 5000 
            });
          } else {
            // Wait before retry
            toast.loading(`Retrying connection... (${retryCount}/${MAX_RETRIES})`, { id: toastId });
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          }
        }
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