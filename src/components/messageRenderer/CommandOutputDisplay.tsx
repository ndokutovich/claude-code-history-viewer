import React from "react";
import { Highlight, themes } from "prism-react-renderer";
import { Terminal, Package, TestTube, Hammer, BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CommandOutputDisplayProps {
  stdout: string;
}

export const CommandOutputDisplay: React.FC<CommandOutputDisplayProps> = ({
  stdout,
}) => {
  const { t } = useTranslation("components");
  // Detect various output types
  const isTestOutput =
    stdout.includes("Test Suites:") ||
    stdout.includes("jest") ||
    stdout.includes("coverage");
  const isBuildOutput =
    stdout.includes("webpack") ||
    stdout.includes("build") ||
    stdout.includes("compile");
  const isPackageOutput =
    stdout.includes("npm") ||
    stdout.includes("yarn") ||
    stdout.includes("pnpm");
  const isJsonOutput =
    stdout.trim().startsWith("{") && stdout.trim().endsWith("}");
  const isTableOutput =
    stdout.includes("|") &&
    stdout.includes("-") &&
    stdout.split("\n").length > 2;

  // Handle JSON output
  if (isJsonOutput) {
    try {
      const parsed = JSON.parse(stdout);
      return (
        <div className="bg-white rounded border">
          <div className="bg-gray-800 px-3 py-1 text-xs text-gray-300">
            {t("commandOutputDisplay.jsonOutput", {
              defaultValue: "JSON Output",
            })}
          </div>
          <Highlight
            theme={themes.vsDark}
            code={JSON.stringify(parsed, null, 2)}
            language="json"
          >
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre
                className={className}
                style={{
                  ...style,
                  margin: 0,
                  fontSize: "0.75rem",
                  padding: "1rem",
                }}
              >
                {tokens.map((line, i) => (
                  <div key={i} {...getLineProps({ line, key: i })}>
                    {line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token, key })} />
                    ))}
                  </div>
                ))}
              </pre>
            )}
          </Highlight>
        </div>
      );
    } catch {
      // Treat as plain text if JSON parsing fails
    }
  }

  // Handle test output
  if (isTestOutput) {
    return (
      <div className="bg-white rounded border">
        <div className="bg-green-800 px-3 py-1 text-xs text-green-100 flex items-center space-x-2">
          <TestTube className="w-4 h-4" />
          <span>
            {t("commandOutputDisplay.testResults", {
              defaultValue: "Test Results",
            })}
          </span>
        </div>
        <pre className="text-sm text-gray-700 whitespace-pre-wrap p-3 font-mono">
          {stdout}
        </pre>
      </div>
    );
  }

  // Handle build output
  if (isBuildOutput) {
    return (
      <div className="bg-white rounded border">
        <div className="bg-blue-800 px-3 py-1 text-xs text-blue-100 flex items-center space-x-2">
          <Hammer className="w-4 h-4" />
          <span>
            {t("commandOutputDisplay.buildOutput", {
              defaultValue: "Build Output",
            })}
          </span>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap p-3 font-mono">
            {stdout}
          </pre>
        </div>
      </div>
    );
  }

  // Handle package manager output
  if (isPackageOutput) {
    return (
      <div className="bg-white rounded border">
        <div className="bg-purple-800 px-3 py-1 text-xs text-purple-100 flex items-center space-x-2">
          <Package className="w-4 h-4" />
          <span>
            {t("commandOutputDisplay.packageManagement", {
              defaultValue: "Package Management",
            })}
          </span>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap p-3 font-mono">
            {stdout}
          </pre>
        </div>
      </div>
    );
  }

  // Handle table format output
  if (isTableOutput) {
    return (
      <div className="bg-white rounded border">
        <div className="bg-gray-800 px-3 py-1 text-xs text-gray-300 flex items-center space-x-2">
          <BarChart3 className="w-4 h-4" />
          <span>
            {t("commandOutputDisplay.tableOutput", {
              defaultValue: "Table Output",
            })}
          </span>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap p-3 font-mono">
            {stdout}
          </pre>
        </div>
      </div>
    );
  }

  // Default output (bash/shell)
  return (
    <div className="bg-white rounded border">
      <div className="bg-gray-800 px-3 py-1 text-xs text-gray-300 flex items-center space-x-2">
        <Terminal className="w-4 h-4" />
        <span>
          {t("commandOutputDisplay.terminalOutput", {
            defaultValue: "Terminal Output",
          })}
        </span>
      </div>
      <div className="max-h-80 overflow-y-auto scrollbar-thin">
        <pre className="text-sm text-gray-700 whitespace-pre-wrap p-3 font-mono">
          {stdout}
        </pre>
      </div>
    </div>
  );
};
