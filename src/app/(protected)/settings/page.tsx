"use client";

import React, { useState } from "react";
import {
  Save,
  User,
  Globe,
  Monitor,
  Download,
  Trash2,
  RefreshCw,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const GeneralSettings = () => {
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    displayName: "John Doe",
    email: "john.doe@example.com",
    bio: "",
    language: "en",
    timezone: "UTC",
    autoSave: true,
    dataCollection: false,
    betaFeatures: true
  });

  const handleSave = async () => {
    setSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSaving(false);
  };

  const handleInputChange = (key: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-8 py-8">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold tracking-tight mb-2">General Settings</h1>
              <p className="text-muted-foreground leading-relaxed max-w-2xl">
                Configure your basic account preferences, display settings, and general application behavior.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted/20">
        <div className="container mx-auto px-8 py-8 space-y-8">

          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Profile Information</CardTitle>
                  <CardDescription>
                    Update your personal information and profile details
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-base font-medium">
                    Display Name
                  </Label>
                  <Input
                    id="displayName"
                    value={settings.displayName}
                    onChange={(e) => handleInputChange("displayName", e.target.value)}
                    className="h-11"
                    placeholder="Enter your display name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-base font-medium">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={settings.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="h-11"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio" className="text-base font-medium">
                  Bio
                </Label>
                <Textarea
                  id="bio"
                  value={settings.bio}
                  onChange={(e) => handleInputChange("bio", e.target.value)}
                  placeholder="Tell us a bit about yourself..."
                  className="min-h-[100px] resize-none"
                />
                <p className="text-sm text-muted-foreground">
                  A brief description that appears on your profile.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Globe className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Localization & Format</CardTitle>
                  <CardDescription>
                    Set your preferred language, timezone, and regional formats
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-base font-medium">Language</Label>
                  <Select value={settings.language} onValueChange={(value) => handleInputChange("language", value)}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="ja">日本語</SelectItem>
                      <SelectItem value="zh">中文</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-medium">Timezone</Label>
                  <Select value={settings.timezone} onValueChange={(value) => handleInputChange("timezone", value)}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="Europe/London">London (GMT)</SelectItem>
                      <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Monitor className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Application Preferences</CardTitle>
                  <CardDescription>
                    Customize your app experience and behavior
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="space-y-1">
                    <div className="font-medium">Auto-save conversations</div>
                    <div className="text-sm text-muted-foreground">
                      Automatically save your conversations as you type
                    </div>
                  </div>
                  <Switch
                    checked={settings.autoSave}
                    onCheckedChange={(checked) => handleInputChange("autoSave", checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="space-y-1">
                    <div className="font-medium">Analytics & Usage Data</div>
                    <div className="text-sm text-muted-foreground">
                      Help improve the app by sharing anonymous usage data
                    </div>
                  </div>
                  <Switch
                    checked={settings.dataCollection}
                    onCheckedChange={(checked) => handleInputChange("dataCollection", checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="space-y-1">
                    <div className="font-medium">Beta Features</div>
                    <div className="text-sm text-muted-foreground">
                      Get early access to experimental features and improvements
                    </div>
                  </div>
                  <Switch
                    checked={settings.betaFeatures}
                    onCheckedChange={(checked) => handleInputChange("betaFeatures", checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Download className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <CardTitle className="text-xl">Data Management</CardTitle>
                  <CardDescription>
                    Export, backup, or delete your account data
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="h-12 justify-start">
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
                <Button variant="outline" className="h-12 justify-start">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Create Backup
                </Button>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="text-sm font-medium text-destructive">Danger Zone</div>
                <div className="p-4 rounded-lg border-destructive/20 border bg-destructive/5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-destructive">Delete Account</div>
                      <div className="text-sm text-muted-foreground">
                        Permanently delete your account and all associated data
                      </div>
                    </div>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
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
};

export default GeneralSettings;
