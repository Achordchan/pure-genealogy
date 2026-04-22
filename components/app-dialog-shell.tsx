import type { ComponentProps, ReactNode } from "react";

import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type DialogContentProps = ComponentProps<typeof DialogContent>;

interface AppDialogShellProps extends Omit<DialogContentProps, "children" | "className"> {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  contentClassName?: string;
  showCloseButton?: boolean;
}

export function AppDialogShell({
  title,
  description,
  children,
  footer,
  className,
  bodyClassName,
  contentClassName,
  showCloseButton = true,
  ...contentProps
}: AppDialogShellProps) {
  return (
    <DialogContent
      showCloseButton={showCloseButton}
      className={cn(
        "overflow-hidden p-0",
        contentClassName ?? "sm:max-w-2xl",
      )}
      {...contentProps}
    >
      <DialogHeader className="border-b border-stone-200/80 bg-gradient-to-b from-stone-50 to-background px-6 py-5 dark:border-stone-800 dark:from-stone-900 dark:to-stone-950">
        <div className="space-y-2">
          <DialogTitle className="font-serif text-2xl font-semibold tracking-tight text-stone-900 dark:text-stone-100">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="max-w-2xl text-sm leading-6 text-stone-600 dark:text-stone-400">
              {description}
            </DialogDescription>
          ) : null}
        </div>
      </DialogHeader>
      <div className={cn("max-h-[calc(90vh-156px)] overflow-y-auto px-6 py-5", bodyClassName, className)}>
        {children}
      </div>
      {footer ? (
        <DialogFooter className="border-t border-stone-200/80 bg-stone-50/70 px-6 py-4 dark:border-stone-800 dark:bg-stone-900/60">
          {footer}
        </DialogFooter>
      ) : null}
    </DialogContent>
  );
}
