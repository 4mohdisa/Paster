"use client";

import React, { useState } from "react";
import { Palette, Sun, Moon, Monitor } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const AppearanceSettings = () => {
  const [theme, setTheme] = useState("system");

  const themes = [
    {
      id: "light",
      name: "Light",
      description: "Clean and bright interface",
      icon: Sun
    },
    {
      id: "dark",
      name: "Dark",
      description: "Easy on the eyes in low light",
      icon: Moon
    },
    {
      id: "system",
      name: "System",
      description: "Matches your device settings",
      icon: Monitor
    }
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-8 py-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
              <Palette className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Appearance</h1>
              <p className="text-muted-foreground leading-relaxed max-w-2xl">
                Customize the look and feel of your application interface.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted/20">
        <div className="container mx-auto px-8 py-8 space-y-8">

          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Theme Preference</CardTitle>
              <CardDescription>
                Choose how the interface looks and feels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={theme} onValueChange={setTheme} className="space-y-4">
                {themes.map((themeOption) => {
                  const Icon = themeOption.icon;
                  return (
                    <div key={themeOption.id} className="flex items-center space-x-3">
                      <RadioGroupItem value={themeOption.id} id={themeOption.id} />
                      <Label
                        htmlFor={themeOption.id}
                        className="flex items-center gap-3 flex-1 cursor-pointer p-4 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="p-2 bg-background rounded-lg">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-medium">{themeOption.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {themeOption.description}
                          </div>
                        </div>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </CardContent>
          </Card>

          <Card className="shadow-sm opacity-60">
            <CardContent className="py-12 text-center">
              <div className="space-y-4">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <Palette className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">More Customization Coming Soon</h3>
                  <p className="text-muted-foreground">
                    Additional appearance options like custom themes, fonts, and layouts are in development.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AppearanceSettings;
