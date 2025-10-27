// ============================================================================
// VALIDATION ERRORS COMPONENT (v1.5.0)
// ============================================================================
// Reusable component for displaying validation error messages
// Reference: .claude/CLEAN_CODE_PATTERNS.md - Violation Category 3

import React from 'react';
import { Alert, AlertTitle, AlertDescription } from './alert';
import { AlertCircle } from 'lucide-react';

/**
 * Props for ValidationErrors component
 */
export interface ValidationErrorsProps {
  /** Array of error messages to display */
  errors: string[];
  /** Title for the error alert (optional) */
  title?: string;
  /** Additional CSS classes (optional) */
  className?: string;
}

/**
 * Displays validation errors in a styled alert box
 * Returns null if no errors present
 *
 * @param props - ValidationErrorsProps
 * @returns Alert component with error list or null
 */
export const ValidationErrors: React.FC<ValidationErrorsProps> = ({
  errors,
  title,
  className,
}) => {
  // Don't render anything if no errors
  if (errors.length === 0) return null;

  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      {title && <AlertTitle>{title}</AlertTitle>}
      <AlertDescription>
        <ul className="list-disc list-inside">
          {errors.map((error, index) => (
            <li key={index}>{error}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
};
