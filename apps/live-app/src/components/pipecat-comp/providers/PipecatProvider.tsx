import { type PropsWithChildren } from "react";
import { PipecatClient } from "@pipecat-ai/client-js";
import { PipecatClientProvider } from "@pipecat-ai/client-react";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";

const pcClient = new PipecatClient({
  transport: new SmallWebRTCTransport({
    webrtcRequestParams: {
      endpoint: "http://localhost:7860/api/offer"
    }
  }),
  enableCam: false,
  enableMic: true,
  enableScreenShare: true,
  callbacks: {
    onConnected: () => {
      console.log("[CALLBACK] User connected");
    },
    onDisconnected: () => {
      console.log("[CALLBACK] User disconnected");
    },
    onTransportStateChanged: (state: string) => {
      console.log("[CALLBACK] State change:", state);
    },
    onBotConnected: () => {
      console.log("[CALLBACK] Bot connected");
    },
    onBotDisconnected: () => {
      console.log("[CALLBACK] Bot disconnected");
    },
    onBotReady: () => {
      console.log("[CALLBACK] Bot ready to chat!");
    },
    onError: (message: unknown) => {
      console.error("[CALLBACK] Error:", message);
    },
  },
});

export function PipecatProvider({ children }: PropsWithChildren) {

  return (
    <PipecatClientProvider client={pcClient}>{children}</PipecatClientProvider>
  );
}
