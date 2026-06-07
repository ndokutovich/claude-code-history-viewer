/**
 * Provider Utilities
 *
 * Helper functions for multi-provider support.
 */

import type { ProviderId } from "../types";

export const PROVIDER_IDS: ProviderId[] = ["claude", "codex", "opencode", "cursor", "gemini"];
export const DEFAULT_PROVIDER_ID: ProviderId = "claude";

const PROVIDER_TRANSLATIONS: Record<
  ProviderId,
  { key: string; fallback: string }
> = {
  claude: { key: "common.provider.claude", fallback: "Claude Code" },
  codex: { key: "common.provider.codex", fallback: "Codex CLI" },
  opencode: { key: "common.provider.opencode", fallback: "OpenCode" },
  cursor: { key: "common.provider.cursor", fallback: "Cursor IDE" },
  gemini: { key: "common.provider.gemini", fallback: "Gemini CLI" },
};

type TranslateFn = (key: string, defaultValue: string) => string;

interface ProviderAnalyticsCapability {
  supportsConversationBreakdown: boolean;
}

const PROVIDER_ANALYTICS_CAPABILITIES: Record<
  ProviderId,
  ProviderAnalyticsCapability
> = {
  claude: { supportsConversationBreakdown: true },
  codex: { supportsConversationBreakdown: false },
  opencode: { supportsConversationBreakdown: false },
  cursor: { supportsConversationBreakdown: false },
  gemini: { supportsConversationBreakdown: false },
};

export interface ProviderTokenStatsLike {
  provider_id: string;
  tokens: number;
}

export interface ConversationBreakdownCoverage {
  totalTokens: number;
  coveredTokens: number;
  coveragePercent: number;
  hasLimitedProviders: boolean;
}

export function getProviderId(provider?: ProviderId | string): ProviderId {
  switch (provider) {
    case "codex":
    case "opencode":
    case "claude":
    case "cursor":
    case "gemini":
      return provider;
    default:
      return DEFAULT_PROVIDER_ID;
  }
}

// Providers whose sessions can be resumed via a paste-able CLI command.
const RESUME_COMMAND_TEMPLATES: Partial<Record<ProviderId, string>> = {
  claude: "claude --resume",
  codex: "codex resume",
};

/**
 * Whether a provider exposes a paste-able resume command.
 */
export function supportsResumeCommand(provider?: ProviderId | string): boolean {
  if (provider == null || !PROVIDER_IDS.includes(provider as ProviderId)) {
    return false;
  }
  return RESUME_COMMAND_TEMPLATES[provider as ProviderId] != null;
}

// Single-quote a path for safe shell interpolation. Always quotes (cheap and
// robust for arbitrary paths); a literal `'` is escaped as `'\''`.
function shellQuotePath(p: string): string {
  return `'${p.replace(/'/g, "'\\''")}'`;
}

/**
 * Build a paste-able resume command for the given provider/session.
 *
 * When `cwd` is provided the command is prefixed with `cd '<cwd>' && ` so that
 * pasting drops the user into the original working directory before resuming.
 * Returns `null` when the provider has no resume command or when `sessionId`
 * is empty or contains characters outside `^[A-Za-z0-9_-]+$`.
 *
 * Fail-closed on the sessionId charset: it is interpolated unquoted into a
 * shell command the user pastes into a terminal, so only the charset that real
 * CLIs emit (UUIDs, hex hashes) is allowed, keeping a crafted/corrupted session
 * id from extending the command past the resume invocation.
 */
export function getResumeCommand(
  provider: ProviderId | string | undefined,
  sessionId: string,
  cwd?: string
): string | null {
  if (!sessionId) {
    return null;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(sessionId)) {
    return null;
  }
  if (provider == null || !PROVIDER_IDS.includes(provider as ProviderId)) {
    return null;
  }

  const template = RESUME_COMMAND_TEMPLATES[provider as ProviderId];
  if (template == null) {
    return null;
  }

  const resume = `${template} ${sessionId}`;
  return cwd ? `cd ${shellQuotePath(cwd)} && ${resume}` : resume;
}

export function normalizeProviderIds(ids: readonly ProviderId[]): ProviderId[] {
  return PROVIDER_IDS.filter((id) => ids.includes(id));
}

export function hasNonDefaultProvider(
  ids: readonly ProviderId[]
): boolean {
  return ids.some((id) => id !== DEFAULT_PROVIDER_ID);
}

export function getProviderLabel(
  translate: TranslateFn,
  provider?: ProviderId | string
): string {
  const id = getProviderId(provider);
  const config = PROVIDER_TRANSLATIONS[id];
  return translate(config.key, config.fallback);
}

export function supportsConversationBreakdown(
  provider?: ProviderId | string
): boolean {
  if (provider == null || !PROVIDER_IDS.includes(provider as ProviderId)) {
    return false;
  }
  return PROVIDER_ANALYTICS_CAPABILITIES[provider as ProviderId]
    .supportsConversationBreakdown;
}

export function hasAnyConversationBreakdownProvider(
  providers?: readonly (ProviderId | string)[]
): boolean {
  if (!providers || providers.length === 0) {
    return false;
  }
  return providers.some((provider) =>
    supportsConversationBreakdown(provider)
  );
}

export function calculateConversationBreakdownCoverage(
  providers: readonly ProviderTokenStatsLike[]
): ConversationBreakdownCoverage {
  let totalTokens = 0;
  let coveredTokens = 0;
  let hasLimitedProviders = false;

  for (const provider of providers) {
    const tokens = Math.max(0, provider.tokens);
    totalTokens += tokens;

    if (supportsConversationBreakdown(provider.provider_id)) {
      coveredTokens += tokens;
    } else if (tokens > 0) {
      hasLimitedProviders = true;
    }
  }

  // Align with chart math: when there are no tokens, show 0% coverage (no data)
  // instead of treating it as vacuous 100%.
  const coveragePercent =
    totalTokens > 0 ? (coveredTokens / totalTokens) * 100 : 0;

  return {
    totalTokens,
    coveredTokens,
    coveragePercent,
    hasLimitedProviders,
  };
}
