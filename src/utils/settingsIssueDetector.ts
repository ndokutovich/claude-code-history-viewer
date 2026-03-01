/**
 * Settings Issue Detector
 *
 * Pure utility functions that analyze Claude Code settings across all scopes
 * and detect configuration issues, conflicts, and best practice violations.
 */

import type { SettingsScope } from "@/types";
import type { MergedSettings } from "./settingsMerger";
import { getConflictingServers } from "./settingsMerger";

// ============================================================================
// Types
// ============================================================================

export type IssueSeverity = "error" | "warning" | "info";

export type IssueType =
  | "mcp_in_settings"
  | "duplicate_key"
  | "mcp_conflict"
  | "overridden_setting"
  | "env_override"
  | "permission_conflict";

export interface SettingsIssue {
  id: string;
  type: IssueType;
  severity: IssueSeverity;
  titleKey: string;
  descriptionKey: string;
  descriptionParams?: Record<string, string | number>;
  affectedScopes: string[];
  recommendationKey: string;
}

// ============================================================================
// Detection Functions
// ============================================================================

interface AllSettingsRaw {
  user?: string | null;
  project?: string | null;
  local?: string | null;
}

interface MCPServersMap {
  userClaudeJson?: Record<string, unknown> | null;
  projectMcpFile?: Record<string, unknown> | null;
  localClaudeJson?: Record<string, unknown> | null;
}

function parseScopeSettings(content: string | null | undefined): Record<string, unknown> | null {
  if (!content || content === "{}") return null;
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const EXCLUDED_KEYS = new Set(["mcpServers", "permissions", "hooks", "env"]);

function getSettingKeys(parsed: Record<string, unknown>): string[] {
  return Object.keys(parsed).filter((k) => !EXCLUDED_KEYS.has(k));
}

/** Detect MCP servers defined inside settings.json files (should be in .claude.json or .mcp.json) */
function detectMcpInSettings(allSettings: AllSettingsRaw): SettingsIssue[] {
  const issues: SettingsIssue[] = [];
  const scopeEntries: Array<[string, string | null | undefined]> = [
    ["user", allSettings.user],
    ["project", allSettings.project],
    ["local", allSettings.local],
  ];

  for (const [scope, content] of scopeEntries) {
    const parsed = parseScopeSettings(content);
    if (parsed?.mcpServers && typeof parsed.mcpServers === "object") {
      const count = Object.keys(parsed.mcpServers).length;
      if (count > 0) {
        issues.push({
          id: `mcp_in_settings_${scope}`,
          type: "mcp_in_settings",
          severity: "error",
          titleKey: "settingsManager.analyzer.issues.mcpInSettings.title",
          descriptionKey: "settingsManager.analyzer.issues.mcpInSettings.desc",
          descriptionParams: { scope, count },
          affectedScopes: [scope],
          recommendationKey: "settingsManager.analyzer.issues.mcpInSettings.fix",
        });
      }
    }
  }
  return issues;
}

/** Detect the same setting key defined in multiple scopes */
function detectDuplicateKeys(allSettings: AllSettingsRaw): SettingsIssue[] {
  const issues: SettingsIssue[] = [];
  const scopeLabels: Array<[SettingsScope, string | null | undefined]> = [
    ["user", allSettings.user],
    ["project", allSettings.project],
    ["local", allSettings.local],
  ];

  const keyToScopes = new Map<string, SettingsScope[]>();

  for (const [scope, content] of scopeLabels) {
    const parsed = parseScopeSettings(content);
    if (!parsed) continue;
    for (const key of getSettingKeys(parsed)) {
      const scopes = keyToScopes.get(key) ?? [];
      scopes.push(scope);
      keyToScopes.set(key, scopes);
    }
  }

  for (const [key, scopes] of keyToScopes) {
    if (scopes.length > 1) {
      issues.push({
        id: `duplicate_key_${key}`,
        type: "duplicate_key",
        severity: "warning",
        titleKey: "settingsManager.analyzer.issues.duplicateKey.title",
        descriptionKey: "settingsManager.analyzer.issues.duplicateKey.desc",
        descriptionParams: { key, count: scopes.length },
        affectedScopes: scopes,
        recommendationKey: "settingsManager.analyzer.issues.duplicateKey.fix",
      });
    }
  }
  return issues;
}

/** Detect MCP servers defined in multiple scopes with different configs */
function detectMcpConflicts(merged: MergedSettings): SettingsIssue[] {
  const conflicts = getConflictingServers(merged);
  return conflicts.map(({ name, sources }) => ({
    id: `mcp_conflict_${name}`,
    type: "mcp_conflict" as const,
    severity: "warning" as const,
    titleKey: "settingsManager.analyzer.issues.mcpConflict.title",
    descriptionKey: "settingsManager.analyzer.issues.mcpConflict.desc",
    descriptionParams: { server: name },
    affectedScopes: sources,
    recommendationKey: "settingsManager.analyzer.issues.mcpConflict.fix",
  }));
}

/** Detect settings that are overridden by higher-priority scopes */
function detectOverriddenSettings(merged: MergedSettings): SettingsIssue[] {
  const issues: SettingsIssue[] = [];
  const valueFields: Array<[string, { overriddenBy?: SettingsScope[]; source: SettingsScope }]> = [
    ["model", merged.model],
    ["language", merged.language],
    ["outputStyle", merged.outputStyle],
    ["cleanupPeriodDays", merged.cleanupPeriodDays],
    ["respectGitignore", merged.respectGitignore],
    ["disableBypassPermissionsMode", merged.disableBypassPermissionsMode],
    ["customApiKeyResponsibleUseAcknowledged", merged.customApiKeyResponsibleUseAcknowledged],
  ];

  for (const [key, field] of valueFields) {
    if (field.overriddenBy && field.overriddenBy.length > 0) {
      issues.push({
        id: `overridden_${key}`,
        type: "overridden_setting",
        severity: "info",
        titleKey: "settingsManager.analyzer.issues.overriddenSetting.title",
        descriptionKey: "settingsManager.analyzer.issues.overriddenSetting.desc",
        descriptionParams: { key, source: field.source },
        affectedScopes: [field.source, ...field.overriddenBy],
        recommendationKey: "settingsManager.analyzer.issues.overriddenSetting.fix",
      });
    }
  }
  return issues;
}

/** Detect environment variables overridden across scopes */
function detectEnvOverrides(merged: MergedSettings): SettingsIssue[] {
  const issues: SettingsIssue[] = [];

  for (const [varName, envVar] of Object.entries(merged.env)) {
    if (envVar.overriddenScopes && envVar.overriddenScopes.length > 0) {
      issues.push({
        id: `env_override_${varName}`,
        type: "env_override",
        severity: "info",
        titleKey: "settingsManager.analyzer.issues.envOverride.title",
        descriptionKey: "settingsManager.analyzer.issues.envOverride.desc",
        descriptionParams: { variable: varName },
        affectedScopes: [envVar.source, ...envVar.overriddenScopes],
        recommendationKey: "settingsManager.analyzer.issues.envOverride.fix",
      });
    }
  }
  return issues;
}

/** Detect the same pattern appearing in both allow and deny permissions */
function detectPermissionConflicts(merged: MergedSettings): SettingsIssue[] {
  const issues: SettingsIssue[] = [];
  const { permissions } = merged;

  const allowPatterns = new Map(permissions.allow.map((p) => [p.pattern, p.source]));

  for (const denied of permissions.deny) {
    const allowSource = allowPatterns.get(denied.pattern);
    if (allowSource != null) {
      issues.push({
        id: `permission_conflict_${denied.pattern}`,
        type: "permission_conflict",
        severity: "warning",
        titleKey: "settingsManager.analyzer.issues.permissionConflict.title",
        descriptionKey: "settingsManager.analyzer.issues.permissionConflict.desc",
        descriptionParams: { pattern: denied.pattern },
        affectedScopes: [allowSource, denied.source],
        recommendationKey: "settingsManager.analyzer.issues.permissionConflict.fix",
      });
    }
  }
  return issues;
}

// ============================================================================
// Main Detector
// ============================================================================

const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export function detectSettingsIssues(
  allSettings: AllSettingsRaw | null,
  _mcpServers: MCPServersMap | null,
  merged: MergedSettings | null
): SettingsIssue[] {
  const issues: SettingsIssue[] = [];

  if (allSettings) {
    issues.push(...detectMcpInSettings(allSettings));
    issues.push(...detectDuplicateKeys(allSettings));
  }

  if (merged) {
    issues.push(...detectMcpConflicts(merged));
    issues.push(...detectOverriddenSettings(merged));
    issues.push(...detectEnvOverrides(merged));
    issues.push(...detectPermissionConflicts(merged));
  }

  // Sort: error → warning → info
  issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return issues;
}
