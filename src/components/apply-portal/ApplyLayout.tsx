import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AppShell } from '../AppShell';
import { ApplyHeader } from './ApplyHeader';
import { ApplyFooter } from './ApplyFooter';

interface ApplyLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const ApplyLayout: React.FC<ApplyLayoutProps> = ({ children, title }) => {
  const { user } = useAuth();

  // If user is authenticated, render seamlessly inside the master AppShell
  // so the customer/admin maintains full navigation, sidebar, and dashboard continuity!
  if (user) {
    return (
      <AppShell>
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
          {children}
        </div>
      </AppShell>
    );
  }

  // Standalone public layout for guest intake submissions
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#090A0F] text-foreground font-sans apple-mesh-bg selection:bg-[#0071E3]/20">
      <ApplyHeader />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {children}
      </main>
      <ApplyFooter />
    </div>
  );
};
