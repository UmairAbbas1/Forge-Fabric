import React from 'react';
import { ApplyHeader } from './ApplyHeader';
import { ApplyFooter } from './ApplyFooter';

interface ApplyLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const ApplyLayout: React.FC<ApplyLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col bg-white text-neutral-900 font-sans selection:bg-amber-500/20 selection:text-amber-900">
      <ApplyHeader />
      <main className="flex-1 bg-white">
        {children}
      </main>
      <ApplyFooter />
    </div>
  );
};
