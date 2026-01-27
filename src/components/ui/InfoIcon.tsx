'use client';

import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface InfoIconProps {
  content: React.ReactNode;
  className?: string;
}

export function InfoIcon({ content, className }: InfoIconProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-primary transition-all duration-300 focus:outline-none hover:scale-110 active:scale-95',
              className
            )}
            aria-label="Informações"
          >
            <i className='bx bx-info-circle text-sm md:text-base'></i>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          align="center"
          sideOffset={8}
          className="max-w-[280px] p-3 text-xs md:text-sm bg-card/95 backdrop-blur-md border-primary/20 shadow-xl z-[9999]"
        >
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}


