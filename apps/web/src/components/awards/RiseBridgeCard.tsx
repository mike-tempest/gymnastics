'use client';

import { Download, Upload } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { apiDownload } from '@/lib/api/api-client';
import {
  AwardScheme,
  RiseImportPreview,
  importRiseCsv,
  previewRiseImport,
  riseExportPath,
} from '@/lib/api/awards';
import { MEMBER_NOUN_PLURAL_LOWER } from '@/lib/brand';

interface RiseBridgeCardProps {
  schemes: AwardScheme[];
  onImported: () => void;
}

/**
 * The Rise CSV bridge. Rise Hub has no public API, so badge records move as a
 * spreadsheet: export what this club has awarded, key it into Rise Hub, and
 * bring anything recorded there back in.
 */
export default function RiseBridgeCard({ schemes, onImported }: RiseBridgeCardProps) {
  const [schemeId, setSchemeId] = useState('');
  const [includeAssessed, setIncludeAssessed] = useState(false);
  const [csv, setCsv] = useState('');
  const [preview, setPreview] = useState<RiseImportPreview | null>(null);
  const [billFees, setBillFees] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  const handleExport = async () => {
    try {
      setIsWorking(true);
      await apiDownload(riseExportPath(schemeId || undefined, includeAssessed), 'rise-awards.csv');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not export the badge records');
    } finally {
      setIsWorking(false);
    }
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    setCsv(text);
    setPreview(null);
  };

  const handlePreview = async () => {
    try {
      setIsWorking(true);
      setPreview(await previewRiseImport(csv, schemeId || undefined));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not read that file');
    } finally {
      setIsWorking(false);
    }
  };

  const handleImport = async () => {
    try {
      setIsWorking(true);
      const result = await importRiseCsv(csv, { schemeId: schemeId || undefined, billFees });
      toast.success(
        `Imported ${result.imported} badge ${result.imported === 1 ? 'record' : 'records'}` +
          (result.skipped > 0 ? `, skipped ${result.skipped}` : '')
      );
      for (const warning of result.warnings.slice(0, 5)) {
        toast.error(warning);
      }
      setCsv('');
      setPreview(null);
      onImported();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not import that file');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 mb-6">
      <div className="p-6 border-b border-white/10">
        <h2 className="font-serif text-3xl text-white">Rise CSV bridge</h2>
        <p className="text-text-secondary text-sm mt-2">
          Rise Hub has no public connection, so badges move as a spreadsheet. Export what you have
          awarded to key into Rise Hub, or bring records back the other way.
        </p>
      </div>

      <div className="p-6 space-y-6">
        <div>
          <label htmlFor="rise-scheme" className="block text-sm font-semibold text-white mb-2">
            Scheme
          </label>
          <select
            id="rise-scheme"
            value={schemeId}
            onChange={(event) => {
              setSchemeId(event.target.value);
              setPreview(null);
            }}
            className="w-full sm:max-w-sm min-h-[48px] px-4 py-3 bg-white/5 border border-white/20 rounded-xl text-white focus:border-brand focus:outline-none"
          >
            <option value="">All schemes</option>
            {schemes.map((scheme) => (
              <option key={scheme.scheme_id} value={scheme.scheme_id}>
                {scheme.name}
              </option>
            ))}
          </select>
        </div>

        {/* Export */}
        <div className="space-y-3">
          <label className="flex items-center gap-3 text-white">
            <input
              type="checkbox"
              checked={includeAssessed}
              onChange={(event) => setIncludeAssessed(event.target.checked)}
              className="w-5 h-5 rounded border-white/20 bg-white/5"
            />
            <span className="text-sm">Include badges that are assessed but not yet awarded</span>
          </label>
          <button
            type="button"
            onClick={handleExport}
            disabled={isWorking}
            className="w-full sm:w-auto min-h-[48px] px-6 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all inline-flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Import */}
        <div className="border-t border-white/10 pt-6 space-y-4">
          <label htmlFor="rise-file" className="block text-sm font-semibold text-white">
            Import a Rise CSV
          </label>
          <input
            id="rise-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
            className="block w-full text-sm text-text-secondary file:mr-4 file:min-h-[48px] file:px-6 file:py-3 file:rounded-xl file:border-0 file:bg-white/10 file:text-white file:font-semibold hover:file:bg-white/20"
          />

          {csv && !preview && (
            <button
              type="button"
              onClick={handlePreview}
              disabled={isWorking}
              className="w-full sm:w-auto min-h-[48px] px-6 py-3 bg-white/5 text-white rounded-xl font-semibold border border-white/20 hover:bg-white/10 transition-all inline-flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <Upload className="w-5 h-5" />
              <span>Check the file</span>
            </button>
          )}

          {preview && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <span className="px-3 py-1 bg-brand/20 text-brand rounded-full text-sm font-semibold border border-brand/40">
                  {preview.matched} ready to import
                </span>
                {preview.unmatched > 0 && (
                  <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-sm font-semibold border border-yellow-500/40">
                    {preview.unmatched} need attention
                  </span>
                )}
              </div>

              {preview.missing_headers.length > 0 && (
                <p className="text-sm text-yellow-400">
                  Missing columns: {preview.missing_headers.join(', ')}
                </p>
              )}
              {preview.unknown_headers.length > 0 && (
                <p className="text-sm text-text-tertiary">
                  Columns this import ignored: {preview.unknown_headers.join(', ')}
                </p>
              )}

              <div className="max-h-80 overflow-y-auto overflow-x-auto rounded-2xl border border-white/10">
                <table className="w-full">
                  <thead className="sticky top-0 bg-dark-primary">
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Row</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">
                        Badge
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-white">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.row_number} className="border-b border-white/10">
                        <td className="py-3 px-4 text-text-secondary text-sm tabular-nums">
                          {row.row_number}
                        </td>
                        <td className="py-3 px-4 text-white text-sm">
                          {row.first_name} {row.last_name}
                        </td>
                        <td className="py-3 px-4 text-text-secondary text-sm">{row.level}</td>
                        <td className="py-3 px-4 text-sm">
                          {row.errors.length === 0 ? (
                            <span className="text-brand">
                              Matched
                              {row.matched_on === 'registration_number'
                                ? ' on BG membership number'
                                : ' on name and date of birth'}
                            </span>
                          ) : (
                            <span className="text-yellow-400">{row.errors.join('; ')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <label className="flex items-center gap-3 text-white">
                <input
                  type="checkbox"
                  checked={billFees}
                  onChange={(event) => setBillFees(event.target.checked)}
                  className="w-5 h-5 rounded border-white/20 bg-white/5"
                />
                <span className="text-sm">
                  Invoice families for these badges. Leave this off if you have already charged for
                  them.
                </span>
              </label>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={isWorking || preview.matched === 0}
                  className="min-h-[48px] px-6 py-3 bg-brand text-dark-primary rounded-xl font-bold hover:bg-brand-light transition-all disabled:opacity-50"
                >
                  {`Import ${preview.matched} ${preview.matched === 1 ? 'record' : 'records'}`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setCsv('');
                  }}
                  disabled={isWorking}
                  className="min-h-[48px] px-6 py-3 bg-white/5 text-white rounded-xl font-semibold border border-white/20 hover:bg-white/10 transition-all disabled:opacity-50"
                >
                  Start again
                </button>
              </div>

              <p className="text-sm text-text-tertiary">
                Rows are matched to your {MEMBER_NOUN_PLURAL_LOWER} on BG membership number first,
                then on name and date of birth. Anything ambiguous is left alone rather than guessed
                at.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
