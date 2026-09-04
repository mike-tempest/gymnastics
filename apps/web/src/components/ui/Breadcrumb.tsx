'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center space-x-2 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRight className="w-4 h-4 text-text-tertiary mx-2" />
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="text-grey-600 hover:text-brand transition-colors min-h-[44px] flex items-center"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={`${
                    isLast ? 'text-white font-medium' : 'text-grey-600'
                  } min-h-[44px] flex items-center`}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
