import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Mail, Copy, RefreshCw } from "lucide-react";
import { COLORS } from "../constants/colors";
import { cn } from "../utils/cn";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    });
    window.location.reload();
  };

  copyErrorDetails = () => {
    const { error, errorInfo } = this.state;
    const errorDetails = `
에러 정보:
---------
에러 메시지: ${error?.message || "Unknown error"}
에러 스택: ${error?.stack || "No stack trace"}

컴포넌트 스택:
${errorInfo?.componentStack || "No component stack"}

브라우저 정보:
${navigator.userAgent}

발생 시간: ${new Date().toISOString()}
    `;

    navigator.clipboard.writeText(errorDetails);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    if (this.state.hasError) {
      const emailSubject = encodeURIComponent(
        `[Claude Code History Viewer] 에러 리포트: ${
          this.state.error?.message || "Unknown error"
        }`
      );
      const emailBody = encodeURIComponent(`
안녕하세요,

Claude Code History Viewer 사용 중 다음과 같은 에러가 발생했습니다:

[여기에 복사한 에러 정보를 붙여넣어 주세요]

추가 정보:
- 어떤 작업을 하다가 에러가 발생했나요?
- 에러가 반복적으로 발생하나요?
- 기타 참고사항:

감사합니다.
      `);

      return (
        <div
          className={cn(
            "min-h-screen flex items-center justify-center p-6",
            COLORS.ui.background.primary
          )}
        >
          <div
            className={cn(
              "max-w-2xl w-full p-8 rounded-lg shadow-lg",
              COLORS.ui.background.white,
              COLORS.ui.border.light,
              "border"
            )}
          >
            <div className="text-center mb-6">
              <AlertTriangle
                className={cn(
                  "w-16 h-16 mx-auto mb-4",
                  COLORS.semantic.error.icon
                )}
              />
              <h1
                className={cn(
                  "text-2xl font-bold mb-2",
                  COLORS.semantic.error.textDark
                )}
              >
                예기치 않은 오류가 발생했습니다
              </h1>
              <p className={cn("text-lg", COLORS.ui.text.secondary)}>
                불편을 드려 죄송합니다. 아래 방법으로 문제를 해결해보세요.
              </p>
            </div>

            <div
              className={cn(
                "mb-6 p-4 rounded-lg",
                COLORS.semantic.error.bg,
                COLORS.semantic.error.border,
                "border"
              )}
            >
              <h2
                className={cn(
                  "font-semibold mb-2",
                  COLORS.semantic.error.textDark
                )}
              >
                에러 정보
              </h2>
              <pre
                className={cn(
                  "text-sm overflow-x-auto whitespace-pre-wrap",
                  COLORS.ui.text.tertiary
                )}
              >
                {this.state.error?.message || "Unknown error"}
              </pre>
              {this.state.error?.stack && (
                <details className="mt-2">
                  <summary
                    className={cn(
                      "cursor-pointer text-sm",
                      COLORS.ui.text.muted
                    )}
                  >
                    상세 정보 보기
                  </summary>
                  <pre
                    className={cn(
                      "mt-2 text-xs overflow-x-auto whitespace-pre-wrap",
                      COLORS.ui.text.muted
                    )}
                  >
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>

            <div className="space-y-4">
              <div
                className={cn(
                  "p-4 rounded-lg",
                  COLORS.semantic.info.bg,
                  COLORS.semantic.info.border,
                  "border"
                )}
              >
                <h3
                  className={cn(
                    "font-semibold mb-2 flex items-center",
                    COLORS.semantic.info.textDark
                  )}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  에러 제보하기
                </h3>
                <p className={cn("text-sm mb-3", COLORS.ui.text.secondary)}>
                  이 에러가 반복적으로 발생한다면 아래 이메일로 제보해주세요:
                </p>
                <div className="flex flex-col space-y-2">
                  <a
                    href={`mailto:relee6203@gmail.com?subject=${emailSubject}&body=${emailBody}`}
                    className={cn(
                      "inline-flex items-center text-sm font-medium",
                      COLORS.semantic.info.text,
                      "hover:underline"
                    )}
                  >
                    relee6203@gmail.com
                  </a>
                  <button
                    onClick={this.copyErrorDetails}
                    className={cn(
                      "inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      COLORS.semantic.info.bgDark,
                      COLORS.semantic.info.text,
                      "hover:opacity-80"
                    )}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    {this.state.copied ? "복사됨!" : "에러 정보 복사"}
                  </button>
                </div>
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={this.handleReset}
                  className={cn(
                    "px-6 py-3 rounded-lg font-medium transition-colors flex items-center",
                    "bg-blue-600 dark:bg-blue-500 text-white",
                    "hover:bg-blue-700 dark:hover:bg-blue-600"
                  )}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />앱 다시 시작
                </button>
              </div>
            </div>

            <div
              className={cn(
                "mt-6 p-4 rounded-lg text-sm",
                COLORS.ui.background.secondary
              )}
            >
              <h4 className={cn("font-semibold mb-2", COLORS.ui.text.primary)}>
                문제 해결 방법
              </h4>
              <ul className={cn("space-y-1", COLORS.ui.text.secondary)}>
                <li>• 앱을 완전히 종료한 뒤 다시 실행해보세요</li>
                {/* <li>
                  • [설정] 또는 [도움말] 메뉴에서 캐시/설정을 초기화해보세요
                </li> */}
                <li>
                  • Claude Code History Viewer의 최신 버전이 설치되어 있는지
                  확인하세요
                </li>
                <li>• 다른 프로젝트를 열어 문제가 반복되는지 확인해보세요</li>
                <li>
                  • 문제가 지속된다면 에러 정보를 복사해 개발자에게 제보해
                  주세요
                </li>
              </ul>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
