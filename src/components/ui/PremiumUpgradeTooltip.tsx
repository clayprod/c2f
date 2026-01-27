'use client';

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';
import { useUpgradeModal } from '@/hooks/useUpgradeModal';

interface PremiumUpgradeTooltipProps {
    children: React.ReactNode;
    planLabel: string;
    isLocked: boolean;
    followMouse?: boolean;
}

export function PremiumUpgradeTooltip({
    children,
    planLabel,
    isLocked,
    followMouse = false,
}: PremiumUpgradeTooltipProps) {
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [isVisible, setIsVisible] = useState(false);
    const [isInteracting, setIsInteracting] = useState(false);
    const [isFrozen, setIsFrozen] = useState(false);
    const [mounted, setMounted] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastMouseY = useRef<number>(0);

    useEffect(() => {
        setMounted(true);
        return () => {
            setMounted(false);
            if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        };
    }, []);

    const { openUpgradeModal } = useUpgradeModal();

    if (!isLocked) {
        return <>{children}</>;
    }

    const handleMouseEnter = (e: React.MouseEvent) => {
        const x = e.clientX;
        const y = e.clientY;
        lastMouseY.current = y;

        if (hideTimeoutRef.current) {
            clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = null;
        }

        if (!isVisible && !showTimeoutRef.current) {
            showTimeoutRef.current = setTimeout(() => {
                setMousePos({ x, y });
                setIsVisible(true);
                showTimeoutRef.current = null;
                // Don't freeze immediately on appear
                setIsFrozen(false);
            }, 1000);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!followMouse) return;

        // If the mouse starts moving UP (towards the tooltip), FREEZE it
        // This solves the "chasing the tooltip" problem
        if (isVisible && !isInteracting) {
            if (e.clientY < lastMouseY.current - 5) {
                setIsFrozen(true);
            }
        }

        lastMouseY.current = e.clientY;

        if (!isFrozen && !isInteracting) {
            setMousePos({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseLeave = () => {
        if (showTimeoutRef.current) {
            clearTimeout(showTimeoutRef.current);
            showTimeoutRef.current = null;
        }

        // 2 second delay as requested
        if (isVisible) {
            hideTimeoutRef.current = setTimeout(() => {
                if (!isInteracting) {
                    setIsVisible(false);
                    setIsFrozen(false);
                }
                hideTimeoutRef.current = null;
            }, 2000);
        }
    };

    const tooltipContent = (
        <div
            className={cn(
                "fixed z-[999999] pointer-events-auto",
                "animate-in fade-in-0 zoom-in-95 duration-200"
            )}
            style={{
                left: `${mousePos.x}px`,
                top: `${mousePos.y - 15}px`,
                transform: 'translate(-50%, -100%)',
            }}
            onMouseEnter={() => {
                setIsInteracting(true);
                setIsFrozen(true);
                if (hideTimeoutRef.current) {
                    clearTimeout(hideTimeoutRef.current);
                    hideTimeoutRef.current = null;
                }
            }}
            onMouseLeave={() => {
                setIsInteracting(false);
                hideTimeoutRef.current = setTimeout(() => {
                    setIsVisible(false);
                    setIsFrozen(false);
                    hideTimeoutRef.current = null;
                }, 2000);
            }}
        >
            {/* Hitbox bridge - wider and higher to catch the mouse */}
            <div className="absolute top-[90%] left-[-20%] w-[140%] h-[40px]" />

            <div className="rounded-xl border-2 border-primary/40 bg-card p-4 shadow-[0_25px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl w-[260px] flex flex-col gap-3 relative ring-1 ring-black/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-foreground">Recurso {planLabel.toUpperCase()}</p>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                    Este recurso está disponível apenas para usuários do plano <strong className="text-primary">{planLabel}</strong>.
                </p>
                <button
                    className="w-full inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all shadow-lg active:scale-95 text-center"
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsVisible(false);
                        setIsInteracting(false);
                        openUpgradeModal();
                    }}
                >
                    Assinar Plano {planLabel}
                </button>
            </div>

            <div className="absolute top-[calc(100%-12px)] left-1/2 -translate-x-1/2 w-4 h-4 bg-card border-r-2 border-b-2 border-primary/40 rotate-45 z-[-1] ring-1 ring-black/10" />
        </div>
    );

    return (
        <div
            ref={containerRef}
            className="w-full relative cursor-not-allowed h-full"
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {children}
            {mounted && isVisible && createPortal(tooltipContent, document.body)}
        </div>
    );
}
