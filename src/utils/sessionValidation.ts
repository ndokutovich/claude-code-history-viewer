// ============================================================================
// SESSION BUILDER VALIDATION UTILITIES (v1.5.0)
// ============================================================================
// Extracted from SessionBuilderModal.tsx to follow DRY principle
// Reference: .claude/CLEAN_CODE_PATTERNS.md - Violation Category 2

import type { MessageBuilder } from '@/types';
import type { SourceWithCapability } from '@/adapters/utils/capabilityHelpers';

/**
 * Translation function type for i18n support
 */
export type TranslateFunction = (key: string, options?: any) => string;

/**
 * Validation context - all inputs needed for session builder validation
 */
export interface ValidationContext {
  selectedSource: SourceWithCapability | null;
  projectMode: 'existing' | 'new';
  selectedProjectPath: string;
  newProjectName: string;
  messages: MessageBuilder[];
  t: TranslateFunction;
}

/**
 * Validation result with success flag and error messages
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates all session builder inputs
 * Returns validation result with list of error messages
 *
 * @param context - Validation context with all required inputs
 * @returns ValidationResult with isValid flag and error messages
 */
export function validateSessionBuilder(context: ValidationContext): ValidationResult {
  const errors: string[] = [];

  // Validate source selection
  if (!context.selectedSource) {
    errors.push(context.t('sessionBuilder.validation.selectSource'));
  }

  // Validate project selection based on mode
  if (context.projectMode === 'existing' && !context.selectedProjectPath) {
    errors.push(context.t('sessionBuilder.validation.selectProject'));
  }

  if (context.projectMode === 'new' && !context.newProjectName.trim()) {
    errors.push(context.t('sessionBuilder.validation.enterProjectName'));
  }

  // Validate messages
  const messageErrors = validateMessages(context.messages, context.t);
  errors.push(...messageErrors);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validates message list
 * Checks that at least one message exists and all messages have content
 *
 * @param messages - Array of message builders to validate
 * @param t - Translation function
 * @returns Array of error messages (empty if valid)
 */
export function validateMessages(messages: MessageBuilder[], t: TranslateFunction): string[] {
  const errors: string[] = [];

  // Check if at least one message exists
  if (messages.length === 0) {
    errors.push(t('sessionBuilder.validation.addOneMessage'));
  }

  // Validate each message has content
  messages.forEach((msg, index) => {
    if (typeof msg.content === 'string' && !msg.content.trim()) {
      errors.push(t('sessionBuilder.validation.messageEmpty', { number: index + 1 }));
    }
  });

  return errors;
}
