import pricingTable from "@/data/model-pricing.json";
/**
 * Analytics Calculations
 *
 * Helper functions for analytics calculations and formatting.
 */

/**
 * Calculate growth rate between two values
 */
export const calculateGrowthRate = (current: number, previous: number): number => {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
};

/**
 * Format large numbers with precision (K, M suffixes)
 */
export const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

/**
 * Claude API pricing configuration
 */
interface ModelPricing {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/**
 * Audited pricing data lives in `src/data/model-pricing.json` and is reviewed
 * by hand (see docs/pricing-sources). The dashboard only needs the four
 * token-level rates, so the table is flattened here; providers that bill a
 * cache write as `null` are treated as free.
 */
const MODEL_PRICING_SOURCE = pricingTable as {
  auditedAt: string;
  models: Record<
    string,
    {
      input: number;
      output: number;
      cacheRead?: number | null;
      cacheWrite?: number | null;
    }
  >;
};

/** Date the pricing table was last verified against provider pages. */
export const MODEL_PRICING_AUDITED_AT = MODEL_PRICING_SOURCE.auditedAt;

const MODEL_PRICING: Record<string, ModelPricing> = Object.fromEntries(
  Object.entries(MODEL_PRICING_SOURCE.models).map(([model, entry]) => [
    model,
    {
      input: entry.input,
      output: entry.output,
      cacheWrite: entry.cacheWrite ?? 0,
      cacheRead: entry.cacheRead ?? 0,
    },
  ])
);

const DEFAULT_PRICING: ModelPricing = { input: 3, output: 15, cacheWrite: 3.75, cacheRead: 0.30 };

const SORTED_MODEL_PRICING_ENTRIES = Object.entries(MODEL_PRICING).sort(
  (a, b) => b[0].length - a[0].length
);

const findModelPricing = (modelName: string): ModelPricing | null => {
  for (const [key, value] of SORTED_MODEL_PRICING_ENTRIES) {
    if (modelName.toLowerCase().includes(key)) {
      return value;
    }
  }
  return null;
};

export const hasExplicitModelPricing = (modelName: string): boolean =>
  findModelPricing(modelName) != null;

/**
 * Calculate Claude API pricing for a model
 */
export const calculateModelPrice = (
  modelName: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number
): number => {
  const modelPricing = findModelPricing(modelName) ?? DEFAULT_PRICING;

  const inputCost = (inputTokens / 1000000) * modelPricing.input;
  const outputCost = (outputTokens / 1000000) * modelPricing.output;
  const cacheWriteCost = (cacheCreationTokens / 1000000) * modelPricing.cacheWrite;
  const cacheReadCost = (cacheReadTokens / 1000000) * modelPricing.cacheRead;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
};

/**
 * Format a number as a currency string (USD)
 */
export const formatCurrency = (value: number): string =>
  `$${value.toLocaleString(undefined, {
    minimumFractionDigits: value >= 100 ? 0 : 2,
    maximumFractionDigits: value >= 100 ? 0 : 2,
  })}`;

/**
 * Get heatmap color based on intensity
 */
export const getHeatColor = (intensity: number): string => {
  if (intensity === 0) return "var(--heatmap-empty)";
  if (intensity <= 0.3) return "var(--heatmap-low)";
  if (intensity <= 0.6) return "var(--heatmap-medium)";
  return "var(--heatmap-high)";
};
