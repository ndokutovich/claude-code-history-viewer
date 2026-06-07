import { describe, it, expect } from "vitest";
import {
  isSameDay,
  formatDateDivider,
  formatTimeShort,
} from "../utils/time";

describe("time utils", () => {
  describe("isSameDay", () => {
    // Local timestamps (no trailing Z) so calendar-day comparison is TZ-stable.
    it("returns true for two timestamps on the same calendar day", () => {
      expect(
        isSameDay("2025-06-27T01:00:00", "2025-06-27T23:00:00")
      ).toBe(true);
    });

    it("returns false for timestamps on different days", () => {
      expect(
        isSameDay("2025-06-27T12:00:00", "2025-06-28T12:00:00")
      ).toBe(false);
    });

    it("returns false across month/year boundaries", () => {
      expect(
        isSameDay("2024-12-31T12:00:00", "2025-01-01T12:00:00")
      ).toBe(false);
    });
  });

  describe("formatDateDivider", () => {
    it("labels today as Today", () => {
      const now = new Date().toISOString();
      expect(formatDateDivider(now)).toBe("Today");
    });

    it("labels yesterday as Yesterday", () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      expect(formatDateDivider(yesterday.toISOString())).toBe("Yesterday");
    });

    it("returns a full date for older timestamps", () => {
      const label = formatDateDivider("2020-01-15T12:00:00Z");
      expect(label).not.toBe("Today");
      expect(label).not.toBe("Yesterday");
      expect(label).toMatch(/2020/);
    });
  });

  describe("formatTimeShort", () => {
    it("produces a non-empty time string without a year", () => {
      const result = formatTimeShort("2025-06-27T15:30:00Z");
      expect(result.length).toBeGreaterThan(0);
      expect(result).not.toMatch(/2025/);
    });
  });
});
