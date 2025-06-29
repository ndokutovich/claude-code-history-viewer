import React from "react";
import { Highlight, themes } from "prism-react-renderer";
import { Terminal, Package, TestTube, Hammer, BarChart3 } from "lucide-react";

interface CommandOutputDisplayProps {
  stdout: string;
}

export const CommandOutputDisplay: React.FC<CommandOutputDisplayProps> = ({
  stdout,
}) => {
  // 다양한 출력 유형 감지
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

  // JSON 출력 처리
  if (isJsonOutput) {
    try {
      const parsed = JSON.parse(stdout);
      return (
        <div className="bg-white rounded border">
          <div className="bg-gray-800 px-3 py-1 text-xs text-gray-300">
            JSON 출력
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
      // JSON 파싱 실패시 일반 텍스트로 처리
    }
  }

  // 테스트 출력 처리
  if (isTestOutput) {
    return (
      <div className="bg-white rounded border">
        <div className="bg-green-800 px-3 py-1 text-xs text-green-100 flex items-center space-x-2">
          <TestTube className="w-4 h-4" />
          <span>테스트 결과</span>
        </div>
        <pre className="text-sm text-gray-700 whitespace-pre-wrap p-3 font-mono">
          {stdout}
        </pre>
      </div>
    );
  }

  // 빌드 출력 처리
  if (isBuildOutput) {
    return (
      <div className="bg-white rounded border">
        <div className="bg-blue-800 px-3 py-1 text-xs text-blue-100 flex items-center space-x-2">
          <Hammer className="w-4 h-4" />
          <span>빌드 출력</span>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap p-3 font-mono">
            {stdout}
          </pre>
        </div>
      </div>
    );
  }

  // 패키지 매니저 출력 처리
  if (isPackageOutput) {
    return (
      <div className="bg-white rounded border">
        <div className="bg-purple-800 px-3 py-1 text-xs text-purple-100 flex items-center space-x-2">
          <Package className="w-4 h-4" />
          <span>패키지 관리</span>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap p-3 font-mono">
            {stdout}
          </pre>
        </div>
      </div>
    );
  }

  // 테이블 형태 출력 처리
  if (isTableOutput) {
    return (
      <div className="bg-white rounded border">
        <div className="bg-gray-800 px-3 py-1 text-xs text-gray-300 flex items-center space-x-2">
          <BarChart3 className="w-4 h-4" />
          <span>표 형태 출력</span>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          <pre className="text-sm text-gray-700 whitespace-pre-wrap p-3 font-mono">
            {stdout}
          </pre>
        </div>
      </div>
    );
  }

  // 기본 출력 (bash/shell)
  return (
    <div className="bg-white rounded border">
      <div className="bg-gray-800 px-3 py-1 text-xs text-gray-300 flex items-center space-x-2">
        <Terminal className="w-4 h-4" />
        <span>터미널 출력</span>
      </div>
      <div className="max-h-80 overflow-y-auto scrollbar-thin">
        <pre className="text-sm text-gray-700 whitespace-pre-wrap p-3 font-mono">
          {stdout}
        </pre>
      </div>
    </div>
  );
};
