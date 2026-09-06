'use client';

import { Upload, FileCheck, AlertTriangle, CheckCircle2, ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import Papa from 'papaparse';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import { type CreateSquadInput, bulkImportSquads } from '@/lib/api/squads';

interface ParsedRow {
  squad_name: string;
  description: string;
  min_age: string;
  max_age: string;
  coach_name: string;
  training_times: string;
  max_capacity: string;
  _raw: Record<string, string>;
}

interface RowValidation {
  row: number;
  errors: string[];
}

interface SubmittedRow {
  originalIndex: number;
  raw: Record<string, string>;
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'results';

const EXPECTED_HEADERS = [
  'squad_name',
  'description',
  'min_age',
  'max_age',
  'coach_name',
  'training_times',
  'max_capacity',
];

const TEMPLATE_CSV = `squad_name,description,min_age,max_age,coach_name,training_times,max_capacity
Learn to Swim,Beginner lessons for new members,4,8,Sarah Hughes,"Mon 17:00-17:45, Sat 09:00-09:45",20
Development,Stroke technique and fitness for improving members,8,12,Tom Bradley,"Tue 18:00-19:00, Thu 18:00-19:00",24
Performance,Competitive squad for county and regional members,12,18,Emma Clarke,"Mon-Fri 05:30-07:00, Sat 07:00-09:00",30`;

function isNonNegativeInteger(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function validateRow(row: ParsedRow, index: number, duplicateNames: Set<string>): RowValidation {
  const errors: string[] = [];

  const name = row.squad_name.trim();
  if (!name) {
    errors.push('Squad name is required');
  } else if (duplicateNames.has(name.toLowerCase())) {
    errors.push('Squad name is duplicated within the file');
  }

  if (row.min_age.trim() && !isNonNegativeInteger(row.min_age)) {
    errors.push('Minimum age must be a non-negative whole number');
  }
  if (row.max_age.trim() && !isNonNegativeInteger(row.max_age)) {
    errors.push('Maximum age must be a non-negative whole number');
  }
  if (
    row.min_age.trim() &&
    row.max_age.trim() &&
    isNonNegativeInteger(row.min_age) &&
    isNonNegativeInteger(row.max_age) &&
    parseInt(row.min_age.trim(), 10) > parseInt(row.max_age.trim(), 10)
  ) {
    errors.push('Minimum age must not be greater than maximum age');
  }
  if (row.max_capacity.trim() && !isNonNegativeInteger(row.max_capacity)) {
    errors.push('Maximum capacity must be a non-negative whole number');
  }

  return { row: index, errors };
}

function findDuplicateNames(rows: ParsedRow[]): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const row of rows) {
    const name = row.squad_name.trim().toLowerCase();
    if (!name) continue;
    if (seen.has(name)) {
      duplicates.add(name);
    }
    seen.add(name);
  }
  return duplicates;
}

export default function SquadsImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ImportStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validations, setValidations] = useState<RowValidation[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<0 | 50 | 100>(0);
  const [submittedRows, setSubmittedRows] = useState<SubmittedRow[]>([]);
  const [importResults, setImportResults] = useState<{
    successCount: number;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);

  const errorCount = validations.filter((v) => v.errors.length > 0).length;
  const validCount = parsedRows.length - errorCount;

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'squads_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadFailedRows = () => {
    if (!importResults) return;
    const failedRows = importResults.errors
      .filter((err) => err.row > 0 && err.row <= submittedRows.length)
      .map((err) => {
        const submitted = submittedRows[err.row - 1];
        return {
          row: String(submitted.originalIndex + 1),
          ...submitted.raw,
          error: err.message,
        };
      });
    if (failedRows.length === 0) return;
    const csv = Papa.unparse(failedRows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'squads_import_failed_rows.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setParseError('Please upload a CSV file.');
      return;
    }

    setFileName(file.name);
    setParseError(null);
    setImportResults(null);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (results) => {
        if (results.errors.length > 0) {
          const firstError = results.errors[0];
          setParseError(`CSV parsing error (row ${(firstError.row ?? 0) + 1}): ${firstError.message}`);
          return;
        }

        const headers = results.meta.fields || [];
        if (!headers.includes('squad_name')) {
          setParseError(
            `Missing required column: squad_name. ` +
            `Expected headers: ${EXPECTED_HEADERS.join(', ')}`
          );
          setParsedRows([]);
          return;
        }

        const rows: ParsedRow[] = results.data.map((raw) => ({
          squad_name: (raw.squad_name || '').trim(),
          description: (raw.description || '').trim(),
          min_age: (raw.min_age || '').trim(),
          max_age: (raw.max_age || '').trim(),
          coach_name: (raw.coach_name || '').trim(),
          training_times: (raw.training_times || '').trim(),
          max_capacity: (raw.max_capacity || '').trim(),
          _raw: raw,
        }));

        const duplicateNames = findDuplicateNames(rows);
        const rowValidations = rows.map((row, i) => validateRow(row, i, duplicateNames));

        setParsedRows(rows);
        setValidations(rowValidations);
        setStep('preview');
      },
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
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
    const validEntries: Array<{ row: ParsedRow; originalIndex: number }> = [];
    parsedRows.forEach((row, i) => {
      if (validations[i].errors.length === 0) {
        validEntries.push({ row, originalIndex: i });
      }
    });
    if (validEntries.length === 0) return;

    setStep('importing');
    setImportProgress(0);
    setSubmittedRows(validEntries.map((entry) => ({
      originalIndex: entry.originalIndex,
      raw: entry.row._raw,
    })));

    const squadInputs: CreateSquadInput[] = validEntries.map(({ row }) => ({
      squad_name: row.squad_name.trim(),
      description: row.description.trim() || undefined,
      min_age: row.min_age.trim() ? parseInt(row.min_age.trim(), 10) : undefined,
      max_age: row.max_age.trim() ? parseInt(row.max_age.trim(), 10) : undefined,
      coach_name: row.coach_name.trim() || undefined,
      training_times: row.training_times.trim() || undefined,
      max_capacity: row.max_capacity.trim() ? parseInt(row.max_capacity.trim(), 10) : undefined,
    }));

    try {
      setImportProgress(50);
      const result = await bulkImportSquads(squadInputs);
      setImportProgress(100);
      setImportResults({
        successCount: result.created.length,
        errors: result.errors || [],
      });
      if (result.created.length > 0 && (!result.errors || result.errors.length === 0)) {
        toast.success(`${result.created.length} squad${result.created.length !== 1 ? 's' : ''} imported successfully`);
      } else if (result.created.length > 0) {
        toast.success(`${result.created.length} squad${result.created.length !== 1 ? 's' : ''} imported with some errors`);
      } else {
        toast.error('Import failed. No squads were added');
      }
    } catch (err) {
      setImportResults({
        successCount: 0,
        errors: [{ row: 0, message: err instanceof Error ? err.message : 'Import failed' }],
      });
      toast.error(err instanceof Error ? err.message : 'CSV import failed');
    }

    setStep('results');
  };

  const handleReset = () => {
    setStep('upload');
    setFileName(null);
    setParsedRows([]);
    setValidations([]);
    setParseError(null);
    setImportProgress(0);
    setSubmittedRows([]);
    setImportResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const failedRowCount = importResults
    ? importResults.errors.filter((err) => err.row > 0 && err.row <= submittedRows.length).length
    : 0;

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <Link
                href="/squads"
                className="inline-flex items-center space-x-2 text-text-secondary hover:text-brand transition-colors mb-3 min-h-[48px]"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Squads</span>
              </Link>
              <h1 className="font-serif text-4xl sm:text-5xl text-dark-primary tracking-tight mb-2">Import Squads</h1>
              <p className="text-grey-600 text-lg">
                Upload a CSV file to add multiple squads at once
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div className="bg-dark-primary rounded-3xl shadow-lg p-4 sm:p-8 border border-white/20">
            {/* Upload Step */}
            {step === 'upload' && (
              <div className="space-y-8">
                {/* Template Download */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-3">
                    1. Download the template
                  </h3>
                  <p className="text-text-secondary text-sm mb-3">
                    Required column: <span className="text-white font-medium">squad_name</span>.
                    Other columns (description, min_age, max_age, coach_name, training_times, max_capacity) are optional.
                  </p>
                  <button
                    onClick={downloadTemplate}
                    className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all border border-white/20 flex items-center space-x-2 min-h-[48px]"
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
                      accept=".csv"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Upload className="w-12 h-12 text-text-tertiary mb-4" />
                    <p className="text-white font-semibold mb-1">
                      Drag and drop your CSV file here
                    </p>
                    <p className="text-text-secondary text-sm">or click to browse</p>
                    <p className="text-text-tertiary text-xs mt-3">Only .csv files are accepted</p>
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
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 bg-dark-primary/80 text-text-secondary rounded-xl font-semibold hover:bg-white/5 hover:text-white transition-all border border-white/20 min-h-[48px] text-sm"
                  >
                    Choose different file
                  </button>
                </div>

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
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Squad Name</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Description</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Min Age</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Max Age</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Coach</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Training Times</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Capacity</th>
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
                            <td className={`px-4 py-3 ${
                              rowErrors.some((e) => e.toLowerCase().includes('squad name'))
                                ? 'text-red-400 italic'
                                : 'text-white'
                            }`}>
                              {row.squad_name || 'missing'}
                            </td>
                            <td className="px-4 py-3 text-text-secondary">{row.description || '-'}</td>
                            <td className={`px-4 py-3 ${
                              rowErrors.some((e) => e.toLowerCase().includes('minimum age'))
                                ? 'text-red-400'
                                : 'text-text-secondary'
                            }`}>
                              {row.min_age || '-'}
                            </td>
                            <td className={`px-4 py-3 ${
                              rowErrors.some((e) => e.toLowerCase().includes('maximum age') || e.toLowerCase().includes('greater than maximum age'))
                                ? 'text-red-400'
                                : 'text-text-secondary'
                            }`}>
                              {row.max_age || '-'}
                            </td>
                            <td className="px-4 py-3 text-text-secondary">{row.coach_name || '-'}</td>
                            <td className="px-4 py-3 text-text-secondary">{row.training_times || '-'}</td>
                            <td className={`px-4 py-3 ${
                              rowErrors.some((e) => e.toLowerCase().includes('capacity'))
                                ? 'text-red-400'
                                : 'text-text-secondary'
                            }`}>
                              {row.max_capacity || '-'}
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
                    href="/squads"
                    className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all text-center min-h-[48px] flex items-center justify-center"
                  >
                    Cancel
                  </Link>
                  <button
                    onClick={handleImport}
                    disabled={validCount === 0}
                    className="px-8 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-2 min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                  >
                    <Upload className="w-5 h-5" />
                    <span>
                      Import {validCount} Squad{validCount !== 1 ? 's' : ''}
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
                  <h3 className="font-serif text-2xl text-white mb-2">Importing squads...</h3>
                  <p className="text-text-secondary">Please wait while your squads are being added.</p>
                </div>
                <div className="max-w-md mx-auto">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-text-secondary text-sm">Progress</p>
                    <p className="text-brand font-bold text-sm">{importProgress}%</p>
                  </div>
                  <div className="w-full bg-dark-primary/80 rounded-full h-3 overflow-hidden">
                    <div
                      className={`bg-brand h-full rounded-full transition-all duration-500 ${
                        importProgress === 100 ? 'w-full' : importProgress === 50 ? 'w-1/2' : 'w-0'
                      }`}
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
                        Successfully imported {importResults.successCount} squad{importResults.successCount !== 1 ? 's' : ''}.
                      </p>
                    </>
                  ) : importResults.successCount > 0 ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500 bg-opacity-10 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-yellow-400" />
                      </div>
                      <h3 className="font-serif text-3xl text-white mb-2">Import Partially Complete</h3>
                      <p className="text-text-secondary">
                        {importResults.successCount} squad{importResults.successCount !== 1 ? 's' : ''} imported successfully.{' '}
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
                        No squads were imported. Please check the errors below.
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                      <h4 className="text-red-400 font-semibold">Errors</h4>
                      {failedRowCount > 0 && (
                        <button
                          onClick={downloadFailedRows}
                          className="px-4 py-2 bg-dark-primary/80 text-red-300 rounded-xl font-semibold hover:bg-white/5 transition-all border border-red-500/40 flex items-center justify-center space-x-2 min-h-[48px] text-sm"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download failed rows</span>
                        </button>
                      )}
                    </div>
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
                    className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all min-h-[48px] flex items-center justify-center space-x-2"
                  >
                    <FileCheck className="w-5 h-5" />
                    <span>Import Another File</span>
                  </button>
                  <Link
                    href="/squads"
                    className="px-8 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm min-h-[48px] flex items-center justify-center space-x-2"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Back to Squads</span>
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
