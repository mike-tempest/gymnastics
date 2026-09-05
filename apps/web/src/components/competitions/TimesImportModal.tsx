'use client';

import { X, Upload, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

import {
  importCompetitionTimes,
  type TimesImportPreview,
  type TimesImportOutcome,
} from '@/lib/api/competitions';
import { formatSwimTime } from '@/lib/competitions-utils';

const TEMPLATE_CSV = [
  'registration_number,first_name,last_name,distance,stroke,time,course,date',
  '1234567,Alice,Example,50,Freestyle,34.20,SC,2026-05-12',
  '1234567,Alice,Example,100,Freestyle,1:16.80,SC,2026-06-01',
  ',Ben,Example,100,Backstroke,1:22.40,LC,',
].join('\n');

interface TimesImportModalProps {
  competitionId: string;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function TimesImportModal({
  competitionId,
  onClose,
  onImportComplete,
}: TimesImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<TimesImportPreview | null>(null);
  const [outcome, setOutcome] = useState<TimesImportOutcome | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [onClose]);

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'swimly-times-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFileChosen(chosen: File) {
    setFile(chosen);
    setPreview(null);
    setOutcome(null);
    setError(null);
    setIsBusy(true);
    try {
      const result = await importCompetitionTimes(competitionId, chosen, true);
      setPreview(result as TimesImportPreview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the file');
      setFile(null);
    } finally {
      setIsBusy(false);
    }
  }

  async function handleImport() {
    if (!file) return;
    setIsBusy(true);
    setError(null);
    try {
      const result = (await importCompetitionTimes(competitionId, file)) as TimesImportOutcome;
      setOutcome(result);
      toast.success(
        `${result.imported} time${result.imported === 1 ? '' : 's'} imported (${result.newPBs} PB${result.newPBs === 1 ? '' : 's'})`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsBusy(false);
    }
  }

  const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand/50';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-dark-primary border border-white/10 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-dark-primary border-b border-white/10 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-white">Import Times from CSV</h2>
          <button onClick={onClose} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors" aria-label="Close">
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-text-secondary text-sm">
            Upload one sheet for the whole squad: one row per member per event. Match members by
            registration number, or by first and last name. Course and date are optional; without
            them the time takes this competition&apos;s course and date.
          </p>

          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 text-sm text-brand hover:underline min-h-[44px]"
          >
            <Download className="w-4 h-4" /> Download CSV template
          </button>

          {!outcome && (
            <div>
              <label className="block text-xs text-white/60 mb-1">CSV file</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => e.target.files?.[0] && handleFileChosen(e.target.files[0])}
                className={inputCls}
                disabled={isBusy}
              />
            </div>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          {preview && !outcome && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-green-400">
                  <CheckCircle2 className="w-4 h-4" /> {preview.validRows.length} row{preview.validRows.length === 1 ? '' : 's'} ready
                </span>
                {preview.errors.length > 0 && (
                  <span className="flex items-center gap-1.5 text-amber-400">
                    <AlertTriangle className="w-4 h-4" /> {preview.errors.length} row{preview.errors.length === 1 ? '' : 's'} will be skipped
                  </span>
                )}
              </div>

              {preview.validRows.length > 0 && (
                <div className="max-h-48 overflow-y-auto bg-white/5 rounded-xl border border-white/10">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-dark-primary">
                      <tr className="text-left text-xs text-white/50">
                        <th className="px-3 py-2 font-medium">Member</th>
                        <th className="px-3 py-2 font-medium">Event</th>
                        <th className="px-3 py-2 font-medium">Time</th>
                        <th className="px-3 py-2 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {preview.validRows.map((row) => (
                        <tr key={row.row}>
                          <td className="px-3 py-2 text-white">{row.memberName}</td>
                          <td className="px-3 py-2 text-white/70">
                            {row.distance}m {row.stroke} ({row.course})
                          </td>
                          <td className="px-3 py-2 text-white/70 tabular-nums">{formatSwimTime(row.time)}</td>
                          <td className="px-3 py-2 text-white/50">{row.swum_at ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {preview.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-1">
                  {preview.errors.map((rowError) => (
                    <p key={rowError.row} className="text-amber-400 text-xs">
                      Row {rowError.row}: {rowError.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {outcome && (
            <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-2">
              <p className="text-white font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                {outcome.imported} time{outcome.imported === 1 ? '' : 's'} imported, {outcome.newPBs} personal best{outcome.newPBs === 1 ? '' : 's'} set
              </p>
              {outcome.errors.length > 0 && (
                <p className="text-amber-400 text-sm">
                  {outcome.errors.length} row{outcome.errors.length === 1 ? ' was' : 's were'} skipped.
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={outcome ? onImportComplete : onClose}
              className="flex-1 py-3 min-h-[44px] bg-white/5 hover:bg-white/10 text-white/70 font-medium rounded-xl transition-colors"
            >
              {outcome ? 'Done' : 'Cancel'}
            </button>
            {!outcome && (
              <button
                onClick={handleImport}
                disabled={isBusy || !preview || preview.validRows.length === 0}
                className="flex-1 py-3 min-h-[44px] bg-brand hover:bg-brand-light disabled:opacity-50 text-dark-primary font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {isBusy ? 'Working...' : `Import ${preview?.validRows.length ?? 0} times`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
