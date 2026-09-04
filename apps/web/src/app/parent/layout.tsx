'use client';

import { ReactNode } from 'react';

import MainLayout from '@/components/layout/MainLayout';

interface ParentLayoutProps {
  children: ReactNode;
}

export default function ParentLayout({ children }: ParentLayoutProps) {
  return <MainLayout>{children}</MainLayout>;
}
