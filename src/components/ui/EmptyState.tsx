/**
 * EmptyState Component
 *
 * Reusable component for displaying empty/no-data states
 * Used across the application for consistent UX
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import { COLORS } from '@/constants/colors';

interface EmptyStateProps {
  /**
   * Icon to display (Lucide React icon component)
   */
  icon: LucideIcon;

  /**
   * Primary message title
   */
  title: string;

  /**
   * Optional description/subtitle
   */
  description?: string;

  /**
   * Optional action button
   */
  action?: React.ReactNode;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Icon size (default: w-16 h-16)
   */
  iconSize?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className,
  iconSize = "w-16 h-16",
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center p-8", className)}>
      <div className="mb-4">
        <Icon className={cn(iconSize, "mx-auto", COLORS.ui.text.disabled)} />
      </div>

      <h3 className={cn("text-lg font-medium mb-2", COLORS.ui.text.primary)}>
        {title}
      </h3>

      {description && (
        <p className={cn("text-sm mb-4 max-w-md", COLORS.ui.text.muted)}>
          {description}
        </p>
      )}

      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
};
