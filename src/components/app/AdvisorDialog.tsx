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
            "flex flex-col overflow-hidden relative",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            // Mobile positioning
            "inset-3 md:inset-auto",
            // Desktop positioning
            "md:left-[50%] md:top-[40%] md:w-[90vw] md:max-w-6xl md:translate-x-[-50%] md:-translate-y-1/4",
            "rounded-xl md:rounded-xl"
          )}
          style={isMobile ? {
            maxHeight: 'calc(100vh - 24px)'
          } : {
            aspectRatio: '16/9',
            maxHeight: '80vh'
          }}
        >
          <div className={cn(
            "flex-1 overflow-hidden",
            "p-4 pt-12 md:p-6 md:pr-14 md:pt-10"
          )}>
            <AdvisorContent inDialog={true} />
          </div>
          <DialogPrimitive.Close className="absolute right-3 top-3 md:right-4 md:top-4 rounded-full w-8 h-8 bg-muted/80 md:bg-transparent opacity-100 md:opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground flex items-center justify-center z-10">
            <i className='bx bx-x text-lg'></i>
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}