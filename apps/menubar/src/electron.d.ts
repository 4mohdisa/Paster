export interface IElectronAPI {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => Promise<any>;
    on: (channel: string, callback: (...args: any[]) => void) => void;
    removeListener: (channel: string, callback: (...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;
    send: (channel: string, ...args: any[]) => void;
  };
}

declare global {
  interface Window {
    electron?: IElectronAPI;
  }
}

export {};