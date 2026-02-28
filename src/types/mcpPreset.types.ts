/**
 * MCP Server Preset Types - Legacy Compatibility
 *
 * Re-exports MCP preset types from the canonical '@/types/presets' module.
 * Use '@/types/presets' for new code.
 */

export type { MCPPresetData, MCPPresetInput } from "./presets";
export { parseMCPServers, formatMCPPresetDate } from "./presets";
