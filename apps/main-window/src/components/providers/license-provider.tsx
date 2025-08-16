'use client';

import type React from 'react';

export const LicenseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {

  return (
    <>
      {children}
    </>
  );
};