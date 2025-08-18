"use client";

import { Alert, AlertDescription, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@aipaste/ui/components';
import { ArrowRight, CheckCircle, Clipboard, Keyboard, Loader2, Shield, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface OnboardingProps {
  onComplete: () => void;
}

type OnboardingStep = 'welcome' | 'permissions' | 'test' | 'complete';

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [hasPermission, setHasPermission] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);
  const [_daemonRunning, setDaemonRunning] = useState(false); // Prefixed with _ to indicate it's intentionally unused for now

  // Check permission status on mount
  useEffect(() => {
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = async () => {
    setIsChecking(true);
    try {
      const result = await window.electron.ipcRenderer.invoke('process:check-permissions');
      if (result.success && result.data) {
        setHasPermission(result.data.accessibility);

        // If already has permission, check daemon status
        if (result.data.accessibility) {
          checkDaemonStatus();
        }
      }
    } catch (error) {
      console.error('Failed to check permissions:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const checkDaemonStatus = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('process:shortcuts-status');
      if (result.success) {
        setDaemonRunning(result.isRunning);
      }
    } catch (error) {
      console.error('Failed to check daemon status:', error);
    }
  };

  const requestPermission = async () => {
    setIsRequesting(true);
    try {
      const result = await window.electron.ipcRenderer.invoke('process:request-permission');

      if (result.success) {
        if (result.granted) {
          setHasPermission(true);
          // Start the daemon after permission granted
          await startDaemon();
          setCurrentStep('test');
        } else {
          // Start polling for permission
          pollForPermission();
        }
      }
    } catch (error) {
      console.error('Failed to request permission:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const pollForPermission = () => {
    const interval = setInterval(async () => {
      const result = await window.electron.ipcRenderer.invoke('process:check-permissions');
      if (result.success && result.data?.accessibility) {
        clearInterval(interval);
        setHasPermission(true);
        await startDaemon();
        setCurrentStep('test');
      }
    }, 1000);

    // Stop polling after 60 seconds
    setTimeout(() => clearInterval(interval), 60000);
  };

  const startDaemon = async () => {
    try {
      const result = await window.electron.ipcRenderer.invoke('process:start-shortcuts');
      if (result.success) {
        setDaemonRunning(true);
      }
    } catch (error) {
      console.error('Failed to start daemon:', error);
    }
  };

  const testPaste = async () => {
    try {
      // Copy test data to clipboard
      await navigator.clipboard.writeText('Name\tAge\tCity\nJohn\t30\tNew York\nJane\t25\tBoston');

      // Show alert to user
      alert('Test data copied! Now press Cmd+Shift+V in any text field to test the formatted paste.');

      setCurrentStep('complete');
    } catch (error) {
      console.error('Failed to copy test data:', error);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-4 bg-primary/10 rounded-full w-fit">
                <Clipboard className="h-12 w-12 text-primary" />
              </div>
              <CardTitle className="text-3xl font-bold">Welcome to AiPaste</CardTitle>
              <CardDescription className="text-lg mt-2">
                Transform your spreadsheet data into perfectly formatted tables with a single shortcut
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Keyboard className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Global Shortcut</p>
                    <p className="text-sm text-muted-foreground">
                      Press Cmd+Shift+V to paste formatted tables anywhere
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Privacy First</p>
                    <p className="text-sm text-muted-foreground">
                      Your data never leaves your device. All processing is done locally.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setCurrentStep('permissions')}
                className="w-full"
                size="lg"
              >
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        );

      case 'permissions':
        return (
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="text-2xl">Permission Required</CardTitle>
              <CardDescription>
                AiPaste needs accessibility permission to monitor keyboard shortcuts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  macOS requires your permission to allow AiPaste to monitor keyboard shortcuts.
                  This is only used to detect when you press Cmd+Shift+V.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Accessibility Permission</p>
                      <p className="text-sm text-muted-foreground">
                        Required for keyboard shortcut monitoring
                      </p>
                    </div>
                  </div>
                  <div>
                    {isChecking ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : hasPermission ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </div>
              </div>

              {!hasPermission ? (
                <div className="space-y-4">
                  <Button
                    onClick={requestPermission}
                    disabled={isRequesting}
                    className="w-full"
                    size="lg"
                  >
                    {isRequesting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Requesting Permission...
                      </>
                    ) : (
                      'Grant Permission'
                    )}
                  </Button>

                  <p className="text-sm text-muted-foreground text-center">
                    A system dialog will appear. Please grant permission to AiPaste.
                  </p>
                </div>
              ) : (
                <Button
                  onClick={() => setCurrentStep('test')}
                  className="w-full"
                  size="lg"
                >
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        );

      case 'test':
        return (
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="text-2xl">Test Your Setup</CardTitle>
              <CardDescription>
                Let's make sure everything is working correctly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-green-50 dark:bg-green-950">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Permission Granted</p>
                    <p className="text-sm text-muted-foreground">
                      Accessibility permission is active
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg border bg-green-50 dark:bg-green-950">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Shortcuts Active</p>
                    <p className="text-sm text-muted-foreground">
                      Keyboard monitoring is running
                    </p>
                  </div>
                </div>
              </div>

              <Alert>
                <Keyboard className="h-4 w-4" />
                <AlertDescription>
                  Click the button below to copy test data, then press <strong>Cmd+Shift+V</strong> in
                  any text field to see the formatted table.
                </AlertDescription>
              </Alert>

              <Button
                onClick={testPaste}
                className="w-full"
                size="lg"
              >
                Copy Test Data & Try It
              </Button>
            </CardContent>
          </Card>
        );

      case 'complete':
        return (
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-4 bg-green-100 dark:bg-green-950 rounded-full w-fit">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <CardTitle className="text-3xl font-bold">You're All Set!</CardTitle>
              <CardDescription className="text-lg mt-2">
                AiPaste is now running and ready to format your tables
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <p className="font-medium">How to use AiPaste:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Copy data from Excel, Google Sheets, or any spreadsheet</li>
                  <li>Press <strong>Cmd+Shift+V</strong> to paste as a formatted table</li>
                  <li>Regular <strong>Cmd+V</strong> still works normally</li>
                </ol>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={onComplete}
                  className="flex-1"
                  size="lg"
                >
                  Go to Dashboard
                </Button>
                <Button
                  onClick={() => window.electron.ipcRenderer.send('open-settings')}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  Open Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-background via-background to-muted/20">
      {renderStep()}
    </div>
  );
}