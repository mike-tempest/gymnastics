'use client';

import { Download } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { exportCompetitionEntries } from '@/lib/api/competitions';

interface ExportButtonProps {
  competitionId: string;
}

const FORMAT_OPTIONS = [
  { value: 'hy3', label: 'Hy-tek (.hy3)' },
  { value: 'sportsystems', label: 'SportSystems (.csv)' },
];

export default function ExportButton({ competitionId }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleExport = useCallback(
    async (format: string) => {
      setShowDropdown(false);
      setIsExporting(true);

      try {
        await exportCompetitionEntries(competitionId, format);
        toast.success('Results exported successfully');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to export results';
        toast.error(message);
      } finally {
        setIsExporting(false);
      }
    },
    [competitionId]
  );

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={isExporting}
        className="px-4 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl font-semibold text-sm hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center gap-2"
        aria-label="Export results"
        aria-expanded={showDropdown}
        aria-haspopup="true"
      >
        {isExporting ? (
          <>
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="w-4 h-4" />
            Export
          </>
        )}
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-full mt-1 z-50 bg-dark-primary border border-white/10 rounded-xl shadow-lg overflow-hidden min-w-[180px]">
            {FORMAT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleExport(opt.value)}
                className="w-full text-left px-4 py-3 text-white text-sm hover:bg-white/5 transition-colors min-h-[44px]"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
