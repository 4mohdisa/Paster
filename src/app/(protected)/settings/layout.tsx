"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Settings,
  Key,
  User,
  Bell,
  Shield,
  Palette,
  Zap,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

const settingsNavigation = [
  {
    name: "General",
    href: "/settings",
    icon: Settings,
    description: "Basic account and app preferences"
  },
  {
    name: "API Keys",
    href: "/settings/byok",
    icon: Key,
    description: "Manage your AI model API keys"
  },
  {
    name: "Profile",
    href: "/settings/profile",
    icon: User,
    description: "Personal information and preferences"
  },
  {
    name: "Notifications",
    href: "/settings/notifications",
    icon: Bell,
    description: "Email and push notification settings"
  },
  {
    name: "Privacy & Security",
    href: "/settings/privacy",
    icon: Shield,
    description: "Data privacy and security options"
  },
  {
    name: "Appearance",
    href: "/settings/appearance",
    icon: Palette,
    description: "Theme and display preferences"
  },
  {
    name: "Advanced",
    href: "/settings/advanced",
    icon: Zap,
    description: "Developer options and advanced features"
  }
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full bg-muted/20">
      <div className="w-80 bg-card/50 backdrop-blur-sm border-r border-border">
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg border border-primary/20">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
                <p className="text-sm text-muted-foreground">
                  Manage your preferences
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto py-4">
            <nav className="space-y-1 px-4">
              {settingsNavigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm transition-all duration-200 relative",
                      isActive
                        ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
                    )}

                    <div className={cn(
                      "p-2 rounded-lg transition-colors",
                      isActive
                        ? "bg-primary/20"
                        : "bg-muted/50 group-hover:bg-muted"
                    )}>
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{item.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </div>
                    </div>

                    <ChevronRight className={cn(
                      "h-4 w-4 transition-all duration-200",
                      isActive
                        ? "text-primary/70 translate-x-0.5"
                        : "text-muted-foreground/50 group-hover:text-muted-foreground group-hover:translate-x-0.5"
                    )} />
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="p-4 border-t border-border/50">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-start gap-2">
                <Shield className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <div className="font-medium text-foreground mb-1">Privacy Protected</div>
                  Your settings are encrypted and stored securely.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
