/**
 * ScrollableFormContent - A reusable component for creating scrollable form content
 * with consistent styling and behavior across the application
 */

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ScrollableFormContentProps {
  children: ReactNode;
  className?: string;
}

export function ScrollableFormContent({ 
  children, 
  className 
}: ScrollableFormContentProps) {
  return (
    <div className={cn(
      "flex-1 overflow-y-auto overflow-x-visible space-y-4 mt-6 pb-20 pr-2 scrollbar-thin",
      className
    )}>
      {children}
    </div>
  );
}

/**
 * StickyFormFooter - A reusable component for form footer buttons
 * that sticks to the bottom of the form
 */
interface StickyFormFooterProps {
  children: ReactNode;
  className?: string;
}

export function StickyFormFooter({ 
  children, 
  className 
}: StickyFormFooterProps) {
  return (
    <div className={cn(
      "flex justify-end space-x-2 pt-4 pb-2 bg-background border-t sticky bottom-0 mt-auto",
      className
    )}>
      {children}
    </div>
  );
}

/**
 * FormContainer - A complete form wrapper with scrollable content and sticky footer
 */
interface FormContainerProps {
  children: ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  className?: string;
}

export function FormContainer({ 
  children, 
  onSubmit, 
  className 
}: FormContainerProps) {
  return (
    <form 
      onSubmit={onSubmit} 
      className={cn("flex flex-col h-full", className)}
    >
      {children}
    </form>
  );
}
