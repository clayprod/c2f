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
            // Base styles
            "fixed z-50 bg-background border border-border shadow-lg duration-200",
            "flex flex-col overflow-hidden overflow-x-hidden relative",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "rounded-xl",
            // Mobile positioning - safe margins with vertical centering
            "left-4 right-4 top-[5vh] bottom-[5vh]",
            "sm:left-[50%] sm:right-auto sm:top-[50%] sm:bottom-auto",
            "sm:w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-2rem)] sm:translate-x-[-50%] sm:translate-y-[-50%]",
            // Tablet positioning - centered with safe margins (min 32px each side = 4rem total)
            "md:w-[calc(100vw-4rem)] md:max-w-[min(90vw,1200px)]",
            // Desktop positioning - centered with comfortable margins (min 48px each side = 6rem total)
            "lg:w-[calc(100vw-6rem)] lg:max-w-[min(85vw,1400px)]"
          )}
          style={isMobile ? {
            maxHeight: 'calc(90vh)',
            height: 'auto'
          } : {
            maxHeight: 'min(80vh, calc(100vh - 4rem))',
            minHeight: 'min(500px, calc(100vh - 4rem))',
            height: 'auto'
          }}
        >
          <div className={cn(
            "flex-1 overflow-hidden overflow-x-hidden max-w-full min-w-0",
            "p-3 pt-10 sm:p-4 sm:pt-12 md:p-5 md:pt-12 lg:p-6",
            // Ensure padding doesn't cause overflow
            "box-border"
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