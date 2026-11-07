/**
 * Regression guard for keys wired into the wrong namespace.
 *
 * A key that exists in one locale file but is read from another resolves to
 * the raw key (or to the English defaultValue) everywhere, so the missing
 * translation is invisible in English review and visible in the UI. These are
 * the strings added with the sessions column, the parallel-tasks filter, the
 * minimap toggle, and the layout/resume-args menus.
 */
import { describe, it, expect } from "vitest";

import enComponents from "@/i18n/locales/en/components.json";
import ruComponents from "@/i18n/locales/ru/components.json";
import koComponents from "@/i18n/locales/ko/components.json";
import jaComponents from "@/i18n/locales/ja/components.json";
import zhCNComponents from "@/i18n/locales/zh-CN/components.json";
import zhTWComponents from "@/i18n/locales/zh-TW/components.json";

import enRecentEdits from "@/i18n/locales/en/recentEdits.json";
import ruRecentEdits from "@/i18n/locales/ru/recentEdits.json";
import koRecentEdits from "@/i18n/locales/ko/recentEdits.json";
import jaRecentEdits from "@/i18n/locales/ja/recentEdits.json";
import zhCNRecentEdits from "@/i18n/locales/zh-CN/recentEdits.json";
import zhTWRecentEdits from "@/i18n/locales/zh-TW/recentEdits.json";

import enCommon from "@/i18n/locales/en/common.json";
import ruCommon from "@/i18n/locales/ru/common.json";
import koCommon from "@/i18n/locales/ko/common.json";
import jaCommon from "@/i18n/locales/ja/common.json";
import zhCNCommon from "@/i18n/locales/zh-CN/common.json";
import zhTWCommon from "@/i18n/locales/zh-TW/common.json";

const COMPONENTS = {
  en: enComponents,
  ru: ruComponents,
  ko: koComponents,
  ja: jaComponents,
  "zh-CN": zhCNComponents,
  "zh-TW": zhTWComponents,
} as const;

const RECENT_EDITS = {
  en: enRecentEdits,
  ru: ruRecentEdits,
  ko: koRecentEdits,
  ja: jaRecentEdits,
  "zh-CN": zhCNRecentEdits,
  "zh-TW": zhTWRecentEdits,
} as const;

const RECENT_EDITS_KEYS = ["collapse", "expand", "fileCreated", "fileEdited", "timestamp"];

const COMMON = {
  en: enCommon,
  ru: ruCommon,
  ko: koCommon,
  ja: jaCommon,
  "zh-CN": zhCNCommon,
  "zh-TW": zhTWCommon,
} as const;

type Dict = Record<string, unknown>;

function lookup(dict: Dict, path: string): unknown {
  let node: unknown = dict;
  for (const part of path.split(".")) {
    if (node && typeof node === "object" && part in (node as Dict)) {
      node = (node as Dict)[part];
    } else {
      return undefined;
    }
  }
  return node;
}

const COMPONENT_KEYS = [
  "messageView.contentParallelTasks",
  "messageViewer.minimap.toggle",
  "messageViewer.minimap.label",
  "sessionColumn.title",
  "sessionColumn.empty",
  "session.copySubagentPaths",
  "session.noSubagentTranscripts",
  "session.viewSubagentTranscripts",
  "subagents.title",
  "subagents.noMessages",
  "projectTree.temporaryGroup",
  "projectListControls.backupAll",
];

const COMMON_KEYS = [
  "settings.layout.title",
  "settings.layout.sessionsColumn",
  "settings.resumeArgs.title",
  "settings.resumeArgs.hint",
  "settings.resumeArgs.invalid",
];

describe("recently added keys resolve in every locale", () => {
  for (const [locale, dict] of Object.entries(COMPONENTS)) {
    it(`components/${locale}`, () => {
      for (const key of COMPONENT_KEYS) {
        expect(lookup(dict as Dict, key), `${locale} is missing ${key}`).toBeTypeOf("string");
      }
    });
  }

  for (const [locale, dict] of Object.entries(RECENT_EDITS)) {
    it(`recentEdits/${locale}`, () => {
      for (const key of RECENT_EDITS_KEYS) {
        expect(lookup(dict as Dict, key), `${locale} is missing ${key}`).toBeTypeOf("string");
      }
    });
  }

  for (const [locale, dict] of Object.entries(COMMON)) {
    it(`common/${locale}`, () => {
      for (const key of COMMON_KEYS) {
        expect(lookup(dict as Dict, key), `${locale} is missing ${key}`).toBeTypeOf("string");
      }
    });
  }

  it("does not leave a second copy of the moved keys in the message namespace", async () => {
    const message = (await import("@/i18n/locales/en/message.json")).default as Dict;
    expect(message["messageView.contentParallelTasks"]).toBeUndefined();
    expect(message["messageViewer.minimap.toggle"]).toBeUndefined();
  });
});
