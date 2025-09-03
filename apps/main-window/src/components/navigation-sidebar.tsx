"use client";

import { cn } from "@aipaste/ui/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@aipaste/ui/components/tooltip";
import { MessageSquare, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";


const navigationItems = [
  {
    name: "Chat",
    href: "/main",
    icon: MessageSquare,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export function NavigationSidebar() {
  const pathname = usePathname();

  return (
    <div className="w-16 bg-background border-r border-border flex flex-col items-center py-4 space-y-2 min-h-full">
      {navigationItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Tooltip key={item.href}>
            <div className="relative group">
              <TooltipTrigger>
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center justify-center w-10 h-10 rounded-md transition-all duration-200 relative",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg scale-105"
                      : "hover:bg-accent hover:text-accent-foreground text-muted-foreground hover:scale-105"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">
                {item.name}
              </TooltipContent>
            </div>
          </Tooltip>
        );
      })}

      <div className="flex-1 flex items-end pb-6">
        <div className="w-8 h-px bg-border" />
      </div>
    </div>
  );
}
