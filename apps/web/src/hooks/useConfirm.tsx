import { useState, useCallback } from 'react';

import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'danger' | 'warning';
}

export function useConfirm() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions>({
    title: '',
    description: '',
  });
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    setOptions(opts);
    setIsOpen(true);

    return new Promise((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    if (resolver) {
      resolver(true);
      setResolver(null);
    }
    setIsLoading(false);
    setIsOpen(false);
  }, [resolver]);

  const handleCancel = useCallback(() => {
    if (resolver) {
      resolver(false);
      setResolver(null);
    }
    setIsOpen(false);
  }, [resolver]);

  const ConfirmDialogComponent = useCallback(() => (
    <ConfirmDialog
      open={isOpen}
      onOpenChange={handleCancel}
      title={options.title}
      description={options.description}
      confirmLabel={options.confirmLabel}
      cancelLabel={options.cancelLabel}
      variant={options.variant}
      onConfirm={handleConfirm}
      isLoading={isLoading}
    />
  ), [isOpen, options, isLoading, handleConfirm, handleCancel]);

  return { confirm, ConfirmDialog: ConfirmDialogComponent };
}
