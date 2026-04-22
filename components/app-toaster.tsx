"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "border border-stone-200/90 bg-background/95 text-foreground shadow-xl backdrop-blur dark:border-stone-700/90 dark:bg-stone-950/95",
          title: "font-medium",
          description: "text-sm text-muted-foreground",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-foreground",
        },
      }}
    />
  );
}
