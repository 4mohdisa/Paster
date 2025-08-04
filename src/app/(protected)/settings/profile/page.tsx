"use client";

import React from "react";
import { User, Camera, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const ProfileSettings = () => {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-8 py-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">Profile Settings</h1>
              <p className="text-muted-foreground leading-relaxed max-w-2xl">
                Manage your personal information, avatar, and contact preferences.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-muted/20">
        <div className="container mx-auto px-8 py-8 space-y-8">

          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Profile Picture</CardTitle>
              <CardDescription>
                Update your profile picture and avatar settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24">
                  <AvatarImage src="/placeholder-avatar.jpg" alt="Profile picture" />
                  <AvatarFallback className="text-lg">JD</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Upload new picture
                  </Button>
                  <Button variant="outline" size="sm">
                    Remove picture
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    JPG, PNG or GIF. Max size 2MB.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl">Contact Information</CardTitle>
              <CardDescription>
                Keep your contact details up to date
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-base font-medium">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      className="pl-10 h-11"
                      placeholder="your.email@example.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-base font-medium">
                    Phone Number
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      className="pl-10 h-11"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm opacity-60">
            <CardContent className="py-12 text-center">
              <div className="space-y-4">
                <div className="mx-auto w-12 h-12 bg-muted rounded-full flex items-center justify-center">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">More Profile Options Coming Soon</h3>
                  <p className="text-muted-foreground">
                    Additional profile customization features are being developed.
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

export default ProfileSettings;
