"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileEdit } from "lucide-react";
import * as Diff from "diff";

type DiffMode =
  | "chars"
  | "words"
  | "wordsWithSpace"
  | "lines"
  | "trimmedLines"
  | "sentences";

type Props = {
  oldText: string;
  newText: string;
  diffMode?: DiffMode;
  title?: string;
};

export const AdvancedTextDiff = ({
  oldText,
  newText,
  diffMode = "lines",
  title,
}: Props) => {
  const { t } = useTranslation("components");
  const [currentMode, setCurrentMode] = useState<DiffMode>(diffMode);
  const [isExpanded, setIsExpanded] = useState(false);

  const defaultTitle = title || t("advancedTextDiff.textChanges");

  const getDiffResults = () => {
    switch (currentMode) {
      case "lines":
        return Diff.diffLines(oldText, newText);
      case "trimmedLines":
        return Diff.diffTrimmedLines(oldText, newText);
      case "chars":
        return Diff.diffChars(oldText, newText);
      case "words":
        return Diff.diffWords(oldText, newText);
      case "wordsWithSpace":
        return Diff.diffWordsWithSpace(oldText, newText);
      case "sentences":
        return Diff.diffSentences(oldText, newText);
      default:
        return Diff.diffWords(oldText, newText);
    }
  };

  const diffResults = getDiffResults();
  const stats = diffResults.reduce(
    (acc, part) => {
      if (part.added) acc.additions++;
      else if (part.removed) acc.deletions++;
      else acc.unchanged++;
      return acc;
    },
    { additions: 0, deletions: 0, unchanged: 0 }
  );

  const renderDiffPart = (part: Diff.Change, index: number) => {
    const baseClasses = "inline";
    let colorClasses = "";
    let title = "";

    if (part.added) {
      colorClasses = "bg-green-100 text-green-800 border-l-2 border-green-400";
      title = t("advancedTextDiff.added");
    } else if (part.removed) {
      colorClasses = "bg-red-100 text-red-800 border-l-2 border-red-400";
      title = t("advancedTextDiff.removed");
    } else {
      colorClasses = "text-gray-700";
      title = t("advancedTextDiff.unchanged");
    }

    // 긴 텍스트는 줄바꿈 허용
    const content =
      currentMode === "lines" || currentMode === "trimmedLines"
        ? part.value
        : part.value;

    return (
      <span
        key={index}
        className={`${baseClasses} ${colorClasses} px-1 rounded`}
        title={title}
        style={{
          whiteSpace:
            currentMode === "lines" || currentMode === "trimmedLines"
              ? "pre-wrap"
              : "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {content}
      </span>
    );
  };

  const getModeLabel = (mode: string) => {
    return t(`advancedTextDiff.modes.${mode}`, { defaultValue: mode }) || mode;
  };

  const shouldCollapse =
    diffResults.length > 20 || oldText.length + newText.length > 1000;

  return (
    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <FileEdit className="w-4 h-4" />
          <span className="font-medium text-amber-800">{defaultTitle}</span>
        </div>
        {shouldCollapse && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded transition-colors"
          >
            {isExpanded
              ? t("advancedTextDiff.collapse")
              : t("advancedTextDiff.expand")}
          </button>
        )}
      </div>

      {/* Diff Mode Selector */}
      <div className="mb-3">
        <div className="text-xs font-medium text-gray-600 mb-2">
          {t("advancedTextDiff.comparisonMethod")}
        </div>
        <div className="flex flex-wrap gap-1">
          {(
            [
              "lines",
              "trimmedLines",
              "chars",
              "words",
              "wordsWithSpace",
              "sentences",
            ] as const
          ).map((mode) => (
            <button
              key={mode}
              onClick={() => setCurrentMode(mode)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                currentMode === mode
                  ? "bg-amber-200 text-amber-800 font-medium"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {getModeLabel(mode)}
            </button>
          ))}
        </div>
      </div>

      {/* Statistics */}
      <div className="mb-3 grid grid-cols-3 gap-2 text-xs">
        <div className="bg-white p-2 rounded border">
          <div className="text-gray-600">{t("advancedTextDiff.additions")}</div>
          <div className="font-medium text-green-600">+{stats.additions}</div>
        </div>
        <div className="bg-white p-2 rounded border">
          <div className="text-gray-600">{t("advancedTextDiff.deletions")}</div>
          <div className="font-medium text-red-600">-{stats.deletions}</div>
        </div>
        <div className="bg-white p-2 rounded border">
          <div className="text-gray-600">{t("advancedTextDiff.same")}</div>
          <div className="font-medium text-gray-600">{stats.unchanged}</div>
        </div>
      </div>

      {/* Diff Content */}
      {(!shouldCollapse || isExpanded) && (
        <div className="bg-white p-3 rounded border max-h-96 overflow-y-auto">
          <div className="font-mono text-sm leading-relaxed">
            {diffResults.map((part, index) => renderDiffPart(part, index))}
          </div>
        </div>
      )}

      {shouldCollapse && !isExpanded && (
        <div className="bg-white p-3 rounded border text-center">
          <div className="text-sm text-gray-500">
            {t("advancedTextDiff.manyChanges")}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {t("advancedTextDiff.changeSummary", {
              count: diffResults.length,
              chars: oldText.length + newText.length,
            })}
          </div>
        </div>
      )}
    </div>
  );
};
