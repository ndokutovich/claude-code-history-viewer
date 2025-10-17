// Adapter system exports
// Single entry point for all adapter-related imports

// Base interface and types
export * from './base/IAdapter';

// Registry
export { AdapterRegistry, adapterRegistry } from './registry/AdapterRegistry';
export type { DetectionResult } from './registry/AdapterRegistry';

// Providers (as implemented):
export { ClaudeCodeAdapter } from './providers/ClaudeCodeAdapter';

// Future providers:
// export { CursorAdapter } from './providers/CursorAdapter';
// export { GitHubCopilotAdapter } from './providers/GitHubCopilotAdapter';
