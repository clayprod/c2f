'use client';

import { useState, useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import AdvisorContent from './AdvisorContent';

interface AdvisorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AdvisorDialog({ open, onOpenChange }: AdvisorDialogProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        />
        {/* Container para centralizar o diálogo */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 pointer-events-none">
          <DialogPrimitive.Content
            className={cn(
              // Base styles
              "pointer-events-auto",
              "w-full h-full max-h-full",
              "bg-background border border-border shadow-lg rounded-xl",
              "flex flex-col overflow-hidden relative",
              // Animations
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              // Max dimensions
              "max-w-[1400px]",
              "sm:h-auto sm:max-h-[85vh]",
              "md:max-h-[80vh]"
            )}
          >
            {/* Content wrapper - pt garante espaço para o botão de fechar */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0 px-4 pb-4 pt-16 sm:px-5 sm:pb-5 sm:pt-16 md:px-6 md:pb-6 md:pt-14">
              <AdvisorContent inDialog={true} />
            </div>
            
            {/* Close button */}
            <DialogPrimitive.Close 
              className={cn(
                "absolute right-3 top-3 sm:right-4 sm:top-4",
                "rounded-full w-7 h-7",
                "bg-muted/80 hover:bg-muted",
                "flex items-center justify-center",
                "transition-colors z-10",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              )}
            >
              <i className='bx bx-x text-base'></i>
              <span className="sr-only">Fechar</span>
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
