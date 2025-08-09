"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Save, 
  Keyboard, 
  FileText, 
  Settings, 
  RefreshCw,
  Info,
  CheckCircle,
  XCircle,
  Power
} from 'lucide-react';
import { toast } from 'sonner';

interface AiPasteSettings {
  outputFormat: string;
  usePrefixEnabled: boolean;
  userDefinedPrefix: string;
  shortcutModifiers: number;
  shortcutKeyCode: number;
  launchAtLogin: boolean;
}

export default function AiPasteSettingsPage() {
  const [settings, setSettings] = useState<AiPasteSettings>({
    outputFormat: 'simple',
    usePrefixEnabled: true,
    userDefinedPrefix: 'Below is a table. The symbol "|" denotes a separation in a column: ',
    shortcutModifiers: 3, // Cmd + Shift
    shortcutKeyCode: 9, // V key
    launchAtLogin: false
  });
  
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [daemonStatus, setDaemonStatus] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    checkSystemStatus();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('swift:get-settings');
      if (result.success && result.data) {
        setSettings(result.data);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const checkSystemStatus = async () => {
    try {
      // Check permissions
      const permResult = await window.electron.ipcRenderer.invoke('process:check-permissions');
      if (permResult.success && permResult.data) {
        setPermissionStatus(permResult.data.accessibility);
      }
      
      // Check daemon status
      const daemonResult = await window.electron.ipcRenderer.invoke('process:shortcuts-status');
      if (daemonResult.success) {
        setDaemonStatus(daemonResult.isRunning);
      }
    } catch (error) {
      console.error('Failed to check system status:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const result = await window.electron.ipcRenderer.invoke('swift:update-settings', settings);
      if (result.success) {
        toast.success('Settings saved successfully');
        
        // Restart daemon to apply new settings
        if (daemonStatus) {
          await restartDaemon();
        }
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const restartDaemon = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('process:restart-shortcuts');
      if (result.success) {
        toast.success('Shortcuts daemon restarted');
        setDaemonStatus(true);
      } else {
        toast.error('Failed to restart shortcuts daemon');
      }
    } catch (error) {
      console.error('Failed to restart daemon:', error);
      toast.error('Failed to restart daemon');
    }
  };

  const toggleDaemon = async () => {
    if (daemonStatus) {
      // Stop daemon
      try {
        const result = await window.electron.ipcRenderer.invoke('process:stop-shortcuts');
        if (result.success) {
          setDaemonStatus(false);
          toast.success('Shortcuts daemon stopped');
        }
      } catch (error) {
        console.error('Failed to stop daemon:', error);
        toast.error('Failed to stop daemon');
      }
    } else {
      // Start daemon
      try {
        const result = await window.electron.ipcRenderer.invoke('process:start-shortcuts');
        if (result.success) {
          setDaemonStatus(true);
          toast.success('Shortcuts daemon started');
        }
      } catch (error) {
        console.error('Failed to start daemon:', error);
        toast.error('Failed to start daemon');
      }
    }
  };

  const getShortcutDisplay = () => {
    const modifiers: string[] = [];
    if (settings.shortcutModifiers & 8) modifiers.push('Ctrl');
    if (settings.shortcutModifiers & 4) modifiers.push('Option');
    if (settings.shortcutModifiers & 2) modifiers.push('Shift');
    if (settings.shortcutModifiers & 1) modifiers.push('Cmd');
    
    // V key (keyCode 9)
    modifiers.push('V');
    
    return modifiers.join('+');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-8 py-8">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight mb-2">AiPaste Settings</h1>
              <p className="text-muted-foreground leading-relaxed max-w-2xl">
                Configure table formatting, keyboard shortcuts, and paste behavior
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted/20">
        <div className="container mx-auto px-8 py-8 space-y-8">
          
          {/* System Status */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-950 rounded-lg">
                  <Power className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">System Status</CardTitle>
                  <CardDescription>
                    Current status of AiPaste components
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Keyboard className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Shortcuts Daemon</p>
                      <p className="text-sm text-muted-foreground">
                        {daemonStatus ? 'Running' : 'Stopped'}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={toggleDaemon}
                    variant={daemonStatus ? "destructive" : "default"}
                    size="sm"
                  >
                    {daemonStatus ? 'Stop' : 'Start'}
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">Accessibility Permission</p>
                      <p className="text-sm text-muted-foreground">
                        {permissionStatus ? 'Granted' : 'Not Granted'}
                      </p>
                    </div>
                  </div>
                  {permissionStatus ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Table Formatting */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-950 rounded-lg">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Table Formatting</CardTitle>
                  <CardDescription>
                    Configure how tables are formatted when pasting
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-base font-medium">Output Format</Label>
                <Select 
                  value={settings.outputFormat} 
                  onValueChange={(value) => setSettings(prev => ({ ...prev, outputFormat: value }))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple (Pipe-separated)</SelectItem>
                    <SelectItem value="markdown">Markdown Table</SelectItem>
                    <SelectItem value="pretty-printed">Pretty-printed Table</SelectItem>
                    <SelectItem value="html">HTML Table</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Choose how your table data will be formatted
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">Use Prefix Text</Label>
                    <p className="text-sm text-muted-foreground">
                      Add explanatory text before the table
                    </p>
                  </div>
                  <Switch
                    checked={settings.usePrefixEnabled}
                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, usePrefixEnabled: checked }))}
                  />
                </div>
                
                {settings.usePrefixEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="prefix" className="text-base font-medium">
                      Prefix Text
                    </Label>
                    <Textarea
                      id="prefix"
                      value={settings.userDefinedPrefix}
                      onChange={(e) => setSettings(prev => ({ ...prev, userDefinedPrefix: e.target.value }))}
                      placeholder="Enter prefix text..."
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Keyboard Shortcut */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-950 rounded-lg">
                  <Keyboard className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Keyboard Shortcut</CardTitle>
                  <CardDescription>
                    Global shortcut for formatted paste
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Current shortcut: <strong>{getShortcutDisplay()}</strong>
                  <br />
                  <span className="text-xs">Shortcut customization coming soon</span>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Startup */}
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-950 rounded-lg">
                  <Power className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Startup</CardTitle>
                  <CardDescription>
                    Configure app startup behavior
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="space-y-1">
                  <div className="font-medium">Launch at Login</div>
                  <div className="text-sm text-muted-foreground">
                    Automatically start AiPaste when you log in
                  </div>
                </div>
                <Switch
                  checked={settings.launchAtLogin}
                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, launchAtLogin: checked }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={saveSettings}
              disabled={saving}
              className="h-12 px-8"
              size="lg"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}