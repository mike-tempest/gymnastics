'use client';

import { useState, ReactNode } from 'react';

import ConnectivityBanner from '@/components/ui/ConnectivityBanner';

import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div data-layout="root" className="flex h-dvh overflow-hidden">
      <ConnectivityBanner />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand focus:text-dark-primary focus:rounded-lg focus:font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-dark-primary"
      >
        Skip to content
      </a>
      <div data-layout="sidebar">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      </div>

      <div data-layout="content-column" className="flex-1 flex flex-col overflow-hidden">
        <div data-layout="topbar">
          <TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
        </div>

        <main id="main-content" aria-label="Main content" className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
