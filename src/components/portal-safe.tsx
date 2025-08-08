"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

interface PortalSafeProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PortalSafe({ children, fallback = null }: PortalSafeProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Prevent server-side rendering of portal components
  if (!isClient) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Create a dynamic wrapper for the UserForm to prevent SSR hydration issues
export const UserFormDynamic = dynamic(
  () => import('@/app/admin/users/user-form').then(mod => ({ default: mod.UserForm })),
  { 
    ssr: false,
    loading: () => null // No loading spinner since sheet is controlled
  }
);
