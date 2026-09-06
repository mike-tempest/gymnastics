'use client';

import { AlertTriangle, ArrowRight, FileSpreadsheet } from 'lucide-react';

import { BRAND } from '@/lib/brand';

export interface MappingField {
  key: string;
  label: string;
  required: boolean;
}

interface ColumnMappingStepProps {
  fileName: string | null;
  rowCount: number;
  headers: string[];
  fields: MappingField[];
  mapping: Record<string, string | undefined>;
  onMappingChange: (fieldKey: string, header: string) => void;
  onChooseDifferentFile: () => void;
  onCancel: () => void;
  onContinue: () => void;
  /** True when every required field was matched automatically. */
  autoMatched: boolean;
}

/**
 * The "match your columns" step shared by the member and member import
 * wizards: an auto-guessed mapping from our canonical fields to uploaded columns
 * that the user can adjust before validation runs.
 */
export default function ColumnMappingStep({
  fileName,
  rowCount,
  headers,
  fields,
  mapping,
  onMappingChange,
  onChooseDifferentFile,
  onCancel,
  onContinue,
  autoMatched,
}: ColumnMappingStepProps) {
  const unmappedRequired = fields.filter((f) => f.required && !mapping[f.key]);
  const mappedHeaders = new Set(Object.values(mapping).filter(Boolean));
  const ignoredHeaders = headers.filter((h) => !mappedHeaders.has(h));

  return (
    <div className="space-y-6">
      {/* File Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <FileSpreadsheet className="w-6 h-6 text-brand" />
          <div>
            <p className="text-white font-semibold">{fileName}</p>
            <p className="text-text-secondary text-sm">
              {rowCount} row{rowCount !== 1 ? 's' : ''}, {headers.length} column
              {headers.length !== 1 ? 's' : ''} found
            </p>
          </div>
        </div>
        <button
          onClick={onChooseDifferentFile}
          className="px-4 py-2 bg-dark-primary/80 text-text-secondary rounded-xl font-semibold hover:bg-white/5 hover:text-white transition-all border border-white/20 min-h-[48px] text-sm"
        >
          Choose different file
        </button>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-white mb-1">Match your columns to {BRAND.name} fields</h3>
        <p className="text-text-secondary text-sm">
          We matched columns automatically where we could. Check them and fill in any gaps.
          Fields marked with * are required.
        </p>
      </div>

      {autoMatched && (
        <div className="bg-brand bg-opacity-10 border border-brand border-opacity-30 rounded-xl p-4">
          <p className="text-brand text-sm font-semibold">
            All required fields were matched automatically. If the mapping below looks right,
            continue straight to the preview.
          </p>
        </div>
      )}

      {/* Mapping grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {fields.map((field) => {
          const missing = field.required && !mapping[field.key];
          return (
            <div key={field.key}>
              <label
                htmlFor={`map-${field.key}`}
                className={`block text-sm font-semibold mb-1 ${missing ? 'text-red-400' : 'text-text-secondary'}`}
              >
                {field.label}
                {field.required ? ' *' : ''}
              </label>
              <select
                id={`map-${field.key}`}
                value={mapping[field.key] ?? ''}
                onChange={(e) => onMappingChange(field.key, e.target.value)}
                className={`w-full min-h-[48px] px-3 py-2 bg-dark-primary/80 text-white rounded-xl border text-sm focus:outline-none focus:border-brand ${
                  missing ? 'border-red-500' : 'border-white/20'
                }`}
              >
                <option value="">Not mapped</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      {/* Unmapped required warning */}
      {unmappedRequired.length > 0 && (
        <div className="bg-red-500 bg-opacity-10 border border-red-500 rounded-xl p-4 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm">
            Map these required fields before continuing:{' '}
            {unmappedRequired.map((f) => f.label).join(', ')}
          </p>
        </div>
      )}

      {/* Ignored columns note */}
      {ignoredHeaders.length > 0 && (
        <div className="bg-dark-primary/80 border border-white/20 rounded-xl p-4">
          <p className="text-text-secondary text-sm">
            These columns are not mapped and will be ignored:{' '}
            <span className="text-white">{ignoredHeaders.join(', ')}</span>
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-4 border-t border-white/20">
        <button
          onClick={onCancel}
          className="px-6 py-3 bg-dark-primary/80 text-white rounded-xl font-semibold hover:bg-white/5 transition-all min-h-[48px] flex items-center justify-center"
        >
          Cancel
        </button>
        <button
          onClick={onContinue}
          disabled={unmappedRequired.length > 0}
          className="px-8 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-2 min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
        >
          <span>Continue to Preview</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
