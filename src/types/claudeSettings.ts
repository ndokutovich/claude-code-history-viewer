/**
 * Claude Code Settings Types - Legacy Compatibility
 *
 * Re-exports all settings types from the canonical '@/types/settings' module.
 * Use '@/types/settings' for new code.
 */

export type {
  ClaudeModel,
  PermissionDefaultMode,
  PermissionsConfig,
  HookCommand,
  HooksConfig,
  StatusLineConfig,
  SandboxNetworkConfig,
  SandboxConfig,
  AttributionConfig,
  AutoUpdatesChannel,
  MarketplaceConfig,
  MCPServerType,
  MCPServerConfig,
  FeedbackSurveyState,
  ClaudeCodeSettings,
  SettingsScope,
  AllSettingsResponse,
  MCPSource,
  AllMCPServersResponse,
  ClaudeJsonConfigResponse,
  ClaudeJsonProjectSettings,
  ScopedSettings,
  SettingsPreset,
} from "./settings";

export { SCOPE_PRIORITY } from "./settings";
