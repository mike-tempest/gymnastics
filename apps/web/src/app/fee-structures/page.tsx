'use client';

import { Squad } from '@swim-nexus/shared-types';
import { Receipt } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

import ConnectPaymentsBanner from '@/components/billing/ConnectPaymentsBanner';
import FeeStructureModal from '@/components/fee-structures/FeeStructureModal';
import GenerateTermInvoicesModal from '@/components/fee-structures/GenerateTermInvoicesModal';
import MainLayout from '@/components/layout/MainLayout';
import Breadcrumb from '@/components/ui/Breadcrumb';
import EmptyState from '@/components/ui/empty-state';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useConfirm } from '@/hooks/useConfirm';
import { useFormatters } from '@/hooks/useFormatters';
import {
  getFeeStructures,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
  generateInvoices,
  FeeStructure,
  CreateFeeStructureInput,
  UpdateFeeStructureInput,
} from '@/lib/api/finance';
import { getSquads } from '@/lib/api/squads';

// Helper function to format frequency
function formatFrequency(frequency: string): string {
  switch (frequency) {
    case 'monthly':
      return 'Monthly';
    case 'term':
      return 'Per term';
    case 'annual':
      return 'Annual';
    case 'one_time':
      return 'One-time';
    default:
      return frequency;
  }
}

// Helper function to format applies to
function formatAppliesTo(appliesTo: string): string {
  switch (appliesTo) {
    case 'club':
      return 'Whole Club';
    case 'squad':
      return 'Specific Squad';
    case 'swimmer':
      return 'Per Swimmer';
    default:
      return appliesTo;
  }
}

export default function FeeStructuresPage() {
  const { confirm, ConfirmDialog } = useConfirm();
  const { formatCurrency } = useFormatters();
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFeeStructure, setSelectedFeeStructure] = useState<FeeStructure | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // Term fee awaiting a period label before invoices are generated.
  const [generateTarget, setGenerateTarget] = useState<FeeStructure | null>(null);
  const [isGeneratingInvoices, setIsGeneratingInvoices] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [feeStructuresData, squadsData] = await Promise.all([getFeeStructures(), getSquads()]);
      setFeeStructures(feeStructuresData);
      setSquads(squadsData);
    } catch (err) {
      setError('Failed to load fee structures. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setSelectedFeeStructure(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (feeStructure: FeeStructure) => {
    setSelectedFeeStructure(feeStructure);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFeeStructure(null);
  };

  const handleSubmit = async (data: CreateFeeStructureInput | UpdateFeeStructureInput) => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (selectedFeeStructure) {
        await updateFeeStructure(selectedFeeStructure.fee_structure_id, data as UpdateFeeStructureInput);
        setSuccessMessage('Fee structure updated successfully!');
      } else {
        await createFeeStructure(data as CreateFeeStructureInput);
        setSuccessMessage('Fee structure created successfully!');
      }

      await fetchData();
      handleCloseModal();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save fee structure';
      setError(message);
      toast.error(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (feeStructureId: string) => {
    const confirmed = await confirm({
      title: 'Delete Fee Structure',
      description: 'Are you sure you want to delete this fee structure? This action cannot be undone and may affect existing invoices.',
      confirmLabel: 'Delete Fee Structure',
      cancelLabel: 'Keep Fee Structure',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await deleteFeeStructure(feeStructureId);
      await fetchData();
      setSuccessMessage('Fee structure deleted successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete fee structure';
      setError(message);
      toast.error(message);
    }
  };

  const describeScope = (feeStructure: FeeStructure): string => {
    if (feeStructure.applies_to === 'squad') {
      const squadName = getSquadName(feeStructure.squad_id);
      return squadName
        ? `every family with a swimmer in ${squadName}`
        : 'every family with a swimmer in the selected squad';
    }
    if (feeStructure.applies_to === 'swimmer') {
      return "the swimmer's family";
    }
    return 'every family in the club';
  };

  const runGenerateInvoices = async (feeStructure: FeeStructure, billingPeriod?: string) => {
    try {
      setIsGeneratingInvoices(true);
      const result = await generateInvoices(feeStructure.fee_structure_id, billingPeriod);
      toast.success(`${result.created} invoices created, ${result.skipped} already existed`);
      setGenerateTarget(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate invoices';
      toast.error(message);
    } finally {
      setIsGeneratingInvoices(false);
    }
  };

  const handleGenerateInvoices = async (feeStructure: FeeStructure) => {
    // Term fees need a period label (e.g. "Term 1 2027") so the same term is
    // never billed twice; a dedicated dialog collects it.
    if (feeStructure.frequency === 'term') {
      setGenerateTarget(feeStructure);
      return;
    }

    const confirmed = await confirm({
      title: 'Generate Invoices',
      description: `Generate invoices for "${feeStructure.name}"? One invoice will be created for ${describeScope(feeStructure)}. Families already invoiced for this billing period are skipped.`,
      confirmLabel: 'Generate Invoices',
      cancelLabel: 'Cancel',
      variant: 'default',
    });

    if (!confirmed) return;

    await runGenerateInvoices(feeStructure);
  };

  const handleToggleActive = async (feeStructure: FeeStructure) => {
    try {
      await updateFeeStructure(feeStructure.fee_structure_id, {
        is_active: !feeStructure.is_active,
      });
      await fetchData();
      setSuccessMessage(`Fee structure ${!feeStructure.is_active ? 'activated' : 'deactivated'} successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update fee structure';
      setError(message);
      toast.error(message);
    }
  };

  const getSquadName = (squadId: string | null) => {
    if (!squadId) return null;
    const squad = squads.find((s) => s.squad_id === squadId);
    return squad?.squad_name || 'Unknown Squad';
  };

  // Separate active and inactive fee structures
  const activeFeeStructures = feeStructures.filter((fs) => fs.is_active);
  const inactiveFeeStructures = feeStructures.filter((fs) => !fs.is_active);

  return (
    <MainLayout>
      <ConfirmDialog />
      <div className="min-h-dvh bg-canvas p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          <Breadcrumb
            items={[
              { label: 'Dashboard', href: '/' },
              { label: 'Fee Structures' },
            ]}
          />

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div>
              <h1 className="font-serif text-5xl sm:text-6xl text-dark-primary tracking-tight mb-2">Fee Structures</h1>
              <p className="text-grey-600 text-lg">Manage billing fee structures and pricing</p>
            </div>
            <button
              onClick={handleOpenAddModal}
              className="w-full sm:w-auto px-6 py-3 sm:px-8 sm:py-4 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm flex items-center justify-center space-x-3 text-base sm:text-lg"
            >
              <span>Create Fee Structure</span>
              <svg
                className="w-6 h-6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M12 4v16m8-8H4"></path>
              </svg>
            </button>
          </div>

          <ConnectPaymentsBanner />

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 bg-brand/10 border border-brand/40 rounded-xl">
              <p className="text-brand font-semibold">{successMessage}</p>
            </div>
          )}

          {/* Error Message (mutation errors; load failures use ErrorState below) */}
          {error && feeStructures.length > 0 && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/40 rounded-xl">
              <p className="text-red-400 font-semibold">{error}</p>
            </div>
          )}

          {/* Stats Card */}
          <div className="bg-surface rounded-3xl border border-grey-200 p-6 sm:p-10 shadow-lg mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div>
                <p className="text-dark-primary text-xl font-semibold mb-3">Active Fee Structures</p>
                <h2 className="text-5xl sm:text-8xl font-bold text-dark-primary mb-4 tabular-nums">{activeFeeStructures.length}</h2>
                <p className="text-grey-600 text-lg">Currently in use for billing</p>
              </div>
              <div className="flex flex-row sm:flex-col gap-4">
                <div className="bg-brand rounded-3xl p-4 sm:p-6 text-center flex-1 sm:min-w-[180px] shadow-sm">
                  <p className="text-dark-primary text-sm font-semibold mb-1">Total Structures</p>
                  <p className="text-dark-primary text-2xl sm:text-4xl font-bold tabular-nums">{feeStructures.length}</p>
                </div>
                <div className="bg-white rounded-3xl p-4 sm:p-6 text-center flex-1 sm:min-w-[180px]">
                  <p className="text-dark-primary text-sm font-semibold mb-1">Inactive</p>
                  <p className="text-dark-primary text-2xl sm:text-4xl font-bold tabular-nums">{inactiveFeeStructures.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Active Fee Structures */}
          <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10 mb-6">
            <div className="p-6 border-b border-white/10">
              <h2 className="font-serif text-3xl text-white">Active Fee Structures</h2>
            </div>
            {isLoading ? (
              <LoadingSpinner message="Loading fee structures..." size="md" />
            ) : error && feeStructures.length === 0 ? (
              <ErrorState message={error} onRetry={fetchData} />
            ) : activeFeeStructures.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="No fee structures yet"
                description="Fee structures define how much families pay per month, term or year. Set these up before generating invoices."
                hint="Most clubs have 2 to 5 fee structures for different squads and swimmer types."
                actionLabel="Create Fee Structure"
                actionOnClick={handleOpenAddModal}
              />
            ) : (
              <>
              {/* Mobile card view */}
              <div className="md:hidden p-4 space-y-4">
                {activeFeeStructures.map((feeStructure) => (
                  <div key={feeStructure.fee_structure_id} className="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-semibold">{feeStructure.name}</p>
                        {feeStructure.description && (
                          <p className="text-text-secondary text-sm mt-1">{feeStructure.description}</p>
                        )}
                      </div>
                      <span className="text-brand font-bold text-lg ml-3 flex-shrink-0 tabular-nums">{formatCurrency(feeStructure.amount, feeStructure.currency)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="px-3 py-1 bg-dark-primary/20 text-brand rounded-full text-xs font-semibold border border-brand/40">
                        {formatFrequency(feeStructure.frequency)}
                      </span>
                      <span className="px-3 py-1 bg-white/5 text-text-secondary rounded-full text-xs font-semibold">
                        {formatAppliesTo(feeStructure.applies_to)}
                        {feeStructure.squad_id && ` - ${getSquadName(feeStructure.squad_id)}`}
                      </span>
                    </div>
                    <button
                      onClick={() => handleGenerateInvoices(feeStructure)}
                      disabled={isGeneratingInvoices}
                      className="w-full mb-2 px-3 py-2 min-h-[44px] bg-brand/20 text-brand rounded-xl font-semibold hover:bg-brand hover:text-dark-primary transition-all text-sm border border-brand/40 disabled:opacity-50"
                    >
                      {isGeneratingInvoices ? 'Generating...' : 'Generate Invoices'}
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenEditModal(feeStructure)}
                        className="flex-1 px-3 py-2 min-h-[44px] bg-brand text-dark-primary rounded-xl font-semibold hover:bg-brand-light transition-all text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(feeStructure)}
                        className="flex-1 px-3 py-2 min-h-[44px] bg-yellow-500/20 text-yellow-400 rounded-xl font-semibold hover:bg-yellow-500 hover:text-white transition-all text-sm border border-yellow-500/40"
                      >
                        Deactivate
                      </button>
                      <button
                        onClick={() => handleDelete(feeStructure.fee_structure_id)}
                        className="px-3 py-2 min-h-[44px] bg-red-500/20 text-red-400 rounded-xl font-semibold hover:bg-red-500 hover:text-white transition-all text-sm border border-red-500/40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-4 px-6 text-sm font-semibold text-white">Name</th>
                      <th className="text-left py-4 px-6 text-sm font-semibold text-white">Amount</th>
                      <th className="text-left py-4 px-6 text-sm font-semibold text-white">Frequency</th>
                      <th className="text-left py-4 px-6 text-sm font-semibold text-white">Applies To</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold text-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeFeeStructures.map((feeStructure) => (
                      <tr key={feeStructure.fee_structure_id} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                        <td className="py-4 px-6">
                          <div>
                            <p className="text-white font-semibold">{feeStructure.name}</p>
                            {feeStructure.description && (
                              <p className="text-text-secondary text-sm mt-1">{feeStructure.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-brand font-bold text-lg tabular-nums">{formatCurrency(feeStructure.amount, feeStructure.currency)}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-3 py-1 bg-dark-primary/20 text-brand rounded-full text-xs font-semibold border border-brand/40">
                            {formatFrequency(feeStructure.frequency)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div>
                            <p className="text-white">{formatAppliesTo(feeStructure.applies_to)}</p>
                            {feeStructure.squad_id && (
                              <p className="text-text-secondary text-sm">{getSquadName(feeStructure.squad_id)}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleGenerateInvoices(feeStructure)}
                              disabled={isGeneratingInvoices}
                              className="px-3 py-2 bg-brand/20 text-brand rounded-xl font-semibold hover:bg-brand hover:text-dark-primary transition-all text-sm border border-brand/40 disabled:opacity-50"
                            >
                              {isGeneratingInvoices ? 'Generating...' : 'Generate Invoices'}
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(feeStructure)}
                              className="px-3 py-2 bg-brand text-dark-primary rounded-xl font-semibold hover:bg-brand-light transition-all text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggleActive(feeStructure)}
                              className="px-3 py-2 bg-yellow-500/20 text-yellow-400 rounded-xl font-semibold hover:bg-yellow-500 hover:text-white transition-all text-sm border border-yellow-500/40"
                            >
                              Deactivate
                            </button>
                            <button
                              onClick={() => handleDelete(feeStructure.fee_structure_id)}
                              className="px-3 py-2 bg-red-500/20 text-red-400 rounded-xl font-semibold hover:bg-red-500 hover:text-white transition-all text-sm border border-red-500/40"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>

          {/* Inactive Fee Structures */}
          {inactiveFeeStructures.length > 0 && (
            <div className="bg-dark-primary rounded-3xl shadow-lg border border-white/10">
              <div className="p-6 border-b border-white/10">
                <h2 className="font-serif text-3xl text-white">Inactive Fee Structures</h2>
              </div>
              {/* Mobile card view */}
              <div className="md:hidden p-4 space-y-4">
                {inactiveFeeStructures.map((feeStructure) => (
                  <div key={feeStructure.fee_structure_id} className="p-4 bg-white/5 rounded-2xl border border-white/10 opacity-60">
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-white font-semibold">{feeStructure.name}</p>
                        {feeStructure.description && (
                          <p className="text-text-secondary text-sm mt-1">{feeStructure.description}</p>
                        )}
                      </div>
                      <span className="text-text-secondary font-bold text-lg ml-3 flex-shrink-0 tabular-nums">{formatCurrency(feeStructure.amount, feeStructure.currency)}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      <span className="px-3 py-1 bg-white/20 text-white/60 rounded-full text-xs font-semibold border border-white/20">
                        {formatFrequency(feeStructure.frequency)}
                      </span>
                      <span className="px-3 py-1 bg-white/5 text-text-secondary rounded-full text-xs font-semibold">
                        {formatAppliesTo(feeStructure.applies_to)}
                        {feeStructure.squad_id && ` - ${getSquadName(feeStructure.squad_id)}`}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleActive(feeStructure)}
                        className="flex-1 px-3 py-2 min-h-[44px] bg-green-500/20 text-green-400 rounded-xl font-semibold hover:bg-green-500 hover:text-white transition-all text-sm border border-green-500/40"
                      >
                        Activate
                      </button>
                      <button
                        onClick={() => handleDelete(feeStructure.fee_structure_id)}
                        className="flex-1 px-3 py-2 min-h-[44px] bg-red-500/20 text-red-400 rounded-xl font-semibold hover:bg-red-500 hover:text-white transition-all text-sm border border-red-500/40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table view */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-4 px-6 text-sm font-semibold text-white">Name</th>
                      <th className="text-left py-4 px-6 text-sm font-semibold text-white">Amount</th>
                      <th className="text-left py-4 px-6 text-sm font-semibold text-white">Frequency</th>
                      <th className="text-left py-4 px-6 text-sm font-semibold text-white">Applies To</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold text-white">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveFeeStructures.map((feeStructure) => (
                      <tr key={feeStructure.fee_structure_id} className="border-b border-white/10 hover:bg-white/5 transition-colors opacity-60">
                        <td className="py-4 px-6">
                          <div>
                            <p className="text-white font-semibold">{feeStructure.name}</p>
                            {feeStructure.description && (
                              <p className="text-text-secondary text-sm mt-1">{feeStructure.description}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-text-secondary font-bold text-lg tabular-nums">{formatCurrency(feeStructure.amount, feeStructure.currency)}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="px-3 py-1 bg-white/20 text-white/60 rounded-full text-xs font-semibold border border-white/20">
                            {formatFrequency(feeStructure.frequency)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div>
                            <p className="text-white">{formatAppliesTo(feeStructure.applies_to)}</p>
                            {feeStructure.squad_id && (
                              <p className="text-text-secondary text-sm">{getSquadName(feeStructure.squad_id)}</p>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleToggleActive(feeStructure)}
                              className="px-3 py-2 bg-green-500/20 text-green-400 rounded-xl font-semibold hover:bg-green-500 hover:text-white transition-all text-sm border border-green-500/40"
                            >
                              Activate
                            </button>
                            <button
                              onClick={() => handleDelete(feeStructure.fee_structure_id)}
                              className="px-3 py-2 bg-red-500/20 text-red-400 rounded-xl font-semibold hover:bg-red-500 hover:text-white transition-all text-sm border border-red-500/40"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <FeeStructureModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        feeStructure={selectedFeeStructure}
        isLoading={isSubmitting}
      />

      {/* Term fees prompt for a period label before generating invoices */}
      <GenerateTermInvoicesModal
        isOpen={generateTarget !== null}
        feeStructure={generateTarget}
        scopeDescription={generateTarget ? describeScope(generateTarget) : ''}
        onClose={() => setGenerateTarget(null)}
        onSubmit={(billingPeriod) =>
          generateTarget ? runGenerateInvoices(generateTarget, billingPeriod) : Promise.resolve()
        }
      />
    </MainLayout>
  );
}
