'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider
} from '@/components/ui/sidebar';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle,
  FileText,
  HelpCircle,
  Home,
  Info
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SystemStatus {
  permissionGranted: boolean;
  daemonRunning: boolean;
  settings: {
    outputFormat: string;
    usePrefixEnabled: boolean;
    shortcut: string;
  };
}

interface PasteHistoryItem {
  id: string;
  timestamp: string;
  original: string;
  formatted: string;
  format: string;
  metadata?: {
    detectedAs: string;
    rowCount?: number;
    columnCount?: number;
  };
}

export default function Dashboard() {
  const [status, setStatus] = useState<SystemStatus>({
    permissionGranted: false,
    daemonRunning: false,
    settings: {
      outputFormat: 'simple',
      usePrefixEnabled: true,
      shortcut: 'Cmd+Shift+V'
    }
  });
  const [activeSection, setActiveSection] = useState('general');
  const [pasteHistory, setPasteHistory] = useState<PasteHistoryItem[]>([]);

  useEffect(() => {
    checkSystemStatus();

    // Set up periodic status check
    const interval = setInterval(checkSystemStatus, 5000);

    // Load initial history
    loadHistory();

    // Listen for history events from main process
    const handleHistoryAdded = (_event: any, _data: any) => {
      loadHistory(); // Reload full history
      toast.success('Clipboard formatted and saved!');
    };

    const handleShortcutTriggered = (_event: any, _data: any) => {
      toast.success('Pasted from history!');
    };

    const handleHistoryCleared = () => {
      setPasteHistory([]);
    };

    // Subscribe to events
    window.electron?.ipcRenderer?.on('history-item-added', handleHistoryAdded);
    window.electron?.ipcRenderer?.on('shortcut-triggered', handleShortcutTriggered);
    window.electron?.ipcRenderer?.on('history-cleared', handleHistoryCleared);

    return () => {
      clearInterval(interval);
      // Clean up event listeners
      window.electron?.ipcRenderer?.removeAllListeners('history-item-added');
      window.electron?.ipcRenderer?.removeAllListeners('shortcut-triggered');
      window.electron?.ipcRenderer?.removeAllListeners('history-cleared');
    };
  }, []);

  const loadHistory = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('history:get-all', 20);
      if (result.success && result.data) {
        setPasteHistory(result.data);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const checkSystemStatus = async () => {
    try {
      // Check permissions
      const permResult = await window.electron.ipcRenderer.invoke(
        'process:check-permissions'
      );
      const daemonResult = await window.electron.ipcRenderer.invoke(
        'process:shortcuts-status'
      );
      const settingsResult =
        await window.electron.ipcRenderer.invoke('swift:get-settings');

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
      console.error('Failed to check status:', error);
    }
  };

  const formatShortcut = (modifiers: number, _keyCode: number) => {
    const keys: string[] = [];
    if (modifiers & 1) keys.push('Cmd');
    if (modifiers & 2) keys.push('Shift');
    if (modifiers & 4) keys.push('Option');
    if (modifiers & 8) keys.push('Ctrl');
    keys.push('V'); // keyCode 9 is V
    return keys.join('+');
  };

  const allSystemsGo = status.permissionGranted && status.daemonRunning;

  const sidebarItems = [
    { id: 'general', label: 'General', icon: Home },
    { id: 'history', label: 'History', icon: FileText },
    { id: 'help', label: 'Help', icon: HelpCircle }
  ];

  const renderContent = () => {
    if (activeSection === 'general') {
      return (
        <div className="h-full">
          {/* Page Header */}
          <div className="border-b px-8 py-6">
            <h1 className="text-2xl font-semibold tracking-tight">General</h1>
            <p className="text-muted-foreground text-sm mt-1">Configure table formatting and system settings</p>
          </div>

          <div className="px-8 py-6">
            {/* Status Alert - Only show if there's an issue */}
            {!allSystemsGo && (
              <Alert className="mb-8 max-w-4xl">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  {!status.permissionGranted ?
                    'Grant accessibility permission in System Settings to enable clipboard monitoring.' :
                    'Starting services...'}
                </AlertDescription>
              </Alert>
            )}

            {/* Table Formatting Section */}
            <div className="space-y-8 max-w-4xl">
              <div>
                <h2 className="text-lg font-medium mb-1">Table Formatting</h2>
                <p className="text-sm text-muted-foreground mb-6">Configure how tables are formatted when pasting</p>

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
                          const result = await window.electron.ipcRenderer.invoke('swift:update-settings', newSettings);
                          if (result.success) {
                            toast.success('Settings updated');
                            await checkSystemStatus();
                            await window.electron.ipcRenderer.invoke('process:restart-shortcuts');
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
                      <p className="text-xs text-muted-foreground">Global shortcut for formatted paste</p>
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
                              const result = await window.electron.ipcRenderer.invoke('swift:update-settings', newSettings);
                              if (result.success) {
                                toast.success('Settings updated');
                                await checkSystemStatus();
                                await window.electron.ipcRenderer.invoke('process:restart-shortcuts');
                              }
                            }}
                          >
                            {status.settings.usePrefixEnabled ? 'Enabled' : 'Disabled'}
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">Add explanatory text before formatted tables</p>

                        {status.settings.usePrefixEnabled && (
                          <div className="space-y-3">
                            <Textarea
                              className="min-h-[80px] resize-none text-sm"
                              defaultValue={'Below is a table. The symbol "|" denotes a separation in a column: '}
                              placeholder="Enter prefix text..."
                              onBlur={async (e) => {
                                const newSettings = {
                                  outputFormat: status.settings.outputFormat,
                                  usePrefixEnabled: status.settings.usePrefixEnabled,
                                  userDefinedPrefix: e.target.value
                                };
                                const result = await window.electron.ipcRenderer.invoke('swift:update-settings', newSettings);
                                if (result.success) {
                                  toast.success('Prefix text updated');
                                  await checkSystemStatus();
                                  await window.electron.ipcRenderer.invoke('process:restart-shortcuts');
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

    if (activeSection === 'history') {
      return (
        <div className="h-full flex flex-col">
          {/* Page Header */}
          <div className="flex items-center justify-between border-b px-8 py-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">History</h1>
              <p className="text-muted-foreground text-sm mt-1">Auto-formatted clipboard items ready to paste</p>
            </div>
            {pasteHistory.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await window.electron.ipcRenderer.invoke('history:clear');
                  setPasteHistory([]);
                  toast.success('History cleared');
                }}
              >
                Clear All
              </Button>
            )}
          </div>

          {/* History Content */}
          <div className="px-8 py-6 overflow-y-auto">
            {pasteHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium mb-2">No clipboard history yet</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  Copy spreadsheet data to automatically format and save to your history
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {pasteHistory.map((item, index) => (
                  <div
                    key={item.id}
                    className="group relative border-b border-border hover:bg-muted/30 transition-colors duration-200 cursor-pointer py-4"
                    onClick={async () => {
                      const result = await window.electron.ipcRenderer.invoke('history:copy-item', item.id);
                      if (result.success) {
                        toast.success('Copied to clipboard!');
                      } else {
                        toast.error('Failed to copy');
                      }
                    }}
                  >
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1 min-w-0">
                        {/* Header with metadata */}
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {item.format !== 'simple' && (
                            <Badge variant="outline" className="text-[10px] h-5">
                              {item.format}
                            </Badge>
                          )}
                          {item.metadata?.rowCount && item.metadata?.columnCount && (
                            <span className="text-xs text-muted-foreground">
                              {item.metadata.rowCount}×{item.metadata.columnCount} table
                            </span>
                          )}
                        </div>

                        {/* Content preview */}
                        <div className="font-mono text-xs text-muted-foreground leading-relaxed">
                          {item.formatted.substring(0, 150)}
                          {item.formatted.length > 150 && (
                            <span className="text-muted-foreground/60">...</span>
                          )}
                        </div>
                      </div>

                      {/* Hover indicator */}
                      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs text-muted-foreground">Click to copy</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (activeSection === 'help') {
      return (
        <div className="h-full">
          {/* Page Header */}
          <div className="border-b px-8 py-6">
            <h1 className="text-2xl font-semibold tracking-tight">Help</h1>
            <p className="text-muted-foreground text-sm mt-1">Learn how to use AiPaste effectively</p>
          </div>

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
                        Select and copy from Excel, Google Sheets, Numbers, or any application with tabular data
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
                        AiPaste detects table structure and formats it instantly in the background according to your preferences
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
                        Use <Badge variant="secondary" className="font-mono text-xs mx-1">{status.settings.shortcut}</Badge> to paste your formatted table anywhere
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
                          <span>Your original clipboard stays unchanged - use <Badge variant="outline" className="font-mono text-xs mx-1">Cmd+V</Badge> for unformatted data</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-muted-foreground/60 mt-1">•</span>
                          <span>Click any item in your history to paste it again</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-muted-foreground/60 mt-1">•</span>
                          <span>Customize formatting in General settings to match your workflow</span>
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
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b px-4 py-3">
          <div className="h-4"></div>
        </SidebarHeader>
        <SidebarContent className="px-2">
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
      <main className="flex-1 overflow-auto">
        {renderContent()}
      </main>
    </SidebarProvider>
  );
}