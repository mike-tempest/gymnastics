'use client';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  Trash2,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import {
  type GoCardlessImportResponse,
  type GoCardlessPreviewResponse,
  importGoCardless,
  previewGoCardlessImport,
} from '@/lib/api/data-import';
import { BRAND, MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';
import {
  GOCARDLESS_FILE_LABELS,
  type GoCardlessFileRole,
  detectGoCardlessFileRole,
  mapGoCardlessCustomers,
  mapGoCardlessMandates,
  mapGoCardlessPayments,
} from '@/lib/import/gocardless';
import {
  IMPORT_FILE_ACCEPT,
  type ParsedSpreadsheet,
  SpreadsheetParseError,
  parseImportFile,
} from '@/lib/import/spreadsheet';

type Step = 'upload' | 'preview' | 'importing' | 'results';

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Upload exports' },
  { key: 'preview', label: 'Preview' },
  { key: 'importing', label: 'Import' },
  { key: 'results', label: 'Results' },
];

const ROLE_OPTIONS: GoCardlessFileRole[] = ['customers', 'mandates', 'payments', 'unknown'];

interface UploadedFile {
  id: string;
  name: string;
  role: GoCardlessFileRole;
  /** The role detected from the headers, before any manual override. */
  detectedRole: GoCardlessFileRole;
  sheet: ParsedSpreadsheet;
}

type PreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; data: GoCardlessPreviewResponse }
  | { status: 'error'; message: string };

/**
 * Rows a file contributes once mapped, and how many of its rows carried too
 * little to send. Nothing is dropped without the club being told.
 */
function mappedCounts(file: UploadedFile): { mapped: number; dropped: number } {
  const mapped =
    file.role === 'customers'
      ? mapGoCardlessCustomers(file.sheet).length
      : file.role === 'mandates'
        ? mapGoCardlessMandates(file.sheet).length
        : file.role === 'payments'
          ? mapGoCardlessPayments(file.sheet).length
          : 0;
  return { mapped, dropped: file.role === 'unknown' ? 0 : file.sheet.rows.length - mapped };
}

export default function GoCardlessImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewSeq = useRef(0);
  const [step, setStep] = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [createMissingFamilies, setCreateMissingFamilies] = useState(true);
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' });
  const [results, setResults] = useState<GoCardlessImportResponse | null>(null);

  const stepIndex = STEP_LABELS.findIndex((s) => s.key === step);
  const customerFile = files.find((f) => f.role === 'customers') ?? null;
  const mandateFile = files.find((f) => f.role === 'mandates') ?? null;
  const paymentFile = files.find((f) => f.role === 'payments') ?? null;
  const canContinue = customerFile !== null && mandateFile !== null;

  const buildPayload = () => ({
    customers: customerFile ? mapGoCardlessCustomers(customerFile.sheet) : [],
    mandates: mandateFile ? mapGoCardlessMandates(mandateFile.sheet) : [],
    payments: paymentFile ? mapGoCardlessPayments(paymentFile.sheet) : undefined,
  });

  const processFiles = async (incoming: FileList | File[]) => {
    setParseError(null);
    const added: UploadedFile[] = [];
    const failed: string[] = [];

    for (const file of Array.from(incoming)) {
      try {
        const sheet = await parseImportFile(file);
        if (sheet.headers.length === 0 || sheet.rows.length === 0) {
          failed.push(`${file.name}: needs a header row and at least one data row`);
          continue;
        }
        const detectedRole = detectGoCardlessFileRole(sheet.headers);
        added.push({
          id: `${file.name}-${Date.now()}-${added.length}`,
          name: file.name,
          role: detectedRole,
          detectedRole,
          sheet,
        });
      } catch (err) {
        failed.push(
          `${file.name}: ${err instanceof SpreadsheetParseError ? err.message : 'could not be parsed'}`
        );
      }
    }

    if (failed.length > 0) setParseError(failed.join('. '));
    if (added.length > 0) setFiles((current) => [...current, ...added]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void processFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) void processFiles(e.dataTransfer.files);
  };

  const runPreview = async (createFamilies: boolean) => {
    const seq = ++previewSeq.current;
    setPreview({ status: 'loading' });
    try {
      const data = await previewGoCardlessImport(buildPayload(), {
        create_missing_families: createFamilies,
      });
      if (seq !== previewSeq.current) return;
      setPreview({ status: 'done', data });
    } catch (err) {
      if (seq !== previewSeq.current) return;
      setPreview({
        status: 'error',
        message: err instanceof Error ? err.message : 'The server check failed',
      });
    }
  };

  const handleContinue = () => {
    if (!canContinue) return;
    setStep('preview');
    void runPreview(createMissingFamilies);
  };

  const handleToggleCreateFamilies = (checked: boolean) => {
    setCreateMissingFamilies(checked);
    void runPreview(checked);
  };

  const handleImport = async () => {
    setStep('importing');
    try {
      const result = await importGoCardless(buildPayload(), {
        create_missing_families: createMissingFamilies,
      });
      setResults(result);
      const created = result.summary.mandates_created;
      if (created > 0 && result.errors.length === 0) {
        toast.success(`${created} mandate${created !== 1 ? 's' : ''} imported successfully`);
      } else if (created > 0) {
        toast.success(`${created} mandate${created !== 1 ? 's' : ''} imported with some errors`);
      } else {
        toast.error('No mandates were imported');
      }
    } catch (err) {
      setResults({
        summary: {
          families_created: 0,
          families_matched: 0,
          mandates_created: 0,
          active_mandates_created: 0,
          mandates_skipped: 0,
          payments_imported: 0,
        },
        errors: [
          {
            scope: 'mandate',
            row: 0,
            message: err instanceof Error ? err.message : 'Import failed',
          },
        ],
        warnings: [],
      });
      toast.error(err instanceof Error ? err.message : 'GoCardless import failed');
    }
    setStep('results');
  };

  const handleReset = () => {
    setStep('upload');
    setFiles([]);
    setParseError(null);
    setCreateMissingFamilies(true);
    setPreview({ status: 'idle' });
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <Link
              href="/admin/import"
              className="inline-flex items-center space-x-2 text-text-secondary hover:text-brand transition-colors mb-3 min-h-[48px]"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Data Import</span>
            </Link>
            <h1 className="font-serif text-4xl sm:text-5xl text-dark-primary tracking-tight mb-2">
              Take over your GoCardless organisation
            </h1>
            <p className="text-grey-600 text-lg max-w-3xl">
              Bring your existing Direct Debits into {BRAND.name} without asking a single parent to
              set one up again. Upload the customers and mandates exports from your own GoCardless
              dashboard, and optionally the payments export for reconciliation.
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            {STEP_LABELS.map((s, idx) => (
              <div key={s.key} className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${
                    idx === stepIndex
                      ? 'bg-brand text-dark-primary'
                      : idx < stepIndex
                        ? 'bg-brand bg-opacity-20 text-brand'
                        : 'bg-dark-primary/10 text-grey-600'
                  }`}
                >
                  <span>{idx + 1}</span>
                  <span>{s.label}</span>
                </div>
                {idx < STEP_LABELS.length - 1 && <ArrowRight className="w-4 h-4 text-grey-600" />}
              </div>
            ))}
          </div>

          <div className="bg-dark-primary rounded-3xl shadow-lg p-4 sm:p-8 border border-white/20">
            {step === 'upload' && (
              <div className="space-y-8">
                <div className="bg-brand bg-opacity-10 border border-brand border-opacity-30 rounded-xl p-4 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-brand text-sm font-semibold">Nobody re-mandates</p>
                    <p className="text-text-secondary text-sm">
                      Your mandates stay in your own GoCardless organisation. This import records
                      them here so billing can collect against them, exactly as if they had been set
                      up in {BRAND.name}. Link your GoCardless account in Settings to start
                      collecting.
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">
                    1. Download your exports from GoCardless
                  </h3>
                  <p className="text-text-secondary text-sm">
                    In the GoCardless dashboard, export{' '}
                    <span className="text-white font-medium">Customers</span> and{' '}
                    <span className="text-white font-medium">Mandates</span> as CSV. Add the{' '}
                    <span className="text-white font-medium">Payments</span> export if you want the
                    collection history summarised for reconciliation.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">2. Upload them together</h3>
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all min-h-[200px] flex flex-col items-center justify-center ${
                      isDragging
                        ? 'border-brand bg-brand bg-opacity-5'
                        : 'border-white/20 hover:border-text-tertiary'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept={IMPORT_FILE_ACCEPT}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Upload className="w-12 h-12 text-text-tertiary mb-4" />
                    <p className="text-white font-semibold mb-1">
                      Drag and drop your GoCardless exports here
                    </p>
                    <p className="text-text-secondary text-sm">or click to browse</p>
                    <p className="text-text-tertiary text-xs mt-3">
                      Each file is recognised from its columns, so the order does not matter
                    </p>
                  </div>
                </div>

                {parseError && (
                  <div className="bg-red-500 bg-opacity-10 border border-red-500 rounded-xl p-4 flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-sm">{parseError}</p>
                  </div>
                )}

                {files.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-white">Files to import</h3>
                    {files.map((file) => {
                      const counts = mappedCounts(file);
                      return (
                        <div
                          key={file.id}
                          className="bg-dark-primary/80 border border-white/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                        >
                          <FileSpreadsheet className="w-6 h-6 text-brand flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold truncate">{file.name}</p>
                            <p className="text-text-secondary text-sm">
                              {file.sheet.rows.length} row
                              {file.sheet.rows.length !== 1 ? 's' : ''}
                              {file.role !== 'unknown' && `, ${counts.mapped} usable`}
                              {counts.dropped > 0 &&
                                `, ${counts.dropped} ignored (missing an id or a required column)`}
                            </p>
                            {file.role !== file.detectedRole && (
                              <p className="text-text-tertiary text-xs mt-1">
                                Detected as{' '}
                                {GOCARDLESS_FILE_LABELS[file.detectedRole].toLowerCase()},
                                overridden by you
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="sr-only" htmlFor={`role-${file.id}`}>
                              File type for {file.name}
                            </label>
                            <select
                              id={`role-${file.id}`}
                              value={file.role}
                              onChange={(e) =>
                                setFiles((current) =>
                                  current.map((f) =>
                                    f.id === file.id
                                      ? { ...f, role: e.target.value as GoCardlessFileRole }
                                      : f
                                  )
                                )
                              }
                              className="min-h-[48px] px-3 py-2 bg-dark-primary text-white rounded-xl border border-white/20 text-sm focus:outline-none focus:border-brand"
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role}>
                                  {GOCARDLESS_FILE_LABELS[role]}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() =>
                                setFiles((current) => current.filter((f) => f.id !== file.id))
                              }
                              aria-label={`Remove ${file.name}`}
                              className="min-h-[48px] min-w-[48px] flex items-center justify-center text-text-secondary hover:text-red-400 transition-colors rounded-xl border border-white/20"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {!canContinue && (
                      <div className="bg-red-500 bg-opacity-10 border border-red-500 rounded-xl p-4 flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-red-300 text-sm">
                          A customers export and a mandates export are both needed. Set the file
                          type by hand if a file was not recognised.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-white/20">
                      <button
                        onClick={handleReset}
                        className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all min-h-[48px] flex items-center justify-center"
                      >
                        Start again
                      </button>
                      <button
                        onClick={handleContinue}
                        disabled={!canContinue}
                        className="px-8 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-2 min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                      >
                        <span>Continue to Preview</span>
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 'preview' && (
              <div className="space-y-6">
                <label className="flex items-center gap-3 bg-dark-primary/80 border border-white/20 rounded-xl p-4 cursor-pointer min-h-[48px]">
                  <input
                    type="checkbox"
                    checked={createMissingFamilies}
                    onChange={(e) => handleToggleCreateFamilies(e.target.checked)}
                    className="w-5 h-5 rounded accent-brand"
                  />
                  <div>
                    <p className="text-white text-sm font-semibold">
                      Create families that don&apos;t exist yet
                    </p>
                    <p className="text-text-secondary text-xs">
                      A GoCardless customer whose email matches no family becomes a new family.
                      Switch this off to attach mandates only to families you have already imported.
                      You can add their {MEMBER_NOUN_PLURAL_LOWER} afterwards from a roster import.
                    </p>
                  </div>
                </label>

                {preview.status === 'loading' && (
                  <div className="flex items-center space-x-2 text-text-secondary text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Checking your exports against existing families and mandates...</span>
                  </div>
                )}

                {preview.status === 'error' && (
                  <div className="bg-red-500 bg-opacity-10 border border-red-500 rounded-xl p-4 space-y-3">
                    <p className="text-red-300 text-sm">
                      The server check could not be completed: {preview.message}
                    </p>
                    <button
                      onClick={() => runPreview(createMissingFamilies)}
                      className="px-4 py-2 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all border border-white/20 min-h-[48px] text-sm"
                    >
                      Retry server check
                    </button>
                  </div>
                )}

                {preview.status === 'done' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      <SummaryTile
                        value={preview.data.summary.families_to_create}
                        label="Families to create"
                        emphasis
                      />
                      <SummaryTile
                        value={preview.data.summary.families_matched}
                        label="Families matched"
                      />
                      <SummaryTile
                        value={preview.data.summary.mandates_to_create}
                        label="Mandates to import"
                        emphasis
                      />
                      <SummaryTile
                        value={preview.data.summary.active_mandates_to_create}
                        label="Live Direct Debits"
                        emphasis
                      />
                      <SummaryTile
                        value={preview.data.summary.mandates_skipped}
                        label="Mandates skipped"
                      />
                    </div>

                    {preview.data.summary.payments && (
                      <div className="bg-dark-primary/80 border border-white/20 rounded-xl p-4 space-y-2">
                        <h4 className="text-white font-semibold">
                          Payment history (for reconciliation only)
                        </h4>
                        <p className="text-text-secondary text-sm">
                          {preview.data.summary.payments.rows} payment rows read.{' '}
                          {preview.data.summary.payments.totals_by_currency
                            .map((total) => `${total.currency} ${total.total_amount.toFixed(2)}`)
                            .join(', ')}
                          {preview.data.summary.payments.earliest_charge_date &&
                            ` between ${preview.data.summary.payments.earliest_charge_date} and ${preview.data.summary.payments.latest_charge_date}`}
                          .
                        </p>
                        <p className="text-text-tertiary text-xs">
                          Past collections are not imported. They belong to invoices that do not
                          exist here, so importing them would distort your finance reports. Check
                          these totals against your GoCardless dashboard, then keep the export.
                        </p>
                        {preview.data.summary.payments.rows_without_matching_mandate > 0 && (
                          <p className="text-text-tertiary text-xs">
                            {preview.data.summary.payments.rows_without_matching_mandate} payment
                            rows reference a mandate that is not in the mandates export.
                          </p>
                        )}
                      </div>
                    )}

                    <ResultTable
                      title="Mandates"
                      emptyLabel="No mandate rows to show."
                      rows={preview.data.mandate_results.map((result) => ({
                        key: `${result.row}-${result.gocardless_mandate_id}`,
                        row: result.row,
                        reference: result.gocardless_mandate_id,
                        detail: `${result.gocardless_customer_id}${result.status ? ` / ${result.status}` : ''}`,
                        action: result.action,
                        messages: [...result.errors, ...result.warnings],
                      }))}
                    />

                    <ResultTable
                      title="Customers"
                      emptyLabel="No customer rows to show."
                      rows={preview.data.customer_results.map((result) => ({
                        key: `${result.row}-${result.gocardless_customer_id}`,
                        row: result.row,
                        reference: result.gocardless_customer_id,
                        detail: result.email ?? 'no email',
                        action: result.action,
                        messages: result.errors,
                      }))}
                    />

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-white/20">
                      <button
                        onClick={() => setStep('upload')}
                        className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all min-h-[48px] flex items-center justify-center"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleImport}
                        disabled={preview.data.summary.mandates_to_create === 0}
                        className="px-8 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-2 min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                      >
                        <Upload className="w-5 h-5" />
                        <span>Import {preview.data.summary.mandates_to_create} mandates</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 'importing' && (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-brand bg-opacity-10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-brand animate-spin" />
                </div>
                <h3 className="font-serif text-2xl text-white">Importing your mandates...</h3>
                <p className="text-text-secondary">
                  Families and Direct Debit mandates are being recorded. No instruction is sent to
                  GoCardless and no parent is contacted.
                </p>
              </div>
            )}

            {step === 'results' && results && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  {results.summary.mandates_created > 0 && results.errors.length === 0 ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand bg-opacity-10 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-brand" />
                      </div>
                      <h3 className="font-serif text-3xl text-white mb-2">Takeover complete</h3>
                      <p className="text-text-secondary">
                        {results.summary.active_mandates_created} live Direct Debit
                        {results.summary.active_mandates_created !== 1 ? 's' : ''} moved across. No
                        parent was asked to set one up again.
                      </p>
                    </>
                  ) : results.summary.mandates_created > 0 ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500 bg-opacity-10 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-yellow-400" />
                      </div>
                      <h3 className="font-serif text-3xl text-white mb-2">
                        Takeover partially complete
                      </h3>
                      <p className="text-text-secondary">
                        Some mandates were imported. {results.errors.length} row
                        {results.errors.length !== 1 ? 's' : ''} failed.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500 bg-opacity-10 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                      </div>
                      <h3 className="font-serif text-3xl text-white mb-2">Takeover failed</h3>
                      <p className="text-text-secondary">
                        No mandates were imported. Please check the errors below.
                      </p>
                    </>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <SummaryTile
                    value={results.summary.families_created}
                    label="Families created"
                    emphasis
                  />
                  <SummaryTile value={results.summary.families_matched} label="Families matched" />
                  <SummaryTile
                    value={results.summary.mandates_created}
                    label="Mandates imported"
                    emphasis
                  />
                  <SummaryTile
                    value={results.summary.active_mandates_created}
                    label="Live Direct Debits"
                    emphasis
                  />
                </div>

                {results.errors.length > 0 && (
                  <MessageList
                    title="Errors"
                    tone="error"
                    messages={results.errors.map((e) => `${e.scope} row ${e.row}: ${e.message}`)}
                  />
                )}
                {results.warnings.length > 0 && (
                  <MessageList
                    title="Skipped rows"
                    tone="warning"
                    messages={results.warnings.map((w) => `${w.scope} row ${w.row}: ${w.message}`)}
                  />
                )}

                <div className="bg-dark-primary/80 border border-white/20 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3">
                    <ShieldCheck className="w-6 h-6 text-brand flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-white font-semibold mb-1">One thing left to do</h4>
                      <p className="text-text-secondary text-sm">
                        Connect your GoCardless account in Settings so {BRAND.name} can collect
                        against these mandates. The mandates themselves stay exactly where they are.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/settings"
                    className="px-6 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm min-h-[48px] flex items-center justify-center flex-shrink-0"
                  >
                    Go to Settings
                  </Link>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-4 border-t border-white/20">
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all min-h-[48px] flex items-center justify-center"
                  >
                    Import more exports
                  </button>
                  <Link
                    href="/admin/import"
                    className="px-8 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm min-h-[48px] flex items-center justify-center space-x-2"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Back to Data Import</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

function SummaryTile({
  value,
  label,
  emphasis = false,
}: {
  value: number;
  label: string;
  emphasis?: boolean;
}) {
  return (
    <div className="bg-dark-primary rounded-xl border border-white/20 p-3 text-center">
      <p className={`text-2xl font-bold ${emphasis ? 'text-brand' : 'text-white'}`}>{value}</p>
      <p className="text-text-secondary text-xs">{label}</p>
    </div>
  );
}

interface ResultTableRow {
  key: string;
  row: number;
  reference: string;
  detail: string;
  action: string;
  messages: string[];
}

function ResultTable({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: ResultTableRow[];
  emptyLabel: string;
}) {
  const badgeClass = (action: string) => {
    if (action === 'error') return 'bg-red-500 bg-opacity-20 text-red-400';
    if (action === 'skip') return 'bg-yellow-500 bg-opacity-20 text-yellow-400';
    if (action === 'match') return 'bg-white/10 text-white';
    return 'bg-brand bg-opacity-20 text-brand';
  };

  return (
    <div className="space-y-2">
      <h4 className="text-white font-semibold">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-text-secondary text-sm">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/20">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-dark-primary/80">
                <th className="px-4 py-3 text-left text-text-secondary font-semibold">#</th>
                <th className="px-4 py-3 text-left text-text-secondary font-semibold">Reference</th>
                <th className="px-4 py-3 text-left text-text-secondary font-semibold">Details</th>
                <th className="px-4 py-3 text-left text-text-secondary font-semibold">Action</th>
                <th className="px-4 py-3 text-left text-text-secondary font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-white/20">
                  <td className="px-4 py-3 text-text-tertiary">{row.row}</td>
                  <td className="px-4 py-3 text-white">{row.reference}</td>
                  <td className="px-4 py-3 text-text-secondary">{row.detail}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs font-bold rounded-full whitespace-nowrap ${badgeClass(row.action)}`}
                    >
                      {row.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{row.messages.join(' ') || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MessageList({
  title,
  tone,
  messages,
}: {
  title: string;
  tone: 'error' | 'warning';
  messages: string[];
}) {
  const wrapper =
    tone === 'error'
      ? 'bg-red-500 bg-opacity-10 border-red-500'
      : 'bg-yellow-500 bg-opacity-10 border-yellow-500';
  const heading = tone === 'error' ? 'text-red-400' : 'text-yellow-400';
  const body = tone === 'error' ? 'text-red-300' : 'text-yellow-200';

  return (
    <div className={`border rounded-xl p-4 ${wrapper}`}>
      <h4 className={`font-semibold mb-2 ${heading}`}>{title}</h4>
      <ul className="space-y-1">
        {messages.map((message, i) => (
          <li key={i} className={`text-sm ${body}`}>
            {message}
          </li>
        ))}
      </ul>
    </div>
  );
}
