"use client";

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  Textarea
} from "@aipaste/ui/components";
import { CheckCircle, FileText, HelpCircle, Home, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { HistoryPanel } from "./history-panel";

interface SystemStatus {
  permissionGranted: boolean;
  daemonRunning: boolean;
  settings: {
    outputFormat: string;
    usePrefixEnabled: boolean;
    shortcut: string;
  };
}


export default function Dashboard() {
  const [status, setStatus] = useState<SystemStatus>({
    permissionGranted: false,
    daemonRunning: false,
    settings: {
      outputFormat: "simple",
      usePrefixEnabled: true,
      shortcut: "Cmd+Shift+V"
    }
  });
  const [activeSection, setActiveSection] = useState("general");

  useEffect(() => {
    checkSystemStatus();

    // Set up periodic status check
    const interval = setInterval(checkSystemStatus, 5000);

    // Listen for shortcut events
    const handleShortcutTriggered = (_event: any, _data: any) => {
      toast.success("Pasted from history!");
    };

    // Subscribe to events
    window.electron?.ipcRenderer?.on("shortcut-triggered", handleShortcutTriggered);

    return () => {
      clearInterval(interval);
      // Clean up event listeners
      window.electron?.ipcRenderer?.removeAllListeners("shortcut-triggered");
    };
  }, []);

  const checkSystemStatus = async () => {
    try {
      // Check permissions
      const permResult = await window.electron.ipcRenderer.invoke("process:check-permissions");
      const daemonResult = await window.electron.ipcRenderer.invoke("process:shortcuts-status");
      const settingsResult = await window.electron.ipcRenderer.invoke("swift:get-settings");

      setStatus((prev) => ({
        ...prev,
        permissionGranted: permResult.data?.accessibility || false,
        daemonRunning: daemonResult.isRunning || false,
        settings: settingsResult.data
          ? {
              outputFormat: settingsResult.data.outputFormat,
              usePrefixEnabled: settingsResult.data.usePrefixEnabled,
              shortcut: formatShortcut(
                settingsResult.data.shortcutModifiers,
                settingsResult.data.shortcutKeyCode
              )
            }
          : prev.settings
      }));
    } catch (error) {
      console.error("Failed to check status:", error);
    }
  };

  const formatShortcut = (modifiers: number, _keyCode: number) => {
    const keys: string[] = [];
    if (modifiers & 1) keys.push("Cmd");
    if (modifiers & 2) keys.push("Shift");
    if (modifiers & 4) keys.push("Option");
    if (modifiers & 8) keys.push("Ctrl");
    keys.push("V"); // keyCode 9 is V
    return keys.join("+");
  };

  const allSystemsGo = status.permissionGranted && status.daemonRunning;

  const sidebarItems = [
    { id: "general", label: "General", icon: Home },
    { id: "history", label: "History", icon: FileText },
    { id: "help", label: "Help", icon: HelpCircle }
  ];

  const renderContent = () => {
    if (activeSection === "general") {
      return (
        <div className="h-full">
          <div className="px-8 py-6">
            {/* Status Alert - Only show if there's an issue */}
            {!allSystemsGo && (
              <Alert className="mb-8 max-w-4xl">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {!status.permissionGranted
                    ? "Grant accessibility permission in System Settings to enable clipboard monitoring."
                    : "Starting services..."}
                </AlertDescription>
              </Alert>
            )}

            {/* Table Formatting Section */}
            <div className="space-y-8 max-w-4xl">
              <div>
                <h2 className="text-lg font-medium mb-1">Table Formatting</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Configure how tables are formatted when pasting
                </p>

                <div className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Output Format</Label>
                      <Select
                        value={status.settings.outputFormat}
                        onValueChange={async (value) => {
                          const newSettings = {
                            outputFormat: value,
                            usePrefixEnabled: status.settings.usePrefixEnabled
                          };
                          const result = await window.electron.ipcRenderer.invoke(
                            "swift:update-settings",
                            newSettings
                          );
                          if (result.success) {
                            toast.success("Settings updated");
                            await checkSystemStatus();
                            await window.electron.ipcRenderer.invoke("process:restart-shortcuts");
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select format" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="simple">Simple (Pipe-separated)</SelectItem>
                          <SelectItem value="markdown">Markdown Table</SelectItem>
                          <SelectItem value="pretty-printed">Pretty-printed Table</SelectItem>
                          <SelectItem value="html">HTML Table</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Keyboard Shortcut</Label>
                      <div className="flex items-center h-9 px-3 py-1 text-sm bg-muted rounded-md border">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {status.settings.shortcut}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Global shortcut for formatted paste
                      </p>
                    </div>
                  </div>

                  <div className="pt-6 border-t">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <h3 className="text-sm font-medium">Prefix Text</h3>
                          <Button
                            variant={status.settings.usePrefixEnabled ? "secondary" : "outline"}
                            size="sm"
                            onClick={async () => {
                              const newSettings = {
                                outputFormat: status.settings.outputFormat,
                                usePrefixEnabled: !status.settings.usePrefixEnabled
                              };
                              const result = await window.electron.ipcRenderer.invoke(
                                "swift:update-settings",
                                newSettings
                              );
                              if (result.success) {
                                toast.success("Settings updated");
                                await checkSystemStatus();
                                await window.electron.ipcRenderer.invoke(
                                  "process:restart-shortcuts"
                                );
                              }
                            }}
                          >
                            {status.settings.usePrefixEnabled ? "Enabled" : "Disabled"}
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                          Add explanatory text before formatted tables
                        </p>

                        {status.settings.usePrefixEnabled && (
                          <div className="space-y-3">
                            <Textarea
                              className="min-h-[80px] resize-none text-sm"
                              defaultValue={
                                'Below is a table. The symbol "|" denotes a separation in a column: '
                              }
                              placeholder="Enter prefix text..."
                              onBlur={async (e) => {
                                const newSettings = {
                                  outputFormat: status.settings.outputFormat,
                                  usePrefixEnabled: status.settings.usePrefixEnabled,
                                  userDefinedPrefix: e.target.value
                                };
                                const result = await window.electron.ipcRenderer.invoke(
                                  "swift:update-settings",
                                  newSettings
                                );
                                if (result.success) {
                                  toast.success("Prefix text updated");
                                  await checkSystemStatus();
                                  await window.electron.ipcRenderer.invoke(
                                    "process:restart-shortcuts"
                                  );
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeSection === "history") {
      return (
        <div className="h-full flex flex-col">
          <div className="px-8 py-6 overflow-y-auto">
            <HistoryPanel />
          </div>
        </div>
      );
    }

    if (activeSection === "help") {
      return (
        <div className="h-full">
          <div className="px-8 py-6">
            {/* How it works */}
            <div className="space-y-8 max-w-3xl">
              <div>
                <h2 className="text-lg font-medium mb-6">How It Works</h2>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-semibold">
                        1
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium mb-2">Copy spreadsheet data</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Select and copy from Excel, Google Sheets, Numbers, or any application with
                        tabular data
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-semibold">
                        2
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium mb-2">Automatic formatting</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        AiPaste detects table structure and formats it instantly in the background
                        according to your preferences
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-semibold">
                        3
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium mb-2">Paste formatted</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        Use{" "}
                        <Badge variant="secondary" className="font-mono text-xs mx-1">
                          {status.settings.shortcut}
                        </Badge>{" "}
                        to paste your formatted table anywhere
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tips and notes */}
              <div className="pt-8 border-t">
                <div className="bg-muted/30 rounded-xl p-6">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium mb-3">Pro Tips</h3>
                      <ul className="text-sm text-muted-foreground space-y-2.5">
                        <li className="flex items-start gap-2">
                          <span className="text-muted-foreground/60 mt-1">•</span>
                          <span>
                            Your original clipboard stays unchanged - use{" "}
                            <Badge variant="outline" className="font-mono text-xs mx-1">
                              Cmd+V
                            </Badge>{" "}
                            for unformatted data
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-muted-foreground/60 mt-1">•</span>
                          <span>Click any item in your history to paste it again</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-muted-foreground/60 mt-1">•</span>
                          <span>
                            Customize formatting in General settings to match your workflow
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-screen w-full">
        <Sidebar collapsible="none" className="border-r w-40">
          {/* <SidebarHeader className="border-b">
            <div className="flex h-14 items-center px-4">
              <h2 className="text-lg font-semibold">AiPaste</h2>
            </div>
          </SidebarHeader> */}
          <SidebarContent className="p-2">
            <SidebarMenu>
              {sidebarItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    onClick={() => setActiveSection(item.id)}
                    isActive={activeSection === item.id}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        {/* Main Content */}
        <main className="flex-1 overflow-auto">{renderContent()}</main>
      </div>
    </SidebarProvider>
  );
}
