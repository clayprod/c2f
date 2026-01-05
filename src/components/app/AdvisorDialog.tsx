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
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[40%] z-50 w-[90vw] max-w-6xl max-h-[80vh] translate-x-[-50%] -translate-y-1/4",
            "bg-background p-0 border border-border shadow-lg duration-200",
            "flex flex-col overflow-hidden relative",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
            "rounded-xl"
          )}
          style={{
            aspectRatio: '16/9',
            maxHeight: '80vh'
          }}
        >
          <div className="p-6 pr-14 flex-1 overflow-hidden pt-10"> {/* Increased padding to account for close button */}
            <AdvisorContent inDialog={true} />
          </div>
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full w-8 h-8 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground flex items-center justify-center z-10">
            <i className='bx bx-x text-lg'></i>
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}