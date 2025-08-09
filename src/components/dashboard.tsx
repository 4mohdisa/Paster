'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider
} from '@/components/ui/sidebar';
import {
  Activity,
  CheckCircle,
  FileText,
  HelpCircle,
  Home,
  Info,
  Power,
  XCircle
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
  timestamp: string;
  message: string;
  data?: string;
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
  const [activeSection, setActiveSection] = useState('overview');
  const [pasteHistory, setPasteHistory] = useState<PasteHistoryItem[]>([]);

  useEffect(() => {
    checkSystemStatus();

    // Set up periodic status check
    const interval = setInterval(checkSystemStatus, 5000);

    // Listen for shortcut events from main process
    const handleShortcutTriggered = (_event: any, data: any) => {
      setPasteHistory((prev) => {
        const newItem: PasteHistoryItem = {
          timestamp: data.timestamp || new Date().toISOString(),
          message: data.message || 'Paste executed',
          data: data.data
        };
        // Keep last 10 items
        return [newItem, ...prev.slice(0, 9)];
      });
      toast.success('Paste formatted!');
    };

    // Subscribe to shortcut events
    window.electron?.ipcRenderer?.on(
      'shortcut-triggered',
      handleShortcutTriggered
    );

    return () => {
      clearInterval(interval);
      // Clean up event listener
      window.electron?.ipcRenderer?.removeAllListeners('shortcut-triggered');
    };
  }, []);

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

  const toggleDaemon = async () => {
    try {
      if (status.daemonRunning) {
        const result = await window.electron.ipcRenderer.invoke(
          'process:stop-shortcuts'
        );
        if (result.success) {
          toast.success('Shortcuts daemon stopped');
          setStatus((prev) => ({ ...prev, daemonRunning: false }));
        }
      } else {
        const result = await window.electron.ipcRenderer.invoke(
          'process:start-shortcuts'
        );
        if (result.success) {
          toast.success('Shortcuts daemon started');
          setStatus((prev) => ({ ...prev, daemonRunning: true }));
        }
      }
    } catch (error) {
      console.error('Failed to toggle daemon:', error);
      toast.error('Failed to toggle shortcuts daemon');
    }
  };

  const getFormatDescription = (format: string) => {
    switch (format) {
      case 'simple':
        return 'Pipe-separated table';
      case 'markdown':
        return 'Markdown formatted table';
      case 'pretty-printed':
        return 'Pretty-printed with borders';
      case 'html':
        return 'HTML table tags';
      default:
        return format;
    }
  };

  const allSystemsGo = status.permissionGranted && status.daemonRunning;

  const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'status', label: 'System Status', icon: Activity },
    { id: 'history', label: 'Paste History', icon: FileText },
    { id: 'help', label: 'Help & Guide', icon: HelpCircle }
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* System Status Alert */}
            {allSystemsGo ? (
              <Alert className="border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  <strong>All systems operational!</strong> Press{' '}
                  {status.settings.shortcut} to paste formatted tables.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/20">
                <Info className="h-4 w-4 text-orange-500" />
                <AlertDescription>
                  <strong>Action required:</strong>{' '}
                  {!status.permissionGranted &&
                    'Grant accessibility permission. '}
                  {!status.daemonRunning && 'Start the shortcuts daemon.'}
                </AlertDescription>
              </Alert>
            )}

            {/* Current Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle>Current Settings</CardTitle>
                <CardDescription>Your active configuration</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium">Output Format</span>
                  <Badge variant="outline">
                    {getFormatDescription(status.settings.outputFormat)}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium">Prefix Text</span>
                  <Badge variant="outline">
                    {status.settings.usePrefixEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium">Global Shortcut</span>
                  <Badge>{status.settings.shortcut}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'status':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>System Components</CardTitle>
                <CardDescription>Core services and permissions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-muted/50 flex items-center justify-between rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Power className="text-muted-foreground h-5 w-5" />
                    <div>
                      <p className="font-medium">Accessibility Permission</p>
                      <p className="text-muted-foreground text-sm">
                        Required for global shortcuts
                      </p>
                    </div>
                  </div>
                  {status.permissionGranted ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>

                <div className="bg-muted/50 flex items-center justify-between rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <Activity className="text-muted-foreground h-5 w-5" />
                    <div>
                      <p className="font-medium">Shortcuts Daemon</p>
                      <p className="text-muted-foreground text-sm">
                        Monitors keyboard shortcuts
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {status.daemonRunning ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <Button
                      onClick={toggleDaemon}
                      variant={status.daemonRunning ? 'secondary' : 'default'}
                      size="sm"
                      disabled={!status.permissionGranted}
                    >
                      {status.daemonRunning ? 'Stop' : 'Start'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'history':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Paste History</CardTitle>
                <CardDescription>
                  Recent paste operations triggered by shortcuts
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pasteHistory.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center">
                    <FileText className="mx-auto mb-3 h-12 w-12 opacity-50" />
                    <p>No paste activity yet</p>
                    <p className="mt-1 text-sm">
                      Press {status.settings.shortcut} to paste formatted text
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pasteHistory.map((item, index) => (
                      <div
                        key={index}
                        className="bg-muted/50 rounded-lg border p-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {new Date(item.timestamp).toLocaleTimeString()}
                              </Badge>
                              <span className="text-sm font-medium">
                                {item.message}
                              </span>
                            </div>
                            {item.data && (
                              <div className="mt-2">
                                <pre className="text-muted-foreground bg-background overflow-x-auto rounded p-2 font-mono text-xs">
                                  {item.data.substring(0, 200)}
                                  {item.data.length > 200 ? '...' : ''}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'help':
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>How to Use AiPaste</CardTitle>
                <CardDescription>
                  Simple steps to format your tables
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-4">
                  <li className="flex gap-3">
                    <div className="bg-primary/10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                      1
                    </div>
                    <div>
                      <p className="font-medium">Copy from spreadsheet</p>
                      <p className="text-muted-foreground text-sm">
                        Select and copy data from Excel, Google Sheets, or any
                        spreadsheet app
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="bg-primary/10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                      2
                    </div>
                    <div>
                      <p className="font-medium">
                        Press {status.settings.shortcut}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Use the global shortcut to paste as a formatted table
                      </p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="bg-primary/10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                      3
                    </div>
                    <div>
                      <p className="font-medium">Enjoy formatted table</p>
                      <p className="text-muted-foreground text-sm">
                        Your data is instantly formatted according to your
                        settings
                      </p>
                    </div>
                  </li>
                </ol>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <SidebarProvider>
      <Sidebar style={{ '--sidebar-width': '11rem' } as React.CSSProperties}>
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
      <main className="p-6">
        {renderContent()}
      </main>
    </SidebarProvider>
  );
}
