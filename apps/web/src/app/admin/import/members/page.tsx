'use client';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileCheck,
  FileSpreadsheet,
  Loader2,
  Mail,
  Upload,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import Papa from 'papaparse';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

import ColumnMappingStep from '@/components/import/ColumnMappingStep';
import MigrationStepBanner, { MigrationStepReturn } from '@/components/import/MigrationStepBanner';
import SwimCentralHint from '@/components/import/SwimCentralHint';
import MainLayout from '@/components/layout/MainLayout';
import { useClubRegion } from '@/hooks/useClubRegion';
import { useMigrationStepReporter } from '@/hooks/useMigrationJourney';
import {
  type MemberImportError,
  type MemberImportPreviewResponse,
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
import { DOB_FORMAT_HINT, parseDateOfBirth } from '@/lib/import/date-of-birth';
import { type AutoMapField, autoMapHeaders, normaliseGender } from '@/lib/import/header-mapping';
import {
  IMPORT_FILE_ACCEPT,
  SpreadsheetParseError,
  parseImportFile,
} from '@/lib/import/spreadsheet';

type ImportStep = 'upload' | 'map' | 'preview' | 'importing' | 'results';

type CanonicalField =
  | 'member_first_name'
  | 'member_last_name'
  | 'date_of_birth'
  | 'gender'
  | 'registration_number'
  | 'governing_body'
  | 'squad_name'
  | 'medical_notes'
  | 'emergency_contact'
  | 'parent_name'
  | 'parent_email'
  | 'parent_phone'
  | 'family_name'
  | 'address_line1'
  | 'address_line2'
  | 'city'
  | 'postcode';

const CANONICAL_FIELDS: { key: CanonicalField; label: string; required: boolean }[] = [
  { key: 'member_first_name', label: `${MEMBER_NOUN} first name`, required: true },
  { key: 'member_last_name', label: `${MEMBER_NOUN} last name`, required: true },
  { key: 'date_of_birth', label: 'Date of birth', required: true },
  { key: 'gender', label: 'Gender', required: true },
  { key: 'parent_name', label: 'Parent name', required: true },
  { key: 'parent_email', label: 'Parent email', required: true },
  { key: 'registration_number', label: 'Membership / registration number', required: false },
  { key: 'governing_body', label: 'Governing body', required: false },
  { key: 'squad_name', label: 'Squad', required: false },
  { key: 'medical_notes', label: 'Medical notes', required: false },
  { key: 'emergency_contact', label: 'Emergency contact', required: false },
  { key: 'parent_phone', label: 'Parent phone', required: false },
  { key: 'family_name', label: 'Family name', required: false },
  { key: 'address_line1', label: 'Address line 1', required: false },
  { key: 'address_line2', label: 'Address line 2', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'postcode', label: 'Postcode', required: false },
];

const REQUIRED_FIELDS = CANONICAL_FIELDS.filter((f) => f.required).map((f) => f.key);

/**
 * Auto-mapping targets: each page field, tagged with the canonical concept
 * whose synonyms live in the shared header-mapping lib. Headers matching
 * the field key itself (e.g. a re-uploaded template of ours) always win, so
 * a family_name column still maps to the family grouping even though
 * "Family Name" is also a surname synonym in other systems' exports.
 */
const AUTO_MAP_FIELDS: readonly AutoMapField<CanonicalField>[] = [
  { key: 'member_first_name', canonical: 'first_name' },
  { key: 'member_last_name', canonical: 'last_name' },
  { key: 'date_of_birth', canonical: 'date_of_birth' },
  { key: 'gender', canonical: 'gender' },
  { key: 'registration_number', canonical: 'registration_number' },
  { key: 'governing_body', canonical: 'governing_body' },
  { key: 'squad_name', canonical: 'squad' },
  { key: 'medical_notes', canonical: 'medical_notes' },
  { key: 'emergency_contact', canonical: 'emergency_contact' },
  { key: 'parent_name', canonical: 'parent_name' },
  { key: 'parent_email', canonical: 'parent_email' },
  { key: 'parent_phone', canonical: 'parent_phone' },
  { key: 'family_name', canonical: 'family' },
  { key: 'address_line1', canonical: 'address_line1' },
  { key: 'address_line2', canonical: 'address_line2' },
  { key: 'city', canonical: 'city' },
  { key: 'postcode', canonical: 'postcode' },
];

const TEMPLATE_CSV = `member_first_name,member_last_name,date_of_birth,gender,registration_number,governing_body,squad,medical_notes,emergency_contact,parent_name,parent_email,parent_phone,family_name,address_line1,address_line2,city,postcode
Olivia,Hartley,2014-05-12,F,1234567,BRITISH_GYMNASTICS,Juniors,Mild asthma (inhaler in kit bag),Sarah Hartley 07700 900123,Sarah Hartley,sarah.hartley@example.co.uk,07700 900123,Hartley,14 Meadow Lane,,Leeds,LS6 3AB
Thomas,Hartley,2012-09-30,M,1234568,BRITISH_GYMNASTICS,Performance,,Sarah Hartley 07700 900123,Sarah Hartley,sarah.hartley@example.co.uk,07700 900123,Hartley,14 Meadow Lane,,Leeds,LS6 3AB
Amelia,Rhys-Jones,2015-01-22,F,2345678,BRITISH_GYMNASTICS,Recreational,,David Rhys-Jones 07700 900456,David Rhys-Jones,d.rhysjones@example.co.uk,07700 900456,Rhys-Jones,7 Castle View,Pontcanna,Cardiff,CF11 9LJ`;

const STEP_LABELS: { key: ImportStep; label: string }[] = [
  { key: 'upload', label: 'Upload' },
  { key: 'map', label: 'Map columns' },
  { key: 'preview', label: 'Preview' },
  { key: 'importing', label: 'Import' },
  { key: 'results', label: 'Results' },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mapping = Record<CanonicalField, string>;

const EMPTY_MAPPING = CANONICAL_FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {} as Mapping);

interface DraftRow {
  values: Record<CanonicalField, string>;
  raw: Record<string, string>;
}

interface RowValidation {
  errors: string[];
  normalisedDate: string;
  normalisedGender: string;
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

function validateRow(row: DraftRow): RowValidation {
  const errors: string[] = [];
  const v = row.values;

  if (!v.member_first_name) errors.push(`${MEMBER_NOUN} first name is required`);
  if (!v.member_last_name) errors.push(`${MEMBER_NOUN} last name is required`);

  let normalisedDate = '';
  if (!v.date_of_birth) {
    errors.push('Date of birth is required');
  } else {
    const date = parseDateOfBirth(v.date_of_birth);
    if (!date) {
      errors.push('Date of birth must be a valid date in YYYY-MM-DD or DD/MM/YYYY format');
    } else {
      normalisedDate = date;
    }
  }

  let normalisedGender = '';
  if (!v.gender) {
    errors.push('Gender is required');
  } else {
    const gender = normaliseGender(v.gender, ['M', 'F']);
    if (!gender) {
      errors.push('Gender must be M, F, Male or Female');
    } else {
      normalisedGender = gender;
    }
  }

  if (!v.parent_name) errors.push('Parent name is required');
  if (!v.parent_email) {
    errors.push('Parent email is required');
  } else if (!EMAIL_REGEX.test(v.parent_email)) {
    errors.push('Parent email does not look like a valid email address');
  }

  return { errors, normalisedDate, normalisedGender };
}

function toApiRow(row: DraftRow, validation: RowValidation): MemberImportRow {
  const v = row.values;
  const optional = (value: string) => (value ? value : undefined);

  return {
    member_first_name: v.member_first_name,
    member_last_name: v.member_last_name,
    dob: validation.normalisedDate,
    gender: validation.normalisedGender,
    registration_number: optional(v.registration_number),
    governing_body: optional(v.governing_body),
    squad_name: optional(v.squad_name),
    medical_notes: optional(v.medical_notes),
    emergency_contact: optional(v.emergency_contact),
    parent_name: v.parent_name,
    parent_email: v.parent_email,
    parent_phone: optional(v.parent_phone),
    family_name: optional(v.family_name),
    address_line1: optional(v.address_line1),
    address_line2: optional(v.address_line2),
    city: optional(v.city),
    postcode: optional(v.postcode),
  };
}

type DryRunState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; data: MemberImportPreviewResponse }
  | { status: 'error'; message: string };

export default function MembersImportPage() {
  const { country } = useClubRegion();
  const migration = useMigrationStepReporter('members');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dryRunSeq = useRef(0);
  const [step, setStep] = useState<ImportStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [uploadedHeaders, setUploadedHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [autoMatched, setAutoMatched] = useState(false);

  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);
  const [validations, setValidations] = useState<RowValidation[]>([]);
  const [createMissingSquads, setCreateMissingSquads] = useState(true);
  const [dryRun, setDryRun] = useState<DryRunState>({ status: 'idle' });

  const [submittedEntries, setSubmittedEntries] = useState<
    { raw: Record<string, string>; originalRow: number }[]
  >([]);
  const [importResults, setImportResults] = useState<{
    familiesCreated: number;
    membersCreated: number;
    membersUpdated: number;
    errors: MemberImportError[];
  } | null>(null);

  const errorCount = validations.filter((v) => v.errors.length > 0).length;
  const validCount = draftRows.length - errorCount;
  const unmappedRequired = REQUIRED_FIELDS.filter((f) => !mapping[f]);
  const stepIndex = STEP_LABELS.findIndex((s) => s.key === step);

  const downloadTemplate = () => {
    downloadCsv('members_import_template.csv', TEMPLATE_CSV);
  };

  const processFile = async (file: File) => {
    setFileName(file.name);
    setParseError(null);
    setImportResults(null);

    try {
      const parsed = await parseImportFile(file);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setParseError('The file must have a header row and at least one data row.');
        return;
      }

      const guessed = autoMapHeaders(parsed.headers, AUTO_MAP_FIELDS);
      const autoMapping: Mapping = { ...EMPTY_MAPPING };
      for (const field of CANONICAL_FIELDS) {
        autoMapping[field.key] = guessed[field.key] ?? '';
      }
      const allRequiredMapped = REQUIRED_FIELDS.every((f) => autoMapping[f]);

      setUploadedHeaders(parsed.headers);
      setRawRows(parsed.rows);
      setMapping(autoMapping);
      setAutoMatched(allRequiredMapped);

      if (allRequiredMapped) {
        // Happy path: every required column matched automatically, so go
        // straight to the preview. The mapping stays adjustable from there.
        continueToPreview(parsed.rows, autoMapping);
      } else {
        setStep('map');
      }
    } catch (err) {
      setParseError(
        err instanceof SpreadsheetParseError ? err.message : 'The file could not be parsed.'
      );
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const runDryRun = async (
    rows: DraftRow[],
    rowValidations: RowValidation[],
    createSquads: boolean
  ) => {
    const apiRows = rows
      .map((row, i) => ({ row, validation: rowValidations[i] }))
      .filter(({ validation }) => validation.errors.length === 0)
      .map(({ row, validation }) => toApiRow(row, validation));

    const seq = ++dryRunSeq.current;

    if (apiRows.length === 0) {
      setDryRun({ status: 'idle' });
      return;
    }

    setDryRun({ status: 'loading' });
    try {
      const data = await previewMembersImport(apiRows, { create_missing_squads: createSquads });
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

  const continueToPreview = (sourceRows: Record<string, string>[], mappingToUse: Mapping) => {
    const rows: DraftRow[] = sourceRows.map((raw) => {
      const values = {} as Record<CanonicalField, string>;
      for (const field of CANONICAL_FIELDS) {
        const source = mappingToUse[field.key];
        values[field.key] = source ? (raw[source] ?? '').trim() : '';
      }
      return { values, raw };
    });

    const rowValidations = rows.map((row) => validateRow(row));

    setDraftRows(rows);
    setValidations(rowValidations);
    setStep('preview');
    void runDryRun(rows, rowValidations, createMissingSquads);
  };

  const handleContinueToPreview = () => {
    if (unmappedRequired.length > 0) return;
    continueToPreview(rawRows, mapping);
  };

  const handleToggleCreateSquads = (checked: boolean) => {
    setCreateMissingSquads(checked);
    void runDryRun(draftRows, validations, checked);
  };

  const handleImport = async () => {
    const validEntries = draftRows
      .map((row, i) => ({ row, validation: validations[i], originalRow: i + 1 }))
      .filter(({ validation }) => validation.errors.length === 0);
    if (validEntries.length === 0) return;

    const apiRows = validEntries.map(({ row, validation }) => toApiRow(row, validation));
    setSubmittedEntries(
      validEntries.map(({ row, originalRow }) => ({ raw: row.raw, originalRow }))
    );

    // The import response carries no squad detail, so the migration checklist
    // takes the squad names from the preview the club has just approved.
    const squads =
      dryRun.status === 'done'
        ? {
            matched: dryRun.data.summary.squads_matched,
            created: createMissingSquads ? dryRun.data.summary.squads_missing : [],
          }
        : { matched: [], created: [] };

    setStep('importing');

    try {
      const result = await importMembers(apiRows, { create_missing_squads: createMissingSquads });
      setImportResults({
        familiesCreated: result.summary.families_created,
        membersCreated: result.summary.members_created,
        membersUpdated: result.summary.members_updated,
        errors: result.errors || [],
      });
      migration.record({
        counts: {
          families: result.summary.families_created,
          members: result.summary.members_created,
        },
        squads,
        errorCount: (result.errors || []).length,
        warningCount: 0,
      });

      const total = result.summary.members_created + result.summary.members_updated;
      if (total > 0 && (!result.errors || result.errors.length === 0)) {
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
      setImportResults({
        familiesCreated: 0,
        membersCreated: 0,
        membersUpdated: 0,
        errors: [{ row: 0, message: err instanceof Error ? err.message : 'Import failed' }],
      });
      toast.error(err instanceof Error ? err.message : `${MEMBER_NOUN} import failed`);
    }

    setStep('results');
  };

  const downloadFailedRows = () => {
    if (!importResults) return;

    const failed: { originalRow: number | null; record: Record<string, string> }[] = [];

    for (const err of importResults.errors) {
      const entry =
        err.row >= 1 && err.row <= submittedEntries.length ? submittedEntries[err.row - 1] : null;
      if (entry) {
        failed.push({
          originalRow: entry.originalRow,
          record: { ...entry.raw, error: err.message },
        });
      } else {
        failed.push({ originalRow: null, record: { error: err.message } });
      }
    }

    for (let i = 0; i < draftRows.length; i++) {
      if (validations[i].errors.length > 0) {
        failed.push({
          originalRow: i + 1,
          record: { ...draftRows[i].raw, error: validations[i].errors.join('; ') },
        });
      }
    }

    if (failed.length === 0) {
      toast.error('No failed rows to download');
      return;
    }

    failed.sort(
      (a, b) =>
        (a.originalRow ?? Number.MAX_SAFE_INTEGER) - (b.originalRow ?? Number.MAX_SAFE_INTEGER)
    );

    const csv = Papa.unparse(
      failed.map((f) => f.record),
      { columns: [...uploadedHeaders.filter((h) => h !== 'error'), 'error'] }
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'members_import_failed_rows.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setStep('upload');
    setFileName(null);
    setParseError(null);
    setUploadedHeaders([]);
    setRawRows([]);
    setMapping(EMPTY_MAPPING);
    setAutoMatched(false);
    setDraftRows([]);
    setValidations([]);
    setCreateMissingSquads(true);
    setDryRun({ status: 'idle' });
    setSubmittedEntries([]);
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <Link
                href="/admin/import"
                className="inline-flex items-center space-x-2 text-text-secondary hover:text-brand transition-colors mb-3 min-h-[48px]"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Data Import</span>
              </Link>
              <h1 className="font-serif text-4xl sm:text-5xl text-dark-primary tracking-tight mb-2">
                Import {MEMBER_NOUN_PLURAL}
              </h1>
              <p className="text-grey-600 text-lg">
                Upload a CSV or Excel file to add members and their families in one go
              </p>
            </div>
          </div>

          <MigrationStepBanner
            active={migration.active}
            position={migration.position}
            total={migration.total}
          />

          {/* Step Indicator */}
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

          {/* Main Content */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-4 sm:p-8 border border-white/20">
            {/* Upload Step */}
            {step === 'upload' && (
              <div className="space-y-8">
                <SwimCentralHint country={country} />

                {/* Template Download */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">
                    1. Download the template
                  </h3>
                  <p className="text-text-secondary text-sm mb-3">
                    Required columns:{' '}
                    <span className="text-white font-medium">member_first_name</span>,{' '}
                    <span className="text-white font-medium">member_last_name</span>,{' '}
                    <span className="text-white font-medium">date_of_birth</span>,{' '}
                    <span className="text-white font-medium">gender</span>,{' '}
                    <span className="text-white font-medium">parent_name</span> and{' '}
                    <span className="text-white font-medium">parent_email</span>.{' '}
                    {MEMBER_NOUN_PLURAL} with the same parent email are grouped into one family.
                    Exports from other systems work too, because you can match your columns to{' '}
                    {BRAND.name} fields in the next step. {DOB_FORMAT_HINT}
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all border border-white/20 flex items-center space-x-2 min-h-[48px]"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download CSV Template</span>
                  </button>
                  <p className="text-text-tertiary text-xs mt-3">
                    A vendor export usually needs no template at all. Thrive4 and LoveAdmin contact
                    reports (Contact First Name, Account Holder, Groups), Coacha and Gymcatch member
                    exports and My BG membership numbers are all recognised automatically. Leaving
                    ClassForKids or GoCardless? Those have{' '}
                    <Link href="/admin/import" className="text-brand hover:underline">
                      their own routes
                    </Link>
                    .
                  </p>
                </div>

                {/* File Upload Area */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">2. Upload your file</h3>
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
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
                      accept={IMPORT_FILE_ACCEPT}
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Upload className="w-12 h-12 text-text-tertiary mb-4" />
                    <p className="text-white font-semibold mb-1">
                      Drag and drop your CSV or Excel file here
                    </p>
                    <p className="text-text-secondary text-sm">or click to browse</p>
                    <p className="text-text-tertiary text-xs mt-3">
                      .csv and .xlsx files are accepted
                    </p>
                  </div>
                </div>

                {/* Parse Error */}
                {parseError && (
                  <div className="bg-red-500 bg-opacity-10 border border-red-500 rounded-xl p-4 flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-red-300 text-sm">{parseError}</p>
                  </div>
                )}
              </div>
            )}

            {/* Map Step */}
            {step === 'map' && (
              <ColumnMappingStep
                fileName={fileName}
                rowCount={rawRows.length}
                headers={uploadedHeaders}
                fields={CANONICAL_FIELDS}
                mapping={mapping}
                onMappingChange={(fieldKey, header) =>
                  setMapping((m) => ({ ...m, [fieldKey]: header }))
                }
                onChooseDifferentFile={handleReset}
                onCancel={handleReset}
                onContinue={handleContinueToPreview}
                autoMatched={autoMatched}
              />
            )}

            {/* Preview Step */}
            {step === 'preview' && (
              <div className="space-y-6">
                {/* Summary Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-3">
                    <FileSpreadsheet className="w-6 h-6 text-brand" />
                    <div>
                      <p className="text-white font-semibold">{fileName}</p>
                      <p className="text-text-secondary text-sm">
                        {draftRows.length} row{draftRows.length !== 1 ? 's' : ''} found
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setStep('map')}
                    className="px-4 py-2 bg-dark-primary/80 text-text-secondary rounded-xl font-semibold hover:bg-white/5 hover:text-white transition-all border border-white/20 min-h-[48px] text-sm"
                  >
                    Back to column mapping
                  </button>
                </div>

                {autoMatched && (
                  <div className="bg-brand bg-opacity-10 border border-brand border-opacity-30 rounded-xl p-4">
                    <p className="text-brand text-sm">
                      Your columns were matched automatically. If something looks off, use
                      &quot;Back to column mapping&quot; above.
                    </p>
                  </div>
                )}

                {/* Validation Summary */}
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center space-x-2 px-4 py-2 bg-brand bg-opacity-10 border border-brand border-opacity-30 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-brand" />
                    <span className="text-brand text-sm font-semibold">
                      {validCount} valid row{validCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {errorCount > 0 && (
                    <div className="flex items-center space-x-2 px-4 py-2 bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-xl">
                      <AlertTriangle className="w-4 h-4 text-red-400" />
                      <span className="text-red-400 text-sm font-semibold">
                        {errorCount} row{errorCount !== 1 ? 's' : ''} with errors
                      </span>
                    </div>
                  )}
                </div>

                {/* Squad Option */}
                <label className="flex items-center gap-3 bg-dark-primary/80 border border-white/20 rounded-xl p-4 cursor-pointer min-h-[48px]">
                  <input
                    type="checkbox"
                    checked={createMissingSquads}
                    onChange={(e) => handleToggleCreateSquads(e.target.checked)}
                    className="w-5 h-5 rounded accent-brand"
                  />
                  <div>
                    <p className="text-white text-sm font-semibold">
                      Create squads that don&apos;t exist yet
                    </p>
                    <p className="text-text-secondary text-xs">
                      Squad names in your file that don&apos;t match an existing squad will be
                      created during the import.
                    </p>
                  </div>
                </label>

                {/* Preview Table */}
                <div className="overflow-x-auto rounded-xl border border-white/20">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-dark-primary/80">
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">#</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">
                          First Name
                        </th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">
                          Last Name
                        </th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">
                          Date of Birth
                        </th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">
                          Gender
                        </th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">
                          Squad
                        </th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">
                          Parent
                        </th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">
                          Parent Email
                        </th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftRows.map((row, i) => {
                        const validation = validations[i];
                        const rowErrors = validation?.errors || [];
                        const hasRowError = rowErrors.length > 0;
                        const v = row.values;
                        return (
                          <tr
                            key={i}
                            className={`border-t border-white/20 ${
                              hasRowError ? 'bg-red-500 bg-opacity-5' : ''
                            }`}
                            title={hasRowError ? rowErrors.join(', ') : undefined}
                          >
                            <td className="px-4 py-3 text-text-tertiary">{i + 1}</td>
                            <td
                              className={`px-4 py-3 ${!v.member_first_name ? 'text-red-400 italic' : 'text-white'}`}
                            >
                              {v.member_first_name || 'missing'}
                            </td>
                            <td
                              className={`px-4 py-3 ${!v.member_last_name ? 'text-red-400 italic' : 'text-white'}`}
                            >
                              {v.member_last_name || 'missing'}
                            </td>
                            <td
                              className={`px-4 py-3 ${
                                rowErrors.some((e) => e.toLowerCase().includes('date'))
                                  ? 'text-red-400'
                                  : !v.date_of_birth
                                    ? 'text-red-400 italic'
                                    : 'text-white'
                              }`}
                            >
                              {validation?.normalisedDate || v.date_of_birth || 'missing'}
                            </td>
                            <td
                              className={`px-4 py-3 ${
                                rowErrors.some((e) => e.toLowerCase().includes('gender'))
                                  ? 'text-red-400'
                                  : 'text-text-secondary'
                              }`}
                            >
                              {validation?.normalisedGender || v.gender || 'missing'}
                            </td>
                            <td className="px-4 py-3 text-text-secondary">{v.squad_name || '-'}</td>
                            <td
                              className={`px-4 py-3 ${!v.parent_name ? 'text-red-400 italic' : 'text-text-secondary'}`}
                            >
                              {v.parent_name || 'missing'}
                            </td>
                            <td
                              className={`px-4 py-3 ${
                                rowErrors.some((e) => e.toLowerCase().includes('email'))
                                  ? 'text-red-400'
                                  : 'text-text-secondary'
                              }`}
                            >
                              {v.parent_email || 'missing'}
                            </td>
                            <td className="px-4 py-3">
                              {hasRowError ? (
                                <span className="px-2 py-1 bg-red-500 bg-opacity-20 text-red-400 text-xs font-bold rounded-full whitespace-nowrap">
                                  Error
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-brand bg-opacity-20 text-brand text-xs font-bold rounded-full whitespace-nowrap">
                                  Valid
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Error Details */}
                {errorCount > 0 && (
                  <div className="bg-red-500 bg-opacity-10 border border-red-500 rounded-xl p-4">
                    <h4 className="text-red-400 font-semibold mb-2">
                      Rows with errors will be skipped during import.
                    </h4>
                    <ul className="space-y-1">
                      {validations.map((v, rowIdx) =>
                        v.errors.map((err, i) => (
                          <li key={`${rowIdx}-${i}`} className="text-red-300 text-sm">
                            Row {rowIdx + 1}: {err}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                )}

                {/* Server Dry Run */}
                <div className="bg-dark-primary/80 border border-white/20 rounded-xl p-4 space-y-3">
                  <h4 className="text-white font-semibold">Server check</h4>
                  {dryRun.status === 'idle' && (
                    <p className="text-text-secondary text-sm">
                      No valid rows to check. Fix the errors above or go back to column mapping.
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
                        The server check could not be completed: {dryRun.message}. You can still run
                        the import, but you won&apos;t see a summary of what will change first.
                      </p>
                      <button
                        onClick={() => runDryRun(draftRows, validations, createMissingSquads)}
                        className="px-4 py-2 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all border border-white/20 min-h-[48px] text-sm"
                      >
                        Retry server check
                      </button>
                    </div>
                  )}
                  {dryRun.status === 'done' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-dark-primary rounded-xl border border-white/20 p-3 text-center">
                          <p className="text-brand text-2xl font-bold">
                            {dryRun.data.summary.families_to_create}
                          </p>
                          <p className="text-text-secondary text-xs">Families to create</p>
                        </div>
                        <div className="bg-dark-primary rounded-xl border border-white/20 p-3 text-center">
                          <p className="text-white text-2xl font-bold">
                            {dryRun.data.summary.families_matched}
                          </p>
                          <p className="text-text-secondary text-xs">Families matched</p>
                        </div>
                        <div className="bg-dark-primary rounded-xl border border-white/20 p-3 text-center">
                          <p className="text-brand text-2xl font-bold">
                            {dryRun.data.summary.members_to_create}
                          </p>
                          <p className="text-text-secondary text-xs">
                            {MEMBER_NOUN_PLURAL} to create
                          </p>
                        </div>
                        <div className="bg-dark-primary rounded-xl border border-white/20 p-3 text-center">
                          <p className="text-white text-2xl font-bold">
                            {dryRun.data.summary.members_to_update}
                          </p>
                          <p className="text-text-secondary text-xs">
                            {MEMBER_NOUN_PLURAL} to update
                          </p>
                        </div>
                      </div>
                      {dryRun.data.summary.squads_matched.length > 0 && (
                        <p className="text-text-secondary text-sm">
                          Squads matched:{' '}
                          <span className="text-white">
                            {dryRun.data.summary.squads_matched.join(', ')}
                          </span>
                        </p>
                      )}
                      {dryRun.data.summary.squads_missing.length > 0 && (
                        <p className="text-text-secondary text-sm">
                          Squads not found:{' '}
                          <span className="text-white">
                            {dryRun.data.summary.squads_missing.join(', ')}
                          </span>
                          {createMissingSquads
                            ? '. They will be created during the import.'
                            : `. ${MEMBER_NOUN_PLURAL} in these squads will be imported without a squad.`}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-white/20">
                  <button
                    onClick={() => setStep('map')}
                    className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all min-h-[48px] flex items-center justify-center"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={validCount === 0 || dryRun.status === 'loading'}
                    className="px-8 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-2 min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    <Upload className="w-5 h-5" />
                    <span>
                      Import {validCount} {validCount !== 1 ? MEMBER_NOUN_PLURAL : MEMBER_NOUN}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* Importing Step */}
            {step === 'importing' && (
              <div className="py-12 space-y-6">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand bg-opacity-10 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-brand animate-spin" />
                  </div>
                  <h3 className="font-serif text-2xl text-white mb-2">
                    Importing {submittedEntries.length}{' '}
                    {submittedEntries.length !== 1 ? MEMBER_NOUN_PLURAL_LOWER : MEMBER_NOUN_LOWER}
                    ...
                  </h3>
                  <p className="text-text-secondary">
                    Please wait while families, {MEMBER_NOUN_PLURAL_LOWER} and squads are being
                    added. This can take a moment for larger files.
                  </p>
                </div>
                <div className="max-w-md mx-auto">
                  <div className="w-full bg-dark-primary/80 rounded-full h-3 overflow-hidden">
                    <div className="bg-brand h-full w-1/3 rounded-full animate-pulse" />
                  </div>
                </div>
              </div>
            )}

            {/* Results Step */}
            {step === 'results' && importResults && (
              <div className="space-y-6">
                {/* Result Summary */}
                <div className="text-center py-8">
                  {importResults.membersCreated + importResults.membersUpdated > 0 &&
                  importResults.errors.length === 0 ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand bg-opacity-10 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-brand" />
                      </div>
                      <h3 className="font-serif text-3xl text-white mb-2">Import Complete</h3>
                      <p className="text-text-secondary">
                        Your {MEMBER_NOUN_PLURAL_LOWER} were imported successfully.
                      </p>
                    </>
                  ) : importResults.membersCreated + importResults.membersUpdated > 0 ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500 bg-opacity-10 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-yellow-400" />
                      </div>
                      <h3 className="font-serif text-3xl text-white mb-2">
                        Import Partially Complete
                      </h3>
                      <p className="text-text-secondary">
                        Some rows were imported successfully. {importResults.errors.length} failed.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500 bg-opacity-10 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                      </div>
                      <h3 className="font-serif text-3xl text-white mb-2">Import Failed</h3>
                      <p className="text-text-secondary">
                        No members were imported. Please check the errors below.
                      </p>
                    </>
                  )}
                </div>

                {/* Result Stats */}
                <div className="flex flex-wrap justify-center gap-4">
                  <div className="px-6 py-4 bg-brand bg-opacity-10 border border-brand border-opacity-30 rounded-xl text-center min-w-[140px]">
                    <p className="text-brand text-3xl font-bold">{importResults.familiesCreated}</p>
                    <p className="text-text-secondary text-sm">Families created</p>
                  </div>
                  <div className="px-6 py-4 bg-brand bg-opacity-10 border border-brand border-opacity-30 rounded-xl text-center min-w-[140px]">
                    <p className="text-brand text-3xl font-bold">{importResults.membersCreated}</p>
                    <p className="text-text-secondary text-sm">{MEMBER_NOUN_PLURAL} created</p>
                  </div>
                  <div className="px-6 py-4 bg-dark-primary/80 border border-white/20 rounded-xl text-center min-w-[140px]">
                    <p className="text-white text-3xl font-bold">{importResults.membersUpdated}</p>
                    <p className="text-text-secondary text-sm">{MEMBER_NOUN_PLURAL} updated</p>
                  </div>
                  {(importResults.errors.length > 0 || errorCount > 0) && (
                    <div className="px-6 py-4 bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-xl text-center min-w-[140px]">
                      <p className="text-red-400 text-3xl font-bold">
                        {importResults.errors.length + errorCount}
                      </p>
                      <p className="text-text-secondary text-sm">Failed or skipped</p>
                    </div>
                  )}
                </div>

                {/* Per-Row Errors */}
                {importResults.errors.length > 0 && (
                  <div className="bg-red-500 bg-opacity-10 border border-red-500 rounded-xl p-4">
                    <h4 className="text-red-400 font-semibold mb-2">Errors</h4>
                    <ul className="space-y-1">
                      {importResults.errors.map((err, i) => {
                        const entry =
                          err.row >= 1 && err.row <= submittedEntries.length
                            ? submittedEntries[err.row - 1]
                            : null;
                        return (
                          <li key={i} className="text-red-300 text-sm">
                            {entry ? `Row ${entry.originalRow}: ` : ''}
                            {err.message}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Failed Rows Download */}
                {(importResults.errors.length > 0 || errorCount > 0) && (
                  <div className="flex justify-center">
                    <button
                      onClick={downloadFailedRows}
                      className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all border border-white/20 flex items-center space-x-2 min-h-[48px]"
                    >
                      <Download className="w-5 h-5" />
                      <span>Download Failed Rows</span>
                    </button>
                  </div>
                )}

                {/* Invite Parents CTA */}
                <div className="bg-dark-primary/80 border border-white/20 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3">
                    <Mail className="w-6 h-6 text-brand flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-white font-semibold mb-1">
                        Invite parents to their accounts
                      </h4>
                      <p className="text-text-secondary text-sm">
                        The import does not send invites automatically, so parents haven&apos;t been
                        contacted yet. Head to Families to review the new families and send invites
                        when you&apos;re ready.
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/families"
                    className="px-6 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm min-h-[48px] flex items-center justify-center space-x-2 flex-shrink-0"
                  >
                    <Users className="w-5 h-5" />
                    <span>Invite Parents</span>
                  </Link>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-4 border-t border-white/20">
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all min-h-[48px] flex items-center justify-center space-x-2"
                  >
                    <FileCheck className="w-5 h-5" />
                    <span>Import Another File</span>
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
