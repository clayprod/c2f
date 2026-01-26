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
            "group toast group-[.toaster]:bg-card/80 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-border/50 group-[.toaster]:rounded-xl group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg",
          cancelButton: "group-[.toast]:bg-muted/50 group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
          error: "group-[.toaster]:bg-destructive/90 group-[.toaster]:border-destructive/50 group-[.toaster]:text-destructive-foreground group-[.toaster]:shadow-destructive/20",
          success: "group-[.toaster]:bg-success/90 group-[.toaster]:border-success/50 group-[.toaster]:text-success-foreground",
          info: "group-[.toaster]:bg-info/90 group-[.toaster]:border-info/50 group-[.toaster]:text-info-foreground",
          warning: "group-[.toaster]:bg-warning/90 group-[.toaster]:border-warning/50 group-[.toaster]:text-warning-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
