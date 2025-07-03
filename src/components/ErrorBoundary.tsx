import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, Mail, Copy, RefreshCw } from "lucide-react";
import { COLORS } from "../constants/colors";
import { cn } from "../utils/cn";
import { withTranslation, type WithTranslation } from "react-i18next";

interface Props extends WithTranslation {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

class ErrorBoundaryComponent extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
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
    const { t } = this.props;
    const errorDetails = `
${t("error.copyTemplate.header", { defaultValue: "Error Information:" })}
${t("error.copyTemplate.separator", { defaultValue: "---------" })}
${t("error.copyTemplate.errorMessage", {
  message: error?.message || "Unknown error",
  defaultValue: "Error Message: {{message}}",
})}
${t("error.copyTemplate.errorStack", {
  stack: error?.stack || "No stack trace",
  defaultValue: "Error Stack: {{stack}}",
})}

${t("error.copyTemplate.componentStack", {
  defaultValue: "Component Stack:",
})}
${errorInfo?.componentStack || "No component stack"}

${t("error.copyTemplate.browserInfo", {
  defaultValue: "Browser Information:",
})}
${navigator.userAgent}

${t("error.copyTemplate.timestamp", {
  time: new Date().toISOString(),
  defaultValue: "Occurrence Time: {{time}}",
})}
    `;

    navigator.clipboard.writeText(errorDetails);
    this.setState({ copied: true });
    setTimeout(() => this.setState({ copied: false }), 2000);
  };

  render() {
    const { t } = this.props;
    if (this.state.hasError) {
      const emailSubject = encodeURIComponent(
        t("error.emailTemplate.subject", {
          error: this.state.error?.message || "Unknown error",
          defaultValue: "[Claude Code History Viewer] Error Report: {{error}}",
        })
      );
      const emailBody = encodeURIComponent(`
${t("error.emailTemplate.greeting", {
  defaultValue: "Hello,",
})}

${t("error.emailTemplate.description", {
  defaultValue:
    "I encountered the following error while using Claude Code History Viewer:",
})}

${t("error.emailTemplate.placeholder", {
  defaultValue: "[Please paste the copied error information here]",
})}

${t("error.emailTemplate.additionalInfo", {
  defaultValue: "Additional Information:",
})}
${t("error.emailTemplate.whatWereDoing", {
  defaultValue: "- What were you doing when the error occurred?",
})}
${t("error.emailTemplate.isRepeating", {
  defaultValue: "- Does this error occur repeatedly?",
})}
${t("error.emailTemplate.otherNotes", {
  defaultValue: "- Other notes:",
})}

${t("error.emailTemplate.thanks", {
  defaultValue: "Thank you.",
})}

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
                {t("error.unexpectedError", {
                  defaultValue: "An unexpected error occurred",
                })}
              </h1>
              <p className={cn("text-lg", COLORS.ui.text.secondary)}>
                {t("error.apologize", {
                  defaultValue:
                    "We apologize for the inconvenience. Please try the following solutions to resolve the issue.",
                })}
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
                {t("error.errorInfo", {
                  defaultValue: "Error Information",
                })}
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
                    {t("error.viewDetails", {
                      defaultValue: "View Details",
                    })}
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
                  {t("error.reportError", {
                    defaultValue: "Report Error",
                  })}
                </h3>
                <p className={cn("text-sm mb-3", COLORS.ui.text.secondary)}>
                  {t("error.reportDescription", {
                    defaultValue:
                      "If this error occurs repeatedly, please report it to the email below:",
                  })}
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
                    {this.state.copied
                      ? t("error.copied", {
                          defaultValue: "Copied!",
                        })
                      : t("error.copyErrorInfo", {
                          defaultValue: "Copy Error Information",
                        })}
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
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t("error.restartApp", {
                    defaultValue: "Restart App",
                  })}
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
                {t("error.troubleshooting", {
                  defaultValue: "Troubleshooting",
                })}
              </h4>
              <ul className={cn("space-y-1", COLORS.ui.text.secondary)}>
                <li>
                  •{" "}
                  {t("error.troubleshootingSteps.restart", {
                    defaultValue:
                      "Try completely closing and restarting the app",
                  })}
                </li>
                <li>
                  •{" "}
                  {t("error.troubleshootingSteps.updateVersion", {
                    defaultValue:
                      "Ensure you have the latest version of Claude Code History Viewer installed",
                  })}
                </li>
                <li>
                  •{" "}
                  {t("error.troubleshootingSteps.tryOtherProject", {
                    defaultValue:
                      "Try opening a different project to see if the issue persists",
                  })}
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

export const ErrorBoundary = withTranslation("components")(
  ErrorBoundaryComponent
);
