'use client';

import { Upload, FileCheck, AlertTriangle, CheckCircle2, ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import Papa from 'papaparse';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import { useClubRegion } from '@/hooks/useClubRegion';
import { type BulkFeeStructureInput, bulkImportFeeStructures } from '@/lib/api/finance';
import { downloadCsv } from '@/lib/csv-export';

interface ParsedRow {
  name: string;
  description: string;
  amount: string;
  frequency: string;
  applies_to: string;
  squad_name: string;
  _raw: Record<string, string>;
  _sourceRow: number;
}

interface RowValidation {
  row: number;
  errors: string[];
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'results';

const EXPECTED_HEADERS = ['name', 'description', 'amount', 'frequency', 'applies_to', 'squad_name'];

const REQUIRED_HEADERS = ['name', 'amount', 'frequency', 'applies_to'];

const FREQUENCIES = ['monthly', 'annual', 'one_time'];

const APPLIES_TO = ['club', 'squad'];

const TEMPLATE_CSV = `name,description,amount,frequency,applies_to,squad_name
Club Membership,Monthly membership fee for all members,35.00,monthly,club,
Performance Squad Fee,Monthly training fee for the Performance squad,52.50,monthly,squad,Performance
Annual Registration,Yearly Swim England registration fee,25.00,annual,club,`;

function parseAmount(value: string): number | null {
  const cleaned = value.trim().replace(/^[£$€]\s*/, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return null;
  }
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? null : amount;
}

function validateRow(row: ParsedRow, index: number): RowValidation {
  const errors: string[] = [];

  if (!row.name) {
    errors.push('Name is required');
  }
  if (!row.amount) {
    errors.push('Amount is required');
  } else if (parseAmount(row.amount) === null) {
    errors.push('Amount must be a non-negative number, for example 35 or 35.00');
  }
  if (!row.frequency) {
    errors.push('Frequency is required');
  } else if (!FREQUENCIES.includes(row.frequency)) {
    errors.push('Frequency must be monthly, annual or one_time');
  }
  if (!row.applies_to) {
    errors.push('Applies to is required');
  } else if (!APPLIES_TO.includes(row.applies_to)) {
    errors.push('Applies to must be club or squad');
  } else if (row.applies_to === 'squad' && !row.squad_name) {
    errors.push('Squad name is required when applies to is squad');
  }

  return { row: index, errors };
}

const PROGRESS_WIDTH_CLASSES = [
  'w-0',
  'w-1/12',
  'w-2/12',
  'w-3/12',
  'w-4/12',
  'w-5/12',
  'w-6/12',
  'w-7/12',
  'w-8/12',
  'w-9/12',
  'w-10/12',
  'w-11/12',
  'w-full',
];

function progressWidthClass(progress: number): string {
  const clamped = Math.min(Math.max(progress, 0), 100);
  const twelfths = Math.round((clamped / 100) * 12);
  return PROGRESS_WIDTH_CLASSES[twelfths];
}

export default function FeeStructuresImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currency } = useClubRegion();
  const [step, setStep] = useState<ImportStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validations, setValidations] = useState<RowValidation[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [submittedRows, setSubmittedRows] = useState<ParsedRow[]>([]);
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
    a.download = 'fee_structures_import_template.csv';
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
        const missingRequired = REQUIRED_HEADERS.filter((h) => !headers.includes(h));

        if (missingRequired.length > 0) {
          setParseError(
            `Missing required columns: ${missingRequired.join(', ')}. ` +
            `Expected headers: ${EXPECTED_HEADERS.join(', ')}`
          );
          setParsedRows([]);
          return;
        }

        const rows: ParsedRow[] = results.data.map((raw, i) => ({
          name: (raw.name || '').trim(),
          description: (raw.description || '').trim(),
          amount: (raw.amount || '').trim(),
          frequency: (raw.frequency || '').trim().toLowerCase(),
          applies_to: (raw.applies_to || '').trim().toLowerCase(),
          squad_name: (raw.squad_name || '').trim(),
          _raw: raw,
          _sourceRow: i + 1,
        }));

        const rowValidations = rows.map((row, i) => validateRow(row, i));

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
    const validRows = parsedRows.filter((_, i) => validations[i].errors.length === 0);
    if (validRows.length === 0) return;

    setStep('importing');
    setImportProgress(0);

    const submitted: ParsedRow[] = [];
    const feeStructureInputs: BulkFeeStructureInput[] = [];
    for (const row of validRows) {
      const amount = parseAmount(row.amount);
      if (amount === null) continue;
      submitted.push(row);
      feeStructureInputs.push({
        name: row.name,
        description: row.description || undefined,
        amount,
        frequency: row.frequency as BulkFeeStructureInput['frequency'],
        applies_to_type: row.applies_to as BulkFeeStructureInput['applies_to_type'],
        squad_name: row.squad_name || undefined,
      });
    }
    setSubmittedRows(submitted);

    try {
      setImportProgress(50);
      const result = await bulkImportFeeStructures(feeStructureInputs);
      setImportProgress(100);
      setImportResults({
        successCount: result.created.length,
        errors: result.errors || [],
      });
      if (result.created.length > 0 && (!result.errors || result.errors.length === 0)) {
        toast.success(`${result.created.length} fee structure${result.created.length !== 1 ? 's' : ''} imported successfully`);
      } else if (result.created.length > 0) {
        toast.success(`${result.created.length} fee structure${result.created.length !== 1 ? 's' : ''} imported with some errors`);
      } else {
        toast.error('Import failed. No fee structures were added');
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

  const downloadFailedRows = () => {
    if (!importResults || importResults.errors.length === 0) return;

    const failedRows = importResults.errors.map((e) => {
      const submitted = e.row >= 1 && e.row <= submittedRows.length ? submittedRows[e.row - 1] : null;
      return {
        name: submitted?._raw.name || '',
        description: submitted?._raw.description || '',
        amount: submitted?._raw.amount || '',
        frequency: submitted?._raw.frequency || '',
        applies_to: submitted?._raw.applies_to || '',
        squad_name: submitted?._raw.squad_name || '',
        error: e.message,
      };
    });

    downloadCsv('fee_structures_failed_rows.csv', failedRows);
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

  return (
    <MainLayout>
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <Link
                href="/fee-structures"
                className="inline-flex items-center space-x-2 text-text-secondary hover:text-brand transition-colors mb-3 min-h-[48px]"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Fee Structures</span>
              </Link>
              <h1 className="font-serif text-4xl sm:text-5xl text-dark-primary tracking-tight mb-2">Import Fee Structures</h1>
              <p className="text-grey-600 text-lg">
                Upload a CSV file to add multiple fee structures at once
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
                    Required columns: <span className="text-white font-medium">name</span>,{' '}
                    <span className="text-white font-medium">amount</span>,{' '}
                    <span className="text-white font-medium">frequency</span> and{' '}
                    <span className="text-white font-medium">applies_to</span>. Other columns (description, squad_name) are optional,
                    but squad_name is required when applies_to is squad. Amounts are in {currency} without a currency symbol.
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
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Name</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Description</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Amount</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Frequency</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Applies To</th>
                        <th className="px-4 py-3 text-left text-text-secondary font-semibold">Squad Name</th>
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
                            <td className={`px-4 py-3 ${!row.name ? 'text-red-400 italic' : 'text-white'}`}>
                              {row.name || 'missing'}
                            </td>
                            <td className="px-4 py-3 text-text-secondary">{row.description || '-'}</td>
                            <td className={`px-4 py-3 ${
                              rowErrors.some((e) => e.toLowerCase().includes('amount'))
                                ? 'text-red-400'
                                : !row.amount
                                ? 'text-red-400 italic'
                                : 'text-white'
                            }`}>
                              {row.amount || 'missing'}
                            </td>
                            <td className={`px-4 py-3 ${
                              rowErrors.some((e) => e.toLowerCase().includes('frequency'))
                                ? 'text-red-400'
                                : 'text-text-secondary'
                            }`}>
                              {row.frequency || '-'}
                            </td>
                            <td className={`px-4 py-3 ${
                              rowErrors.some((e) => e.toLowerCase().includes('applies to'))
                                ? 'text-red-400'
                                : 'text-text-secondary'
                            }`}>
                              {row.applies_to || '-'}
                            </td>
                            <td className={`px-4 py-3 ${
                              rowErrors.some((e) => e.toLowerCase().includes('squad name'))
                                ? 'text-red-400'
                                : 'text-text-secondary'
                            }`}>
                              {row.squad_name || '-'}
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
                    href="/fee-structures"
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
                      Import {validCount} Fee Structure{validCount !== 1 ? 's' : ''}
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
                  <h3 className="font-serif text-2xl text-white mb-2">Importing fee structures...</h3>
                  <p className="text-text-secondary">Please wait while your fee structures are being added.</p>
                </div>
                <div className="max-w-md mx-auto">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-text-secondary text-sm">Progress</p>
                    <p className="text-brand font-bold text-sm">{importProgress}%</p>
                  </div>
                  <div className="w-full bg-dark-primary/80 rounded-full h-3 overflow-hidden">
                    <div
                      className={`bg-brand h-full rounded-full transition-all duration-500 ${progressWidthClass(importProgress)}`}
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
                        Successfully imported {importResults.successCount} fee structure{importResults.successCount !== 1 ? 's' : ''}.
                      </p>
                    </>
                  ) : importResults.successCount > 0 ? (
                    <>
                      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500 bg-opacity-10 flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-yellow-400" />
                      </div>
                      <h3 className="font-serif text-3xl text-white mb-2">Import Partially Complete</h3>
                      <p className="text-text-secondary">
                        {importResults.successCount} fee structure{importResults.successCount !== 1 ? 's' : ''} imported successfully.{' '}
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
                        No fee structures were imported. Please check the errors below.
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
                      <button
                        onClick={downloadFailedRows}
                        className="px-4 py-2 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all border border-white/20 flex items-center justify-center space-x-2 min-h-[48px] text-sm"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download failed rows</span>
                      </button>
                    </div>
                    <ul className="space-y-1">
                      {importResults.errors.map((err, i) => {
                        const submitted =
                          err.row >= 1 && err.row <= submittedRows.length ? submittedRows[err.row - 1] : null;
                        return (
                          <li key={i} className="text-red-300 text-sm">
                            {submitted ? `Row ${submitted._sourceRow}: ` : ''}{err.message}
                          </li>
                        );
                      })}
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
                    href="/fee-structures"
                    className="px-8 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm min-h-[48px] flex items-center justify-center space-x-2"
                  >
                    <ArrowLeft className="w-5 h-5" />
                    <span>Back to Fee Structures</span>
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
