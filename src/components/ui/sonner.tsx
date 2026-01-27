'use client';

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card/60 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-white/10 group-[.toaster]:rounded-2xl group-[.toaster]:shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg",
          cancelButton: "group-[.toast]:bg-muted/50 group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          error: "group-[.toaster]:bg-destructive/10 group-[.toaster]:border-destructive/20 group-[.toaster]:text-foreground group-[.toaster]:shadow-[0_8px_32px_rgba(254,74,73,0.15)]",
          success: "group-[.toaster]:bg-success/10 group-[.toaster]:border-success/20 group-[.toaster]:text-foreground group-[.toaster]:shadow-[0_8px_32px_rgba(31,192,210,0.15)]",
          info: "group-[.toaster]:bg-info/10 group-[.toaster]:border-info/20 group-[.toaster]:text-foreground group-[.toaster]:shadow-[0_8px_32px_rgba(89,210,254,0.15)]",
          warning: "group-[.toaster]:bg-warning/10 group-[.toaster]:border-warning/20 group-[.toaster]:text-foreground group-[.toaster]:shadow-[0_8px_32px_rgba(254,215,102,0.15)]",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
