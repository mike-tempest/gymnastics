'use client';

import { governingBodyConfig, defaultGoverningBodyForCountry } from '@club-manager/shared-types';
import { Upload, FileCheck, AlertTriangle, CheckCircle2, ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import ColumnMappingStep from '@/components/import/ColumnMappingStep';
import SwimCentralHint from '@/components/import/SwimCentralHint';
import MainLayout from '@/components/layout/MainLayout';
import { useClubRegion } from '@/hooks/useClubRegion';
import { type CreateMemberInput, bulkImportMembers } from '@/lib/api/members';
import { MEMBER_NOUN, MEMBER_NOUN_LOWER, MEMBER_NOUN_PLURAL, MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';
import { DOB_FORMAT_HINT, parseDateOfBirth } from '@/lib/import/date-of-birth';
import { type AutoMapField, autoMapHeaders, normaliseGender } from '@/lib/import/header-mapping';
import {
  IMPORT_FILE_ACCEPT,
  SpreadsheetParseError,
  parseImportFile,
} from '@/lib/import/spreadsheet';

type MemberField = 'first_name' | 'last_name' | 'dob' | 'gender' | 'registration_number' | 'squad' | 'family';

interface ParsedRow {
  first_name: string;
  last_name: string;
  /** Raw date value from the file, for display when it cannot be parsed. */
  dob: string;
  /** Date of birth normalised to YYYY-MM-DD, or empty when invalid. */
  dob_iso: string;
  gender: string;
  registration_number: string;
  squad: string;
  family: string;
  _raw: Record<string, string>;
}

interface RowValidation {
  row: number;
  errors: string[];
}

type ImportStep = 'upload' | 'map' | 'preview' | 'importing' | 'results';

const MEMBER_FIELD_KEYS: readonly MemberField[] = [
  'first_name',
  'last_name',
  'dob',
  'gender',
  'registration_number',
  'squad',
  'family',
];

const AUTO_MAP_FIELDS: readonly AutoMapField<MemberField>[] = [
  { key: 'first_name', canonical: 'first_name' },
  { key: 'last_name', canonical: 'last_name' },
  { key: 'dob', canonical: 'date_of_birth' },
  { key: 'gender', canonical: 'gender' },
  { key: 'registration_number', canonical: 'registration_number' },
  { key: 'squad', canonical: 'squad' },
  { key: 'family', canonical: 'family' },
];

const REQUIRED_FIELDS: readonly MemberField[] = ['first_name', 'last_name', 'dob'];

type Mapping = Partial<Record<MemberField, string>>;

const TEMPLATE_CSV = `first_name,last_name,dob,gender,registration_number,squad,family
Olivia,Thompson,2015-03-14,F,12345,,
James,Wilson,2013-08-22,M,67890,,`;

function buildRows(rawRows: Record<string, string>[], mapping: Mapping): ParsedRow[] {
  return rawRows.map((raw) => {
    const value = (field: MemberField) => {
      const source = mapping[field];
      return source ? (raw[source] ?? '').trim() : '';
    };
    const dob = value('dob');
    const gender = value('gender');
    return {
      first_name: value('first_name'),
      last_name: value('last_name'),
      dob,
      dob_iso: parseDateOfBirth(dob) ?? '',
      gender: normaliseGender(gender) ?? gender.toUpperCase(),
      registration_number: value('registration_number'),
      squad: value('squad'),
      family: value('family'),
      _raw: raw,
    };
  });
}

function validateRow(row: ParsedRow, index: number): RowValidation {
  const errors: string[] = [];

  if (!row.first_name.trim()) {
    errors.push('First name is required');
  }
  if (!row.last_name.trim()) {
    errors.push('Last name is required');
  }
  if (!row.dob.trim()) {
    errors.push('Date of birth is required');
  } else if (!row.dob_iso) {
    errors.push('Date of birth must be a valid date in YYYY-MM-DD or DD/MM/YYYY format');
  }
  if (row.gender && !['M', 'F', 'X'].includes(row.gender.toUpperCase())) {
    errors.push('Gender must be M, F, or X');
  }

  return { row: index, errors };
}

export default function MembersImportPage() {
  const { country, club } = useClubRegion();
  // The registration_number CSV column holds whatever the club's governing body calls
  // the registration number ("SE number", "Member number", ...).
  const registrationLabel = governingBodyConfig(
    club?.governing_body ?? defaultGoverningBodyForCountry(country),
  ).registrationNumberLabel;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploadedHeaders, setUploadedHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [autoMatched, setAutoMatched] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validations, setValidations] = useState<RowValidation[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importResults, setImportResults] = useState<{
    successCount: number;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);

  const errorCount = validations.filter((v) => v.errors.length > 0).length;
  const validCount = parsedRows.length - errorCount;

  const mappingFields = MEMBER_FIELD_KEYS.map((key) => ({
    key,
    label:
      key === 'registration_number'
        ? registrationLabel
        : key === 'dob'
        ? 'Date of birth'
        : key === 'squad'
        ? 'Squad ID'
        : key === 'family'
        ? 'Family ID'
        : key === 'first_name'
        ? 'First name'
        : key === 'last_name'
        ? 'Last name'
        : 'Gender',
    required: REQUIRED_FIELDS.includes(key),
  }));

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'members_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const goToPreview = useCallback((rows: Record<string, string>[], currentMapping: Mapping) => {
    const built = buildRows(rows, currentMapping);
    setParsedRows(built);
    setValidations(built.map((row, i) => validateRow(row, i)));
    setStep('preview');
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      setFileName(file.name);
      setParseError(null);
      setImportResults(null);

      try {
        const parsed = await parseImportFile(file);
        if (parsed.headers.length === 0 || parsed.rows.length === 0) {
          setParseError('The file must have a header row and at least one data row.');
          return;
        }

        const autoMapping = autoMapHeaders(parsed.headers, AUTO_MAP_FIELDS);
        const allRequiredMapped = REQUIRED_FIELDS.every((f) => autoMapping[f]);

        setUploadedHeaders(parsed.headers);
        setRawRows(parsed.rows);
        setMapping(autoMapping);
        setAutoMatched(allRequiredMapped);

        if (allRequiredMapped) {
          // Happy path: every required column matched, go straight to the
          // preview. The mapping stays adjustable from there.
          goToPreview(parsed.rows, autoMapping);
        } else {
          setStep('map');
        }
      } catch (err) {
        setParseError(
          err instanceof SpreadsheetParseError ? err.message : 'The file could not be parsed.',
        );
      }
    },
    [goToPreview],
  );

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

  const handleImport = async () => {
    const validRows = parsedRows.filter((_, i) => validations[i].errors.length === 0);
    if (validRows.length === 0) return;

    setStep('importing');
    setImportProgress(0);

    const memberInputs: CreateMemberInput[] = validRows.map((row) => ({
      first_name: row.first_name.trim(),
      last_name: row.last_name.trim(),
      dob: row.dob_iso,
      gender: row.gender || 'X',
      registration_number: row.registration_number.trim() || undefined,
      squad_id: row.squad.trim() || undefined,
      family_id: row.family.trim() || undefined,
    }));

    try {
      setImportProgress(50);
      const result = await bulkImportMembers(memberInputs);
      setImportProgress(100);
      setImportResults({
        successCount: result.created.length,
        errors: result.errors || [],
      });
      if (result.created.length > 0 && (!result.errors || result.errors.length === 0)) {
        toast.success(`${result.created.length} ${result.created.length !== 1 ? MEMBER_NOUN_PLURAL_LOWER : MEMBER_NOUN_LOWER} imported successfully`);
      } else if (result.created.length > 0) {
        toast.success(`${result.created.length} ${result.created.length !== 1 ? MEMBER_NOUN_PLURAL_LOWER : MEMBER_NOUN_LOWER} imported with some errors`);
      } else {
        toast.error(`Import failed. No ${MEMBER_NOUN_PLURAL_LOWER} were added`);
      }
    } catch (err) {
      setImportResults({
        successCount: 0,
        errors: [{ row: 0, message: err instanceof Error ? err.message : 'Import failed' }],
      });
      toast.error(err instanceof Error ? err.message : 'Import failed');
    }

    setStep('results');
  };

  const handleReset = () => {
    setStep('upload');
    setFileName(null);
    setUploadedHeaders([]);
    setRawRows([]);
    setMapping({});
    setAutoMatched(false);
    setParsedRows([]);
    setValidations([]);
    setParseError(null);
    setImportProgress(0);
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
                href="/members"
                className="inline-flex items-center space-x-2 text-text-secondary hover:text-brand transition-colors mb-3 min-h-[44px]"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to {MEMBER_NOUN_PLURAL}</span>
              </Link>
              <h1 className="font-serif text-4xl sm:text-5xl text-dark-primary tracking-tight mb-2">Import {MEMBER_NOUN_PLURAL}</h1>
              <p className="text-grey-600 text-lg">
                Upload a CSV or Excel file to add multiple {MEMBER_NOUN_PLURAL_LOWER} at once
              </p>
            </div>
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
                    Required columns: <span className="text-white font-medium">first_name</span>,{' '}
                    <span className="text-white font-medium">last_name</span>, and{' '}
                    <span className="text-white font-medium">dob</span>. Other columns (gender, registration_number, squad, family) are optional.
                    {registrationLabel !== 'SE number' && (
                      <> The registration_number column holds each {MEMBER_NOUN_LOWER}&apos;s {registrationLabel}.</>
                    )}{' '}
                    Exports from other systems work too: column names are matched automatically and
                    you can adjust the mapping before importing. {DOB_FORMAT_HINT}
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all border border-white/20 flex items-center space-x-2 min-h-[44px]"
                  >
                    <Download className="w-5 h-5" />
                    <span>Download CSV Template</span>
                  </button>
                </div>

                {/* File Upload Area */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">
                    2. Upload your file
                  </h3>
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
                    <p className="text-text-tertiary text-xs mt-3">.csv and .xlsx files are accepted</p>
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
                fields={mappingFields}
                mapping={mapping}
                onMappingChange={(fieldKey, header) =>
                  setMapping((m) => ({ ...m, [fieldKey]: header }))
                }
                onChooseDifferentFile={handleReset}
                onCancel={handleReset}
                onContinue={() => goToPreview(rawRows, mapping)}
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
                        {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} found
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setStep('map')}
                      className="px-4 py-2 bg-dark-primary/80 text-text-secondary rounded-xl font-semibold hover:bg-white/5 hover:text-white transition-all border border-white/20 min-h-[44px] text-sm"
                    >
                      Adjust column mapping
                    </button>
                    <button
                      onClick={handleReset}
                      className="px-4 py-2 bg-dark-primary/80 text-text-secondary rounded-xl font-semibold hover:bg-white/5 hover:text-white transition-all border border-white/20 min-h-[44px] text-sm"
                    >
                      Choose different file
                    </button>
                  </div>
                </div>

                {autoMatched && (
                  <div className="bg-brand bg-opacity-10 border border-brand border-opacity-30 rounded-xl p-4">
                    <p className="text-brand text-sm">
                      Your columns were matched automatically. If something looks off, use
                      &quot;Adjust column mapping&quot; above.
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

                {/* Preview Table */}
                <div className="overflow-x-auto rounded-xl border border-white/20">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-dark-primary/80">
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">#</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">First Name</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Last Name</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">DOB</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Gender</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">{registrationLabel}</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Squad</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Family</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.map((row, i) => {
                        const rowErrors = validations[i]?.errors || [];
                        const hasRowError = rowErrors.length > 0;
                        return (
                          <tr
                            key={i}
                            className={`border-t border-white/20 ${
                              hasRowError ? 'bg-red-500 bg-opacity-5' : ''
                            }`}
                            title={hasRowError ? rowErrors.join(', ') : undefined}
                          >
                            <td className="px-4 py-3 text-text-tertiary">{i + 1}</td>
                            <td className={`px-4 py-3 ${!row.first_name.trim() ? 'text-red-400 italic' : 'text-white'}`}>
                              {row.first_name || 'missing'}
                            </td>
                            <td className={`px-4 py-3 ${!row.last_name.trim() ? 'text-red-400 italic' : 'text-white'}`}>
                              {row.last_name || 'missing'}
                            </td>
                            <td className={`px-4 py-3 ${
                              rowErrors.some((e) => e.toLowerCase().includes('date'))
                                ? 'text-red-400'
                                : !row.dob.trim()
                                ? 'text-red-400 italic'
                                : 'text-white'
                            }`}>
                              {row.dob_iso || row.dob || 'missing'}
                            </td>
                            <td className={`px-4 py-3 ${
                              rowErrors.some((e) => e.toLowerCase().includes('gender'))
                                ? 'text-red-400'
                                : 'text-text-secondary'
                            }`}>
                              {row.gender || '-'}
                            </td>
                            <td className="px-4 py-3 text-text-secondary">{row.registration_number || '-'}</td>
                            <td className="px-4 py-3 text-text-secondary">{row.squad || '-'}</td>
                            <td className="px-4 py-3 text-text-secondary">{row.family || '-'}</td>
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
                      {validations
                        .filter((v) => v.errors.length > 0)
                        .map((v) =>
                          v.errors.map((err, i) => (
                            <li key={`${v.row}-${i}`} className="text-red-300 text-sm">
                              Row {v.row + 1}: {err}
                            </li>
                          ))
                        )}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-white/20">
                  <Link
                    href="/members"
                    className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all text-center min-h-[44px] flex items-center justify-center"
                  >
                    Cancel
                  </Link>
                  <button
                    onClick={handleImport}
                    disabled={validCount === 0}
                    className="px-8 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-2 min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
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
                    <Upload className="w-8 h-8 text-brand animate-pulse" />
                  </div>
                  <h3 className="font-serif text-2xl text-white mb-2">Importing {MEMBER_NOUN_PLURAL_LOWER}...</h3>
                  <p className="text-text-secondary">Please wait while your {MEMBER_NOUN_PLURAL_LOWER} are being added.</p>
                </div>
                <div className="max-w-md mx-auto">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-text-secondary text-sm">Progress</p>
                    <p className="text-brand font-bold text-sm">{importProgress}%</p>
                  </div>
                  <div className="w-full bg-dark-primary/80 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-brand h-full rounded-full transition-all duration-500"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Results Step */}
            {step === 'results' && importResults && (
              <div className="space-y-6">
                {/* Result Summary */}
                <div className="text-center py-8">
                  {importResults.successCount > 0 && importResults.errors.length === 0 ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand bg-opacity-10 flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8 text-brand" />
                      </div>
                      <h3 className="font-serif text-3xl text-white mb-2">Import Complete</h3>
                      <p className="text-text-secondary">
                        Successfully imported {importResults.successCount} {importResults.successCount !== 1 ? MEMBER_NOUN_PLURAL_LOWER : MEMBER_NOUN_LOWER}.
                      </p>
                    </>
                  ) : importResults.successCount > 0 ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500 bg-opacity-10 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-yellow-400" />
                      </div>
                      <h3 className="font-serif text-3xl text-white mb-2">Import Partially Complete</h3>
                      <p className="text-text-secondary">
                        {importResults.successCount} {importResults.successCount !== 1 ? MEMBER_NOUN_PLURAL_LOWER : MEMBER_NOUN_LOWER} imported successfully.{' '}
                        {importResults.errors.length} failed.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500 bg-opacity-10 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-400" />
                      </div>
                      <h3 className="font-serif text-3xl text-white mb-2">Import Failed</h3>
                      <p className="text-text-secondary">
                        No {MEMBER_NOUN_PLURAL_LOWER} were imported. Please check the errors below.
                      </p>
                    </>
                  )}
                </div>

                {/* Result Stats */}
                <div className="flex flex-wrap justify-center gap-4">
                  <div className="px-6 py-4 bg-brand bg-opacity-10 border border-brand border-opacity-30 rounded-xl text-center min-w-[140px]">
                    <p className="text-brand text-3xl font-bold">{importResults.successCount}</p>
                    <p className="text-text-secondary text-sm">Imported</p>
                  </div>
                  {importResults.errors.length > 0 && (
                    <div className="px-6 py-4 bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-xl text-center min-w-[140px]">
                      <p className="text-red-400 text-3xl font-bold">{importResults.errors.length}</p>
                      <p className="text-text-secondary text-sm">Failed</p>
                    </div>
                  )}
                </div>

                {/* Per-Row Errors */}
                {importResults.errors.length > 0 && (
                  <div className="bg-red-500 bg-opacity-10 border border-red-500 rounded-xl p-4">
                    <h4 className="text-red-400 font-semibold mb-2">Errors</h4>
                    <ul className="space-y-1">
                      {importResults.errors.map((err, i) => (
                        <li key={i} className="text-red-300 text-sm">
                          {err.row > 0 ? `Row ${err.row}: ` : ''}{err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 pt-4 border-t border-white/20">
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all min-h-[44px] flex items-center justify-center space-x-2"
                  >
                    <FileCheck className="w-5 h-5" />
                    <span>Import Another File</span>
                  </button>
                  <Link
                    href="/members"
                    className="px-8 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm min-h-[44px] flex items-center justify-center space-x-2"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Back to {MEMBER_NOUN_PLURAL}</span>
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
