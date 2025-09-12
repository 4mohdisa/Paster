import { createRoot } from "react-dom/client";
import React, { useEffect, useState } from "react";

import { PipecatProvider } from "./components/pipecat-comp/providers/PipecatProvider";
import ChatContainer3 from "./components/ChatContiner";

const App: React.FC = () => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(true);

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const key = await window.electronAPI.getApiKey();
        setApiKey(key || null);
      } catch (error) {
        console.error("Failed to fetch API key:", error);
        setApiKey(null);
      } finally {
        setIsLoadingApiKey(false);
      }
    };
    fetchApiKey();
  }, []);

  if (isLoadingApiKey) {
    return (
      <div className="w-full h-screen flex items-center justify-center text-neutral-700">
        Loading API key...
      </div>
    );
  }

  if (!apiKey) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center">
          <div className="text-lg font-semibold text-neutral-900 mb-1">
            API key not found
          </div>
          <div className="text-neutral-600">Please check your .env file.</div>
        </div>
      </div>
    );
  }

  // const isMini = typeof window !== 'undefined' && window.location.hash === '#mini';

  return (
    <div className="w-full h-screen overflow-hidden ">
      <PipecatProvider>
        <ChatContainer3 />
      </PipecatProvider>
    </div>
  );
};

export default App;

// Set body styles to remove default margins/padding and ensure full height
document.body.style.margin = "0";
document.body.style.padding = "0";
document.body.style.height = "100vh";
document.body.style.overflow = "hidden";

// Set html styles for full height
document.documentElement.style.height = "100vh";
document.documentElement.style.margin = "0";
document.documentElement.style.padding = "0";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
