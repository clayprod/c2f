'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface InfoIconProps {
  content: React.ReactNode;
  className?: string;
}

export function InfoIcon({ content, className }: InfoIconProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground transition-colors focus:outline-none',
            className
          )}
          aria-label="Informações"
        >
          <i className='bx bx-info-circle text-sm'></i>
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        className="max-w-xs p-3 text-sm"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}


