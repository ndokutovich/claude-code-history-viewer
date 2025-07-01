"use client";

import React, { useMemo } from "react";
import {
  DollarSign,
  BarChart3,
  TrendingUp,
  AlertCircle,
  Brain,
  Sparkles,
  Calculator,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { ClaudeMessage, SessionTokenStats } from "../types";
import { COLORS } from "../constants/colors";
import { cn } from "../utils/cn";

interface ModelCostAnalyzerProps {
  messages: ClaudeMessage[];
  sessionStats?: SessionTokenStats | null;
  projectStats?: SessionTokenStats[];
}

interface ModelUsage {
  model: string;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
}

interface PricingModel {
  name: string;
  displayName: string;
  inputPrice: number; // per 1M tokens
  outputPrice: number; // per 1M tokens
  cacheWritePrice: number; // per 1M tokens
  cacheReadPrice: number; // per 1M tokens
}

const PRICING_MODELS: PricingModel[] = [
  {
    name: "claude-opus-4",
    displayName: "Claude 3 Opus",
    inputPrice: 15,
    outputPrice: 75,
    cacheWritePrice: 18.75,
    cacheReadPrice: 1.5,
  },
  {
    name: "claude-sonnet-4",
    displayName: "Claude 3.5 Sonnet",
    inputPrice: 3,
    outputPrice: 15,
    cacheWritePrice: 3.75,
    cacheReadPrice: 0.3,
  },
];

export const ModelCostAnalyzer: React.FC<ModelCostAnalyzerProps> = ({
  messages,
  sessionStats,
  projectStats = [],
}) => {
  const [showDetails, setShowDetails] = React.useState(false);
  const [selectedCurrency, setSelectedCurrency] = React.useState<"USD" | "KRW">("USD");

  const KRW_RATE = 1400; // 1 USD = 1,400 KRW

  // Analyze model usage from messages
  const modelUsageAnalysis = useMemo(() => {
    const modelMap = new Map<string, ModelUsage>();

    messages.forEach((msg) => {
      if (msg.type === "assistant" && msg.model) {
        const modelKey = msg.model.includes("opus") ? "claude-opus-4" : "claude-sonnet-4";
        const existing = modelMap.get(modelKey) || {
          model: modelKey,
          messageCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalTokens: 0,
        };

        existing.messageCount += 1;
        if (msg.usage) {
          existing.inputTokens += msg.usage.input_tokens || 0;
          existing.outputTokens += msg.usage.output_tokens || 0;
          existing.cacheCreationTokens += msg.usage.cache_creation_input_tokens || 0;
          existing.cacheReadTokens += msg.usage.cache_read_input_tokens || 0;
          existing.totalTokens +=
            (msg.usage.input_tokens || 0) +
            (msg.usage.output_tokens || 0) +
            (msg.usage.cache_creation_input_tokens || 0) +
            (msg.usage.cache_read_input_tokens || 0);
        }

        modelMap.set(modelKey, existing);
      }
    });

    return Array.from(modelMap.values());
  }, [messages]);

  // Calculate costs for each model
  const calculateCost = (usage: ModelUsage, pricing: PricingModel) => {
    const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPrice;
    const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPrice;
    const cacheWriteCost = (usage.cacheCreationTokens / 1_000_000) * pricing.cacheWritePrice;
    const cacheReadCost = (usage.cacheReadTokens / 1_000_000) * pricing.cacheReadPrice;
    const totalCost = inputCost + outputCost + cacheWriteCost + cacheReadCost;

    return {
      inputCost,
      outputCost,
      cacheWriteCost,
      cacheReadCost,
      totalCost,
    };
  };

  // Calculate total costs
  const totalCosts = useMemo(() => {
    let total = 0;
    let breakdown = {
      input: 0,
      output: 0,
      cacheWrite: 0,
      cacheRead: 0,
    };

    modelUsageAnalysis.forEach((usage) => {
      const pricing = PRICING_MODELS.find((p) => p.name === usage.model);
      if (pricing) {
        const costs = calculateCost(usage, pricing);
        total += costs.totalCost;
        breakdown.input += costs.inputCost;
        breakdown.output += costs.outputCost;
        breakdown.cacheWrite += costs.cacheWriteCost;
        breakdown.cacheRead += costs.cacheReadCost;
      }
    });

    return { total, breakdown };
  }, [modelUsageAnalysis]);

  // Format currency
  const formatCurrency = (amount: number) => {
    if (selectedCurrency === "KRW") {
      return `₩${Math.round(amount * KRW_RATE).toLocaleString()}`;
    }
    return `$${amount.toFixed(2)}`;
  };

  // Calculate potential savings
  const potentialSavings = useMemo(() => {
    if (!sessionStats) return null;

    // Calculate if all tokens were using Opus
    const opusPricing = PRICING_MODELS.find((p) => p.name === "claude-opus-4")!;
    const allOpusCost =
      (sessionStats.total_input_tokens / 1_000_000) * opusPricing.inputPrice +
      (sessionStats.total_output_tokens / 1_000_000) * opusPricing.outputPrice +
      (sessionStats.total_cache_creation_tokens / 1_000_000) * opusPricing.cacheWritePrice +
      (sessionStats.total_cache_read_tokens / 1_000_000) * opusPricing.cacheReadPrice;

    // Calculate if all tokens were using Sonnet
    const sonnetPricing = PRICING_MODELS.find((p) => p.name === "claude-sonnet-4")!;
    const allSonnetCost =
      (sessionStats.total_input_tokens / 1_000_000) * sonnetPricing.inputPrice +
      (sessionStats.total_output_tokens / 1_000_000) * sonnetPricing.outputPrice +
      (sessionStats.total_cache_creation_tokens / 1_000_000) * sonnetPricing.cacheWritePrice +
      (sessionStats.total_cache_read_tokens / 1_000_000) * sonnetPricing.cacheReadPrice;

    return {
      currentCost: totalCosts.total,
      ifAllOpus: allOpusCost,
      ifAllSonnet: allSonnetCost,
      savingsWithSonnet: allOpusCost - allSonnetCost,
      savingsPercentage: ((allOpusCost - allSonnetCost) / allOpusCost) * 100,
    };
  }, [sessionStats, totalCosts]);

  if (!messages.length && !sessionStats && !projectStats.length) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <DollarSign className={cn("w-6 h-6", COLORS.semantic.warning.icon)} />
          <h2 className={cn("text-xl font-semibold", COLORS.ui.text.primary)}>
            모델 사용량 및 비용 분석
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSelectedCurrency(selectedCurrency === "USD" ? "KRW" : "USD")}
            className={cn(
              "px-3 py-1 text-sm rounded-md transition-colors",
              "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700",
              COLORS.ui.text.secondary
            )}
          >
            {selectedCurrency === "USD" ? "₩ KRW" : "$ USD"}
          </button>
        </div>
      </div>

      {/* Total Cost Summary */}
      <div
        className={cn(
          "bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950 p-6 rounded-lg border",
          COLORS.semantic.warning.border
        )}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className={cn("text-lg font-medium mb-4", COLORS.ui.text.primary)}>
              총 비용
            </h3>
            <div className="flex items-baseline space-x-2">
              <span className={cn("text-3xl font-bold", COLORS.semantic.warning.textDark)}>
                {formatCurrency(totalCosts.total)}
              </span>
              {selectedCurrency === "USD" && (
                <span className={cn("text-sm", COLORS.ui.text.muted)}>
                  (≈ ₩{Math.round(totalCosts.total * KRW_RATE).toLocaleString()})
                </span>
              )}
            </div>
          </div>

          <div>
            <h3 className={cn("text-lg font-medium mb-4", COLORS.ui.text.primary)}>
              비용 구성
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className={cn("text-sm", COLORS.ui.text.secondary)}>입력 토큰</span>
                <span className={cn("text-sm font-medium", COLORS.ui.text.primary)}>
                  {formatCurrency(totalCosts.breakdown.input)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={cn("text-sm", COLORS.ui.text.secondary)}>출력 토큰</span>
                <span className={cn("text-sm font-medium", COLORS.ui.text.primary)}>
                  {formatCurrency(totalCosts.breakdown.output)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={cn("text-sm", COLORS.ui.text.secondary)}>캐시 생성</span>
                <span className={cn("text-sm font-medium", COLORS.ui.text.primary)}>
                  {formatCurrency(totalCosts.breakdown.cacheWrite)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className={cn("text-sm", COLORS.ui.text.secondary)}>캐시 읽기</span>
                <span className={cn("text-sm font-medium", COLORS.ui.text.primary)}>
                  {formatCurrency(totalCosts.breakdown.cacheRead)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Model Usage Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {modelUsageAnalysis.map((usage) => {
          const pricing = PRICING_MODELS.find((p) => p.name === usage.model);
          if (!pricing) return null;

          const costs = calculateCost(usage, pricing);
          const modelIcon = usage.model.includes("opus") ? Brain : Sparkles;
          const modelColor = usage.model.includes("opus") 
            ? COLORS.tools.system 
            : COLORS.semantic.info;

          return (
            <div
              key={usage.model}
              className={cn(
                "p-4 rounded-lg border",
                COLORS.ui.background.white,
                COLORS.ui.border.light
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {React.createElement(modelIcon, {
                    className: cn("w-5 h-5", modelColor.icon),
                  })}
                  <h4 className={cn("font-medium", COLORS.ui.text.primary)}>
                    {pricing.displayName}
                  </h4>
                </div>
                <span className={cn("text-lg font-bold", modelColor.textDark)}>
                  {formatCurrency(costs.totalCost)}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className={COLORS.ui.text.tertiary}>메시지 수</span>
                  <span className={COLORS.ui.text.secondary}>
                    {usage.messageCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={COLORS.ui.text.tertiary}>총 토큰</span>
                  <span className={COLORS.ui.text.secondary}>
                    {usage.totalTokens.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Progress bar showing token distribution */}
              <div className="mt-3">
                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full", modelColor.bg)}
                    style={{
                      width: `${(usage.totalTokens / (sessionStats?.total_tokens || 1)) * 100}%`,
                    }}
                  />
                </div>
                <p className={cn("text-xs mt-1", COLORS.ui.text.muted)}>
                  전체 토큰의 {((usage.totalTokens / (sessionStats?.total_tokens || 1)) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Potential Savings Analysis */}
      {potentialSavings && (
        <div
          className={cn(
            "bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 p-4 rounded-lg border",
            COLORS.semantic.success.border
          )}
        >
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center space-x-2">
              <Calculator className={cn("w-5 h-5", COLORS.semantic.success.icon)} />
              <h3 className={cn("font-medium", COLORS.semantic.success.textDark)}>
                비용 절감 분석
              </h3>
            </div>
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showDetails && (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={cn("text-sm", COLORS.ui.text.tertiary)}>
                    모두 Opus 사용 시
                  </p>
                  <p className={cn("text-lg font-bold", COLORS.ui.text.primary)}>
                    {formatCurrency(potentialSavings.ifAllOpus)}
                  </p>
                </div>
                <div>
                  <p className={cn("text-sm", COLORS.ui.text.tertiary)}>
                    모두 Sonnet 사용 시
                  </p>
                  <p className={cn("text-lg font-bold", COLORS.semantic.success.textDark)}>
                    {formatCurrency(potentialSavings.ifAllSonnet)}
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  "p-3 rounded border",
                  "bg-green-100 dark:bg-green-900",
                  COLORS.semantic.success.border
                )}
              >
                <div className="flex items-center space-x-2">
                  <TrendingUp className={cn("w-4 h-4", COLORS.semantic.success.icon)} />
                  <p className={cn("text-sm", COLORS.semantic.success.textDark)}>
                    Sonnet 전환 시 최대{" "}
                    <span className="font-bold">
                      {formatCurrency(potentialSavings.savingsWithSonnet)}
                    </span>{" "}
                    ({potentialSavings.savingsPercentage.toFixed(1)}%) 절감 가능
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info box */}
      <div
        className={cn(
          "flex items-start space-x-2 p-3 rounded-lg",
          "bg-blue-50 dark:bg-blue-950",
          COLORS.semantic.info.border
        )}
      >
        <AlertCircle className={cn("w-4 h-4 mt-0.5", COLORS.semantic.info.icon)} />
        <div className="flex-1">
          <p className={cn("text-sm", COLORS.semantic.info.textDark)}>
            실제 Claude Code 요금은 다를 수 있습니다. 표시된 금액은 표준 API 요금 기준입니다.
          </p>
        </div>
      </div>
    </div>
  );
};