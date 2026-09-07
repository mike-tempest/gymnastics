'use client';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';
import Link from 'next/link';
import Papa from 'papaparse';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import MigrationStepBanner, { MigrationStepReturn } from '@/components/import/MigrationStepBanner';
import MainLayout from '@/components/layout/MainLayout';
import { useMigrationStepReporter } from '@/hooks/useMigrationJourney';
import {
  type MemberImportPreviewResponse,
  type MemberImportResponse,
  type MemberImportRow,
  importMembers,
  previewMembersImport,
} from '@/lib/api/data-import';
import {
  BRAND,
  MEMBER_NOUN,
  MEMBER_NOUN_LOWER,
  MEMBER_NOUN_PLURAL,
  MEMBER_NOUN_PLURAL_LOWER,
} from '@/lib/brand';
import {
  type ClassForKidsRow,
  type ClassForKidsUpload,
  extractClassForKidsRows,
} from '@/lib/import/classforkids';
import { DOB_FORMAT_HINT } from '@/lib/import/date-of-birth';
import {
  IMPORT_FILE_ACCEPT,
  SpreadsheetParseError,
  parseImportFile,
} from '@/lib/import/spreadsheet';

type Step = 'upload' | 'preview' | 'importing' | 'results';

const STEP_LABELS: { key: Step; label: string }[] = [
  { key: 'upload', label: 'Upload spreadsheets' },
  { key: 'preview', label: 'Preview' },
  { key: 'importing', label: 'Import' },
  { key: 'results', label: 'Results' },
];

const FIELD_LABELS: Record<string, string> = {
  member_first_name: `${MEMBER_NOUN} first name`,
  member_last_name: `${MEMBER_NOUN} last name`,
  date_of_birth: 'Date of birth',
  gender: 'Gender',
  parent_name: 'Parent name',
  parent_email: 'Parent email',
};

const ROLE_LABELS: Record<string, string> = {
  people: 'Names and classes',
  financial: 'Money only',
  unknown: 'Not recognised',
};

interface UploadedFile extends ClassForKidsUpload {
  id: string;
}

type DryRunState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; data: MemberImportPreviewResponse }
  | { status: 'error'; message: string };

function toApiRow(row: ClassForKidsRow): MemberImportRow {
  const optional = (value: string) => (value ? value : undefined);
  return {
    member_first_name: row.member_first_name,
    member_last_name: row.member_last_name,
    dob: row.date_of_birth,
    gender: row.gender,
    squad_name: optional(row.squad_name),
    parent_name: row.parent_name,
    parent_email: row.parent_email,
    parent_phone: optional(row.parent_phone),
    address_line1: optional(row.address_line1),
    city: optional(row.city),
    postcode: optional(row.postcode),
  };
}

function downloadCsv(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ClassForKidsImportPage() {
  const migration = useMigrationStepReporter('classforkids');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dryRunSeq = useRef(0);
  const [step, setStep] = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [createMissingSquads, setCreateMissingSquads] = useState(true);
  const [dryRun, setDryRun] = useState<DryRunState>({ status: 'idle' });
  const [results, setResults] = useState<MemberImportResponse | null>(null);

  const stepIndex = STEP_LABELS.findIndex((s) => s.key === step);
  const extraction = useMemo(() => extractClassForKidsRows(files), [files]);
  const readyRows = extraction.rows.filter((row) => row.missing.length === 0);
  const incompleteRows = extraction.rows.filter((row) => row.missing.length > 0);

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
        added.push({ id: `${file.name}-${Date.now()}-${added.length}`, name: file.name, sheet });
      } catch (err) {
        failed.push(
          `${file.name}: ${err instanceof SpreadsheetParseError ? err.message : 'could not be parsed'}`
        );
      }
    }

    if (failed.length > 0) setParseError(failed.join('. '));
    if (added.length > 0) setFiles((current) => [...current, ...added]);
  };

  const runDryRun = async (rows: ClassForKidsRow[], createSquads: boolean) => {
    const seq = ++dryRunSeq.current;
    if (rows.length === 0) {
      setDryRun({ status: 'idle' });
      return;
    }
    setDryRun({ status: 'loading' });
    try {
      const data = await previewMembersImport(rows.map(toApiRow), {
        create_missing_squads: createSquads,
      });
      if (seq !== dryRunSeq.current) return;
      setDryRun({ status: 'done', data });
    } catch (err) {
      if (seq !== dryRunSeq.current) return;
      setDryRun({
        status: 'error',
        message: err instanceof Error ? err.message : 'The server check failed',
      });
    }
  };

  const handleContinue = () => {
    if (extraction.rows.length === 0) return;
    setStep('preview');
    void runDryRun(readyRows, createMissingSquads);
  };

  const handleToggleCreateSquads = (checked: boolean) => {
    setCreateMissingSquads(checked);
    void runDryRun(readyRows, checked);
  };

  const handleImport = async () => {
    if (readyRows.length === 0) return;
    // The import response carries no squad detail, so the migration checklist
    // takes its squad counts from the preview the club has just approved.
    const squadCounts =
      dryRun.status === 'done'
        ? {
            matched: dryRun.data.summary.squads_matched.length,
            created: createMissingSquads ? dryRun.data.summary.squads_missing.length : 0,
          }
        : { matched: 0, created: 0 };
    setStep('importing');
    try {
      const result = await importMembers(readyRows.map(toApiRow), {
        create_missing_squads: createMissingSquads,
      });
      setResults(result);
      migration.record({
        counts: {
          families: result.summary.families_created,
          members: result.summary.members_created,
          squadsMatched: squadCounts.matched,
          squadsCreated: squadCounts.created,
        },
        errorCount: result.errors.length,
        warningCount: incompleteRows.length,
      });
      const total = result.summary.members_created + result.summary.members_updated;
      if (total > 0 && result.errors.length === 0) {
        toast.success(
          `${total} ${total !== 1 ? MEMBER_NOUN_PLURAL_LOWER : MEMBER_NOUN_LOWER} imported successfully`
        );
      } else if (total > 0) {
        toast.success(
          `${total} ${total !== 1 ? MEMBER_NOUN_PLURAL_LOWER : MEMBER_NOUN_LOWER} imported with some errors`
        );
      } else {
        toast.error(`Import failed. No ${MEMBER_NOUN_PLURAL_LOWER} were added`);
      }
    } catch (err) {
      setResults({
        summary: { families_created: 0, members_created: 0, members_updated: 0 },
        errors: [{ row: 0, message: err instanceof Error ? err.message : 'Import failed' }],
      });
      toast.error(err instanceof Error ? err.message : `${MEMBER_NOUN} import failed`);
    }
    setStep('results');
  };

  const downloadIncomplete = () => {
    if (incompleteRows.length === 0) {
      toast.error('Nothing to complete');
      return;
    }
    const csv = Papa.unparse(
      incompleteRows.map((row) => ({
        member_first_name: row.member_first_name,
        member_last_name: row.member_last_name,
        date_of_birth: row.date_of_birth,
        gender: row.gender,
        parent_name: row.parent_name,
        parent_email: row.parent_email,
        parent_phone: row.parent_phone,
        squad: row.squad_name,
        venue: row.venue,
        day: row.day,
        postcode: row.postcode,
        still_needed: row.missing.map((field) => FIELD_LABELS[field] ?? field).join('; '),
      }))
    );
    downloadCsv('classforkids_rows_to_complete.csv', csv);
  };

  const handleReset = () => {
    setStep('upload');
    setFiles([]);
    setParseError(null);
    setCreateMissingSquads(true);
    setDryRun({ status: 'idle' });
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
              Import from ClassForKids
            </h1>
            <p className="text-grey-600 text-lg max-w-3xl">
              ClassForKids has no single export, so upload whichever spreadsheets you can download:
              contacts from the Schedule page, class registers, and the financial reports. We pull
              parents, {MEMBER_NOUN_PLURAL_LOWER} and classes out of all of them at once and merge
              the duplicates.
            </p>
          </div>

          <MigrationStepBanner
            active={migration.active}
            position={migration.position}
            total={migration.total}
          />

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
                <div className="bg-dark-primary/80 border border-white/20 rounded-xl p-4 flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-white text-sm font-semibold">
                      Card payments do not come with you
                    </p>
                    <p className="text-text-secondary text-sm">
                      ClassForKids collects by recurring card, and a card mandate cannot be
                      transferred to another platform. Families will set up a Direct Debit in{' '}
                      {BRAND.name} instead, which is cheaper for the club and does not expire when a
                      card does. This import brings across the people, not the payment method.
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">
                    1. Download what you can from ClassForKids
                  </h3>
                  <p className="text-text-secondary text-sm">
                    Contacts (Schedule page, then Send Messages or Export), class registers, and the
                    Financials Summary export. Upload as many as you have; the more files, the fewer
                    gaps. {DOB_FORMAT_HINT}
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">2. Upload them together</h3>
                  <div
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      if (e.dataTransfer.files) void processFiles(e.dataTransfer.files);
                    }}
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
                      onChange={(e) => {
                        if (e.target.files) void processFiles(e.target.files);
                      }}
                      className="hidden"
                    />
                    <Upload className="w-12 h-12 text-text-tertiary mb-4" />
                    <p className="text-white font-semibold mb-1">
                      Drag and drop your ClassForKids spreadsheets here
                    </p>
                    <p className="text-text-secondary text-sm">or click to browse</p>
                    <p className="text-text-tertiary text-xs mt-3">
                      .csv and .xlsx files, as many as you like
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
                    <h3 className="text-lg font-semibold text-white">Files to read</h3>
                    {files.map((file, i) => {
                      const summary = extraction.files[i];
                      if (!summary) return null;
                      return (
                        <div
                          key={file.id}
                          className="bg-dark-primary/80 border border-white/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                        >
                          <FileSpreadsheet className="w-6 h-6 text-brand flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold truncate">{summary.name}</p>
                            <p className="text-text-secondary text-sm">
                              {ROLE_LABELS[summary.role]}, {summary.rowCount} row
                              {summary.rowCount !== 1 ? 's' : ''}
                              {summary.role === 'people' &&
                                `, ${summary.peopleRows} ${
                                  summary.peopleRows !== 1
                                    ? MEMBER_NOUN_PLURAL_LOWER
                                    : MEMBER_NOUN_LOWER
                                } found`}
                            </p>
                            {summary.ignoredHeaders.length > 0 && (
                              <p className="text-text-tertiary text-xs mt-1 truncate">
                                Ignored columns: {summary.ignoredHeaders.join(', ')}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setFiles((current) => current.filter((f) => f.id !== file.id))
                            }
                            aria-label={`Remove ${summary.name}`}
                            className="min-h-[48px] min-w-[48px] flex items-center justify-center text-text-secondary hover:text-red-400 transition-colors rounded-xl border border-white/20"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      );
                    })}

                    {extraction.rows.length === 0 && (
                      <div className="bg-red-500 bg-opacity-10 border border-red-500 rounded-xl p-4 flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <p className="text-red-300 text-sm">
                          None of these files carry {MEMBER_NOUN_LOWER} names. Add a contacts export
                          or a class register.
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
                        disabled={extraction.rows.length === 0}
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
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center space-x-2 px-4 py-2 bg-brand bg-opacity-10 border border-brand border-opacity-30 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-brand" />
                    <span className="text-brand text-sm font-semibold">
                      {readyRows.length} ready to import
                    </span>
                  </div>
                  {incompleteRows.length > 0 && (
                    <div className="flex items-center space-x-2 px-4 py-2 bg-yellow-500 bg-opacity-10 border border-yellow-500 border-opacity-30 rounded-xl">
                      <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 text-sm font-semibold">
                        {incompleteRows.length} need more detail
                      </span>
                    </div>
                  )}
                  {extraction.mergedRows > 0 && (
                    <div className="flex items-center space-x-2 px-4 py-2 bg-dark-primary/80 border border-white/20 rounded-xl">
                      <span className="text-text-secondary text-sm font-semibold">
                        {extraction.mergedRows} duplicate row
                        {extraction.mergedRows !== 1 ? 's' : ''} merged across files
                      </span>
                    </div>
                  )}
                </div>

                {incompleteRows.length > 0 && (
                  <div className="bg-yellow-500 bg-opacity-10 border border-yellow-500 rounded-xl p-4 space-y-3">
                    <h4 className="text-yellow-400 font-semibold">
                      ClassForKids does not export everything we need
                    </h4>
                    <p className="text-yellow-200 text-sm">
                      {incompleteRows.length} {MEMBER_NOUN_PLURAL_LOWER} are missing a date of
                      birth, gender or parent email, which are all required. Download the list, fill
                      in the gaps, and bring it back through the {MEMBER_NOUN_PLURAL_LOWER} import.
                      The rest can be imported now.
                    </p>
                    <button
                      onClick={downloadIncomplete}
                      className="px-4 py-2 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all border border-white/20 min-h-[48px] text-sm flex items-center gap-2"
                    >
                      <Download className="w-5 h-5" />
                      <span>Download rows to complete</span>
                    </button>
                  </div>
                )}

                {extraction.amounts.length > 0 && (
                  <div className="bg-dark-primary/80 border border-white/20 rounded-xl p-4 space-y-2">
                    <h4 className="text-white font-semibold">Money columns (for context only)</h4>
                    <ul className="space-y-1">
                      {extraction.amounts.map((amount) => (
                        <li
                          key={`${amount.file}-${amount.column}`}
                          className="text-text-secondary text-sm"
                        >
                          {amount.file}, {amount.column}: {amount.rows} row
                          {amount.rows !== 1 ? 's' : ''} totalling{' '}
                          <span className="text-white">£{amount.total.toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-text-tertiary text-xs">
                      Nothing here is imported. Fees are set up separately once your{' '}
                      {MEMBER_NOUN_PLURAL_LOWER} and squads are in.
                    </p>
                  </div>
                )}

                <label className="flex items-center gap-3 bg-dark-primary/80 border border-white/20 rounded-xl p-4 cursor-pointer min-h-[48px]">
                  <input
                    type="checkbox"
                    checked={createMissingSquads}
                    onChange={(e) => handleToggleCreateSquads(e.target.checked)}
                    className="w-5 h-5 rounded accent-brand"
                  />
                  <div>
                    <p className="text-white text-sm font-semibold">
                      Create squads from ClassForKids class names
                    </p>
                    <p className="text-text-secondary text-xs">
                      Each class becomes a squad you can rename afterwards.
                    </p>
                  </div>
                </label>

                <div className="overflow-x-auto rounded-xl border border-white/20">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-dark-primary/80">
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">#</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">
                          {MEMBER_NOUN}
                        </th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">
                          Date of birth
                        </th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">
                          Class
                        </th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">
                          Parent
                        </th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {extraction.rows.map((row, i) => (
                        <tr
                          key={`${row.parent_email}-${row.member_first_name}-${row.member_last_name}`}
                          className={`border-t border-white/20 ${
                            row.missing.length > 0 ? 'bg-yellow-500 bg-opacity-5' : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-text-tertiary">{i + 1}</td>
                          <td className="px-4 py-3 text-white">
                            {row.member_first_name} {row.member_last_name}
                          </td>
                          <td
                            className={`px-4 py-3 ${row.date_of_birth ? 'text-text-secondary' : 'text-yellow-400 italic'}`}
                          >
                            {row.date_of_birth || 'missing'}
                          </td>
                          <td className="px-4 py-3 text-text-secondary">
                            {row.squad_name || '-'}
                            {row.additional_classes.length > 0 && (
                              <span className="text-text-tertiary">
                                {' '}
                                (also {row.additional_classes.join(', ')})
                              </span>
                            )}
                          </td>
                          <td
                            className={`px-4 py-3 ${row.parent_email ? 'text-text-secondary' : 'text-yellow-400 italic'}`}
                          >
                            {row.parent_email || row.parent_name || 'missing'}
                          </td>
                          <td className="px-4 py-3">
                            {row.missing.length > 0 ? (
                              <span
                                className="px-2 py-1 bg-yellow-500 bg-opacity-20 text-yellow-400 text-xs font-bold rounded-full whitespace-nowrap"
                                title={row.missing
                                  .map((field) => FIELD_LABELS[field] ?? field)
                                  .join(', ')}
                              >
                                Needs{' '}
                                {row.missing
                                  .map((field) => FIELD_LABELS[field] ?? field)
                                  .join(', ')}
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-brand bg-opacity-20 text-brand text-xs font-bold rounded-full whitespace-nowrap">
                                Ready
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-dark-primary/80 border border-white/20 rounded-xl p-4 space-y-3">
                  <h4 className="text-white font-semibold">Server check</h4>
                  {dryRun.status === 'idle' && (
                    <p className="text-text-secondary text-sm">
                      No complete rows to check yet. Add another file or fill in the gaps above.
                    </p>
                  )}
                  {dryRun.status === 'loading' && (
                    <div className="flex items-center space-x-2 text-text-secondary text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        Checking your rows against existing families, {MEMBER_NOUN_PLURAL_LOWER} and
                        squads...
                      </span>
                    </div>
                  )}
                  {dryRun.status === 'error' && (
                    <div className="space-y-3">
                      <p className="text-red-300 text-sm">
                        The server check could not be completed: {dryRun.message}
                      </p>
                      <button
                        onClick={() => runDryRun(readyRows, createMissingSquads)}
                        className="px-4 py-2 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all border border-white/20 min-h-[48px] text-sm"
                      >
                        Retry server check
                      </button>
                    </div>
                  )}
                  {dryRun.status === 'done' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <SummaryTile
                          value={dryRun.data.summary.families_to_create}
                          label="Families to create"
                          emphasis
                        />
                        <SummaryTile
                          value={dryRun.data.summary.families_matched}
                          label="Families matched"
                        />
                        <SummaryTile
                          value={dryRun.data.summary.members_to_create}
                          label={`${MEMBER_NOUN_PLURAL} to create`}
                          emphasis
                        />
                        <SummaryTile
                          value={dryRun.data.summary.members_to_update}
                          label={`${MEMBER_NOUN_PLURAL} to update`}
                        />
                      </div>
                      {dryRun.data.summary.squads_missing.length > 0 && (
                        <p className="text-text-secondary text-sm">
                          Classes with no matching squad:{' '}
                          <span className="text-white">
                            {dryRun.data.summary.squads_missing.join(', ')}
                          </span>
                          {createMissingSquads
                            ? '. They will be created during the import.'
                            : `. ${MEMBER_NOUN_PLURAL} in these classes will be imported without a squad.`}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-white/20">
                  <button
                    onClick={() => setStep('upload')}
                    className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all min-h-[48px] flex items-center justify-center"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={readyRows.length === 0 || dryRun.status === 'loading'}
                    className="px-8 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-2 min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    <Upload className="w-5 h-5" />
                    <span>
                      Import {readyRows.length}{' '}
                      {readyRows.length !== 1 ? MEMBER_NOUN_PLURAL : MEMBER_NOUN}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {step === 'importing' && (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 mx-auto rounded-full bg-brand bg-opacity-10 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-brand animate-spin" />
                </div>
                <h3 className="font-serif text-2xl text-white">
                  Importing {readyRows.length}{' '}
                  {readyRows.length !== 1 ? MEMBER_NOUN_PLURAL_LOWER : MEMBER_NOUN_LOWER}...
                </h3>
                <p className="text-text-secondary">
                  Families, {MEMBER_NOUN_PLURAL_LOWER} and squads are being added. No parent is
                  contacted.
                </p>
              </div>
            )}

            {step === 'results' && results && (
              <div className="space-y-6">
                <div className="text-center py-8">
                  {results.summary.members_created + results.summary.members_updated > 0 &&
                  results.errors.length === 0 ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand bg-opacity-10 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-brand" />
                      </div>
                      <h3 className="font-serif text-3xl text-white mb-2">Import complete</h3>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500 bg-opacity-10 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-yellow-400" />
                      </div>
                      <h3 className="font-serif text-3xl text-white mb-2">
                        Import finished with issues
                      </h3>
                    </>
                  )}
                  <p className="text-text-secondary">
                    Families will set up a Direct Debit when you invite them. Their ClassForKids
                    card payments are not carried over.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <SummaryTile
                    value={results.summary.families_created}
                    label="Families created"
                    emphasis
                  />
                  <SummaryTile
                    value={results.summary.members_created}
                    label={`${MEMBER_NOUN_PLURAL} created`}
                    emphasis
                  />
                  <SummaryTile
                    value={results.summary.members_updated}
                    label={`${MEMBER_NOUN_PLURAL} updated`}
                  />
                </div>

                {results.errors.length > 0 && (
                  <div className="bg-red-500 bg-opacity-10 border border-red-500 rounded-xl p-4">
                    <h4 className="text-red-400 font-semibold mb-2">Errors</h4>
                    <ul className="space-y-1">
                      {results.errors.map((error, i) => (
                        <li key={i} className="text-red-300 text-sm">
                          Row {error.row}: {error.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-4 border-t border-white/20">
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all min-h-[48px] flex items-center justify-center"
                  >
                    Import more files
                  </button>
                  <MigrationStepReturn active={migration.active} />
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
