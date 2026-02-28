/**
 * Unified Configuration Preset Types - Legacy Compatibility
 *
 * Re-exports unified preset types from the canonical '@/types/presets' module.
 * Use '@/types/presets' for new code.
 */

export type {
  UnifiedPresetData,
  UnifiedPresetSummary,
  UnifiedPresetInput,
  UnifiedPresetApplyOptions,
} from "./presets";

export {
  computePresetSummary,
  parsePresetContent,
  formatPresetDate,
  formatMCPPresetDate,
  formatUnifiedPresetDate,
} from "./presets";
