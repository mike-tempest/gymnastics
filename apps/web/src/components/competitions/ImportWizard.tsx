'use client';

import { AlertTriangle, CheckCircle2, FileUp, Upload, X, XCircle } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

import { ImportOutcome, ImportPreview, importCompetitionResults } from '@/lib/api/competitions';
import { MEMBER_NOUN, MEMBER_NOUN_PLURAL } from '@/lib/brand';
import { formatSwimTime } from '@/lib/competitions-utils';

type WizardStep = 'upload' | 'preview' | 'confirm' | 'complete';

interface ImportWizardProps {
  competitionId: string;
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

const FORMAT_OPTIONS = [
  { value: '', label: 'Auto-detect' },
  { value: 'hy3', label: 'Hy-tek (.hy3)' },
  { value: 'sportsystems', label: 'SportSystems (.csv)' },
];

const ACCEPTED_EXTENSIONS = '.hy3,.csv';

export default function ImportWizard({
  competitionId,
  isOpen,
  onClose,
  onImportComplete,
}: ImportWizardProps) {
  const [step, setStep] = useState<WizardStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setFile(null);
    setFormat('');
    setIsProcessing(false);
    setError(null);
    setPreview(null);
    setOutcome(null);
    setIsDragOver(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        handleFileSelect(selectedFile);
      }
    },
    [handleFileSelect]
  );

  const handlePreview = useCallback(async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const result = await importCompetitionResults(competitionId, file, format || undefined, true);
      setPreview(result as ImportPreview);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview file');
    } finally {
      setIsProcessing(false);
    }
  }, [competitionId, file, format]);

  const handleConfirmImport = useCallback(async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setStep('confirm');

    try {
      const result = await importCompetitionResults(
        competitionId,
        file,
        format || undefined,
        false
      );
      setOutcome(result as ImportOutcome);
      setStep('complete');
      onImportComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import results');
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  }, [competitionId, file, format, onImportComplete]);

  if (!isOpen) return null;

  const STEP_KEYS = ['upload', 'preview', 'complete'] as const;
  const STEP_LABELS = ['Upload', 'Preview', 'Done'] as const;
  const activeStepIndex = STEP_KEYS.indexOf(step === 'confirm' ? 'complete' : step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-dark-primary rounded-2xl border border-white/10 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Import competition results"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="text-white font-serif text-2xl">Import Results</h2>
          <button
            onClick={handleClose}
            className="p-2 text-text-secondary hover:text-white transition-colors rounded-lg hover:bg-white/5 min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close import wizard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-6 py-3 border-b border-white/5">
          {STEP_KEYS.map((s, i) => {
            const isActive = i <= activeStepIndex;
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className={`w-8 h-px ${isActive ? 'bg-brand' : 'bg-white/10'}`} />}
                <div
                  className={`flex items-center gap-1.5 text-xs font-semibold ${
                    isActive ? 'text-brand' : 'text-text-tertiary'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                      isActive ? 'bg-brand text-dark-primary' : 'bg-white/10 text-text-tertiary'
                    }`}
                  >
                    {i + 1}
                  </span>
                  {STEP_LABELS[i]}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              {/* Drag and drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all min-h-[160px] ${
                  isDragOver
                    ? 'border-brand bg-brand/5'
                    : file
                      ? 'border-brand/40 bg-brand/5'
                      : 'border-white/20 hover:border-white/30 bg-white/[0.02]'
                }`}
                role="button"
                tabIndex={0}
                aria-label="Select or drop a file to upload"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                {file ? (
                  <>
                    <FileUp className="w-10 h-10 text-brand" />
                    <div className="text-center">
                      <p className="text-white font-medium">{file.name}</p>
                      <p className="text-text-secondary text-sm">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-text-secondary hover:text-white text-sm underline min-h-[44px] flex items-center"
                    >
                      Choose a different file
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-text-tertiary" />
                    <div className="text-center">
                      <p className="text-white font-medium">Drop your results file here</p>
                      <p className="text-text-secondary text-sm">
                        or click to browse. Accepts .hy3 and .csv files.
                      </p>
                    </div>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  onChange={handleInputChange}
                  className="hidden"
                  aria-hidden="true"
                />
              </div>

              {/* Format selector */}
              <div>
                <label
                  htmlFor="import-format"
                  className="block text-text-secondary text-sm font-semibold mb-1.5"
                >
                  File Format
                </label>
                <select
                  id="import-format"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-brand transition-colors min-h-[44px]"
                >
                  {FORMAT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value} className="bg-dark-primary">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 text-text-secondary hover:text-white transition-colors rounded-xl text-sm font-semibold min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePreview}
                  disabled={!file || isProcessing}
                  className="px-5 py-2.5 bg-brand text-dark-primary rounded-xl font-semibold text-sm hover:bg-brand-light transition-all disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-dark-primary border-t-transparent rounded-full" />
                      Processing...
                    </>
                  ) : (
                    'Preview Import'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && preview && (
            <div className="flex flex-col gap-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-white">{preview.totalResults}</p>
                  <p className="text-text-secondary text-xs">Total Results</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-brand">{preview.matchedMembers}</p>
                  <p className="text-text-secondary text-xs">Matched {MEMBER_NOUN_PLURAL}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-400">
                    {preview.unmatchedMembers.length}
                  </p>
                  <p className="text-text-secondary text-xs">Unmatched</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-sm font-semibold text-white">{preview.format}</p>
                  <p className="text-text-secondary text-xs">Format</p>
                </div>
              </div>

              {/* Meet name */}
              {preview.meetName && (
                <p className="text-text-secondary text-sm">
                  Meet: <span className="text-white font-medium">{preview.meetName}</span>
                </p>
              )}

              {/* Unmatched members warning */}
              {preview.unmatchedMembers.length > 0 && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-400 text-sm font-semibold mb-1">
                        Unmatched Members
                      </p>
                      <p className="text-text-secondary text-sm">
                        The following members could not be matched to club members:
                      </p>
                      <ul className="mt-1 text-yellow-400/80 text-sm list-disc list-inside">
                        {preview.unmatchedMembers.map((name) => (
                          <li key={name}>{name}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Results preview table */}
              {preview.results.length > 0 && (
                <div className="bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden">
                  <div className="px-4 py-2 border-b border-white/5">
                    <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
                      Results Preview (first 20)
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-text-tertiary text-xs uppercase tracking-wider">
                          <th className="px-3 py-2">{MEMBER_NOUN}</th>
                          <th className="px-3 py-2">Event</th>
                          <th className="px-3 py-2">Time</th>
                          <th className="px-3 py-2">Place</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.results.slice(0, 20).map((r, i) => (
                          <tr key={i} className="border-t border-white/5">
                            <td className="px-3 py-2 text-white">{r.member_name}</td>
                            <td className="px-3 py-2 text-text-secondary">
                              {r.distance}m {r.stroke}
                            </td>
                            <td className="px-3 py-2 tabular-nums text-white">
                              {formatSwimTime(r.time)}
                            </td>
                            <td className="px-3 py-2 text-text-secondary">{r.place ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {preview.results.length > 20 && (
                    <div className="px-4 py-2 border-t border-white/5 text-text-tertiary text-xs">
                      ...and {preview.results.length - 20} more results
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between gap-3 pt-2">
                <button
                  onClick={() => {
                    setStep('upload');
                    setPreview(null);
                    setError(null);
                  }}
                  className="px-5 py-2.5 text-text-secondary hover:text-white transition-colors rounded-xl text-sm font-semibold min-h-[44px]"
                >
                  Back
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="px-5 py-2.5 text-text-secondary hover:text-white transition-colors rounded-xl text-sm font-semibold min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmImport}
                    disabled={isProcessing}
                    className="px-5 py-2.5 bg-brand text-dark-primary rounded-xl font-semibold text-sm hover:bg-brand-light transition-all disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] flex items-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-dark-primary border-t-transparent rounded-full" />
                        Importing...
                      </>
                    ) : (
                      `Import ${preview.totalResults} Results`
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2.5: Confirming (loading) */}
          {step === 'confirm' && !outcome && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin h-10 w-10 border-4 border-brand border-t-transparent rounded-full" />
              <p className="text-text-secondary text-lg mt-4">Importing results...</p>
            </div>
          )}

          {/* Step 3: Complete */}
          {step === 'complete' && outcome && (
            <div className="flex flex-col gap-4">
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-brand mx-auto mb-3" />
                <h3 className="text-white font-serif text-xl mb-1">Import Complete</h3>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-brand">{outcome.imported}</p>
                  <p className="text-text-secondary text-xs">Results Imported</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-400">{outcome.newPBs}</p>
                  <p className="text-text-secondary text-xs">New Personal Bests</p>
                </div>
              </div>

              {/* Warnings */}
              {outcome.warnings.length > 0 && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-400 text-sm font-semibold mb-1">Warnings</p>
                      <ul className="text-yellow-400/80 text-sm list-disc list-inside">
                        {outcome.warnings.map((w, i) => (
                          <li key={i}>{w}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Errors */}
              {outcome.errors.length > 0 && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                  <div className="flex items-start gap-2">
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-400 text-sm font-semibold mb-1">Errors</p>
                      <ul className="text-red-400/80 text-sm list-disc list-inside">
                        {outcome.errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleClose}
                  className="px-5 py-2.5 bg-brand text-dark-primary rounded-xl font-semibold text-sm hover:bg-brand-light transition-all min-h-[44px]"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
