'use client';

import { useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmDialogOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export function useConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmDialogOptions>({
    description: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    variant: 'default',
  });
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmDialogOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof opts === 'string') {
        setOptions({
          description: opts,
          confirmText: 'Confirmar',
          cancelText: 'Cancelar',
          variant: 'default',
        });
      } else {
        setOptions({
          description: opts.description,
          title: opts.title,
          confirmText: opts.confirmText || 'Confirmar',
          cancelText: opts.cancelText || 'Cancelar',
          variant: opts.variant || 'default',
        });
      }
      setResolvePromise(() => resolve);
      setOpen(true);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setOpen(false);
    if (resolvePromise) {
      resolvePromise(true);
      setResolvePromise(null);
    }
  }, [resolvePromise]);

  const handleCancel = useCallback(() => {
    setOpen(false);
    if (resolvePromise) {
      resolvePromise(false);
      setResolvePromise(null);
    }
  }, [resolvePromise]);

  const ConfirmDialog = (
    <AlertDialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleCancel();
      }
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          {options.title && (
            <AlertDialogTitle className={options.variant === 'destructive' ? 'text-destructive' : ''}>
              {options.title}
            </AlertDialogTitle>
          )}
          <AlertDialogDescription className="text-left">
            {options.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel onClick={handleCancel} className="w-full sm:w-auto">
            {options.cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={`w-full sm:w-auto ${options.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}`}
          >
            {options.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    confirm,
    ConfirmDialog,
  };
}
