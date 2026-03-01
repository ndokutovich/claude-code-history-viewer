import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, createModuleLogger, updateLogger } from "../utils/logger";

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Note: The logger reads import.meta.env.DEV at module load time.
  // In vitest, the test environment runs with DEV = true, so all log functions
  // should call console methods.

  describe("module exports", () => {
    it("exports a logger object with standard log methods", () => {
      expect(typeof logger.log).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });

    it("exports createModuleLogger factory function", () => {
      expect(typeof createModuleLogger).toBe("function");
    });

    it("exports updateLogger preconfigured instance", () => {
      expect(typeof updateLogger.log).toBe("function");
    });
  });

  describe("createModuleLogger", () => {
    it("should prefix log messages with module name in test (DEV) mode", () => {
      const testLogger = createModuleLogger("TestModule");
      testLogger.log("test message");

      // In vitest, DEV is true, so the logger should output with prefix
      expect(console.log).toHaveBeenCalledWith("[TestModule]", "test message");
    });

    it("should support multiple arguments with prefix", () => {
      const modLogger = createModuleLogger("MyMod");
      modLogger.warn("w1", "w2");

      expect(console.warn).toHaveBeenCalledWith("[MyMod]", "w1", "w2");
    });
  });

  describe("logger (no prefix)", () => {
    it("should log without prefix in test (DEV) mode", () => {
      logger.log("bare message");
      expect(console.log).toHaveBeenCalledWith("bare message");

      logger.error("err msg");
      expect(console.error).toHaveBeenCalledWith("err msg");
    });
  });

  describe("updateLogger", () => {
    it("should be a pre-configured logger with Update prefix", () => {
      updateLogger.log("checking for updates");
      expect(console.log).toHaveBeenCalledWith("[Update]", "checking for updates");
    });
  });
});
