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
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
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
        <DialogPrimitive.Content
          className={cn(
            // Mobile: nearly full screen with small margins
            "fixed z-50 bg-background border border-border shadow-lg duration-200",
            "flex flex-col overflow-hidden overflow-x-hidden relative",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            // Mobile positioning
            "inset-3 sm:inset-4",
            // Tablet positioning
            "md:inset-auto md:left-[50%] md:top-[50%] md:w-[95vw] md:max-w-5xl md:translate-x-[-50%] md:-translate-y-1/2",
            // Desktop positioning
            "lg:w-[90vw] lg:max-w-6xl lg:top-[40%] lg:-translate-y-1/4",
            "rounded-xl",
            "max-w-full"
          )}
          style={isMobile ? {
            maxHeight: 'calc(100vh - 24px)',
            maxWidth: 'calc(100vw - 24px)'
          } : {
            maxHeight: '90vh',
            minHeight: '500px'
          }}
        >
          <div className={cn(
            "flex-1 overflow-hidden overflow-x-hidden max-w-full",
            "p-3 pt-10 sm:p-4 sm:pt-12 md:p-6 md:pr-12 md:pt-10 lg:pr-14"
          )}>
            <AdvisorContent inDialog={true} />
          </div>
          <DialogPrimitive.Close className="absolute right-2 top-2 sm:right-3 sm:top-3 md:right-4 md:top-4 rounded-full w-7 h-7 sm:w-8 sm:h-8 bg-muted/80 md:bg-transparent opacity-100 md:opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground flex items-center justify-center z-10">
            <i className='bx bx-x text-base sm:text-lg'></i>
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}