// ============================================================================
// CAPABILITY HELPERS (v1.6.1)
// ============================================================================
// Single Point of Truth for checking provider capabilities
// Clean code approach: DRY, centralized, testable

import type { UniversalSource } from '../../types/universal';
import { adapterRegistry } from '../registry/AdapterRegistry';

// ============================================================================
// CAPABILITY CHECKER RESULTS
// ============================================================================

export interface CapabilityCheck {
  isSupported: boolean;
  reason?: string; // Human-readable reason if not supported
  adapter?: any; // Reference to adapter if found
}

export interface SourceWithCapability extends UniversalSource {
  canWrite: boolean;
  canCreateProjects: boolean;
  canCreateSessions: boolean;
  canAppendMessages: boolean;
  writeDisabledReason?: string; // Why write is disabled (for UX)
}

// ============================================================================
// CORE CAPABILITY CHECKERS (Single Point of Truth!)
// ============================================================================

/**
 * Check if a source supports session creation
 * SINGLE POINT OF TRUTH for write capability checking
 */
export function checkSessionCreationSupport(source: UniversalSource): CapabilityCheck {
  // Source must be available
  if (!source.isAvailable) {
    return {
      isSupported: false,
      reason: 'Source is not available',
    };
  }

  // Get adapter
  const adapter = adapterRegistry.tryGet(source.providerId);
  if (!adapter) {
    return {
      isSupported: false,
      reason: `Provider ${source.providerId} not found`,
    };
  }

  // Check capability flag
  const capabilities = adapter.providerDefinition.capabilities;

  if (capabilities.isReadOnly === true) {
    return {
      isSupported: false,
      reason: 'Provider is read-only',
      adapter,
    };
  }

  if (capabilities.supportsSessionCreation !== true) {
    return {
      isSupported: false,
      reason: 'Session creation not yet implemented for this provider',
      adapter,
    };
  }

  // All checks passed!
  return {
    isSupported: true,
    adapter,
  };
}

/**
 * Check if a source supports project creation
 */
export function checkProjectCreationSupport(source: UniversalSource): CapabilityCheck {
  if (!source.isAvailable) {
    return { isSupported: false, reason: 'Source is not available' };
  }

  const adapter = adapterRegistry.tryGet(source.providerId);
  if (!adapter) {
    return { isSupported: false, reason: `Provider ${source.providerId} not found` };
  }

  const capabilities = adapter.providerDefinition.capabilities;

  if (capabilities.isReadOnly === true) {
    return { isSupported: false, reason: 'Provider is read-only', adapter };
  }

  if (capabilities.supportsProjectCreation !== true) {
    return { isSupported: false, reason: 'Project creation not supported', adapter };
  }

  return { isSupported: true, adapter };
}

/**
 * Check if a source supports appending messages
 */
export function checkMessageAppendingSupport(source: UniversalSource): CapabilityCheck {
  if (!source.isAvailable) {
    return { isSupported: false, reason: 'Source is not available' };
  }

  const adapter = adapterRegistry.tryGet(source.providerId);
  if (!adapter) {
    return { isSupported: false, reason: `Provider ${source.providerId} not found` };
  }

  const capabilities = adapter.providerDefinition.capabilities;

  if (capabilities.isReadOnly === true) {
    return { isSupported: false, reason: 'Provider is read-only', adapter };
  }

  if (capabilities.supportsMessageAppending !== true) {
    return { isSupported: false, reason: 'Message appending not supported', adapter };
  }

  return { isSupported: true, adapter };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Enrich source with capability information
 * Useful for UI to show disabled states with reasons
 */
export function enrichSourceWithCapabilities(source: UniversalSource): SourceWithCapability {
  const sessionCheck = checkSessionCreationSupport(source);
  const projectCheck = checkProjectCreationSupport(source);
  const appendCheck = checkMessageAppendingSupport(source);

  return {
    ...source,
    canWrite: sessionCheck.isSupported,
    canCreateProjects: projectCheck.isSupported,
    canCreateSessions: sessionCheck.isSupported,
    canAppendMessages: appendCheck.isSupported,
    writeDisabledReason: sessionCheck.reason,
  };
}

/**
 * Filter sources to only writable ones
 * SINGLE POINT OF TRUTH for filtering writable sources
 */
export function getWritableSources(sources: UniversalSource[]): UniversalSource[] {
  return sources.filter((source) => {
    const check = checkSessionCreationSupport(source);
    return check.isSupported;
  });
}

/**
 * Get all sources with capability metadata
 * Shows ALL sources but marks which are writable (better UX!)
 */
export function getAllSourcesWithCapabilities(
  sources: UniversalSource[]
): SourceWithCapability[] {
  return sources.map(enrichSourceWithCapabilities);
}

// ============================================================================
// HUMAN-READABLE MESSAGES
// ============================================================================

/**
 * Get user-friendly message for why write is disabled
 */
export function getWriteDisabledMessage(source: UniversalSource, t?: (key: string) => string): string {
  const check = checkSessionCreationSupport(source);

  if (check.isSupported) {
    return '';
  }

  // Provider-specific messages
  if (source.providerId === 'cursor' && check.reason === 'Session creation not yet implemented for this provider') {
    return t?.('sessionBuilder.source.cursorNotSupported') ||
           'Cursor write support coming in v1.7.0 (SQLite schema is complex)';
  }

  // Generic messages
  switch (check.reason) {
    case 'Source is not available':
      return t?.('sessionBuilder.source.notAvailable') || 'Source is not available';
    case 'Provider is read-only':
      return t?.('sessionBuilder.source.providerReadOnly') || 'This provider is read-only';
    case 'Session creation not yet implemented for this provider':
      return t?.('sessionBuilder.source.notImplemented') || 'Write support not yet implemented';
    default:
      return t?.('sessionBuilder.source.unknownError') || check.reason || 'Unknown error';
  }
}
