"use client";

import React, { useState, useEffect } from 'react';
import Onboarding from '@/components/onboarding';
import Dashboard from '@/components/dashboard';

const Home = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if onboarding has been completed
    const checkOnboardingStatus = async () => {
      try {
        // Check if user has completed onboarding (from file-based settings)
        const onboardingResult = await window.electron.ipcRenderer.invoke('settings:get-onboarding-status');
        const onboardingComplete = onboardingResult?.data?.completed || false;
        
        // Check if permissions are granted
        const permResult = await window.electron.ipcRenderer.invoke('process:check-permissions');
        const hasPermission = permResult?.data?.accessibility || false;
        
        // Show onboarding if not completed or no permissions
        if (!onboardingComplete || !hasPermission) {
          setShowOnboarding(true);
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // Show onboarding on error to be safe
        setShowOnboarding(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  const handleOnboardingComplete = async () => {
    // Save to file-based settings
    await window.electron.ipcRenderer.invoke('settings:set-onboarding-complete');
    setShowOnboarding(false);
  };

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  return <Dashboard />;
}

export default Home