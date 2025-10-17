import { Terminal, CheckCircle, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "../../utils/cn";

type Props = {
  text: string;
};

interface CommandGroup {
  name?: string;
  message?: string;
  args?: string;
}

interface OutputTag {
  type: "stdout" | "stderr" | "other";
  name: string;
  content: string;
}

export const CommandRenderer = ({ text }: Props) => {
  const { t } = useTranslation("components");

  // Extract Command group (name, message, args)
  const commandNameRegex = /<command-name>\s*(.*?)\s*<\/command-name>/gs;
  const commandMessageRegex =
    /<command-message>\s*(.*?)\s*<\/command-message>/gs;
  const commandArgsRegex = /<command-args>\s*(.*?)\s*<\/command-args>/gs;

  const nameMatch = text.match(commandNameRegex);
  const messageMatch = text.match(commandMessageRegex);
  const argsMatch = text.match(commandArgsRegex);

  const extractedName = nameMatch?.[0]
    ?.replace(/<\/?command-name>/g, "")
    .trim();
  const extractedMessage = messageMatch?.[0]
    ?.replace(/<\/?command-message>/g, "")
    .trim();
  const extractedArgs = argsMatch?.[0]
    ?.replace(/<\/?command-args>/g, "")
    .trim();

  const commandGroup: CommandGroup = {
    name: extractedName && extractedName.length > 0 ? extractedName : undefined,
    message:
      extractedMessage && extractedMessage.length > 0
        ? extractedMessage
        : undefined,
    args: extractedArgs && extractedArgs.length > 0 ? extractedArgs : undefined,
  };

  // Extract output tags (stdout, stderr, etc.) - using comprehensive patterns
  const outputTags: OutputTag[] = [];

  // stdout family: all tags containing stdout or output
  const stdoutRegex = /<([^>]*(?:stdout|output)[^>]*)\s*>\s*(.*?)\s*<\/\1>/gs;
  // stderr family: all tags containing stderr or error
  const stderrRegex = /<([^>]*(?:stderr|error)[^>]*)\s*>\s*(.*?)\s*<\/\1>/gs;

  let match;

  // stdout family tags
  while ((match = stdoutRegex.exec(text)) !== null) {
    const [, tagName, content] = match;
    if (content && content.trim()) {
      outputTags.push({
        type: "stdout",
        name: tagName ?? "",
        content: content.trim(),
      });
    }
  }

  // stderr family tags
  while ((match = stderrRegex.exec(text)) !== null) {
    const [, tagName, content] = match;
    if (content && content.trim()) {
      outputTags.push({
        type: "stderr",
        name: tagName ?? "",
        content: content.trim(),
      });
    }
  }

  // Remove all tags
  const withoutCommands = text
    .replace(commandNameRegex, "")
    .replace(commandMessageRegex, "")
    .replace(commandArgsRegex, "")
    .replace(stdoutRegex, "")
    .replace(stderrRegex, "")
    .replace(/^\s*\n/gm, "") // Remove empty lines
    .trim();

  const hasCommandGroup =
    commandGroup.name || commandGroup.message || commandGroup.args;
  const hasOutputs = outputTags.length > 0;

  if (!hasCommandGroup && !hasOutputs && !withoutCommands) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Command Group - processed as a unit */}
      {hasCommandGroup && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <Terminal className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-medium text-indigo-800">
              {t("commandRenderer.commandExecution")}
            </span>
          </div>

          <div className="space-y-2">
            {commandGroup.name && (
              <div className="flex items-start space-x-2">
                <span className="text-xs font-medium text-indigo-700 mt-0.5 min-w-[40px]">
                  {t("commandRenderer.command")}
                </span>
                <code className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs font-mono">
                  {commandGroup.name}
                </code>
              </div>
            )}

            {commandGroup.args && (
              <div className="flex items-start space-x-2">
                <span className="text-xs font-medium text-indigo-700 mt-0.5 min-w-[40px]">
                  {t("commandRenderer.arguments")}
                </span>
                <code className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-mono whitespace-pre-wrap">
                  {commandGroup.args}
                </code>
              </div>
            )}

            {commandGroup.message && (
              <div className="flex items-start space-x-2">
                <span className="text-xs font-medium text-indigo-700 mt-0.5 min-w-[40px]">
                  {t("commandRenderer.status")}
                </span>
                <span className="text-sm text-indigo-600 italic">
                  {commandGroup.message}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Output tags */}
      {outputTags.map((output, index) => {
        const isError = output.type === "stderr";

        // Light and dark mode compatible colors
        const bgColor = isError
          ? "bg-red-50 dark:bg-red-900/30"
          : "bg-green-50 dark:bg-green-900/30";
        const borderColor = isError
          ? "border-red-200 dark:border-red-700"
          : "border-green-200 dark:border-green-700";
        const textColor = isError
          ? "text-red-800 dark:text-red-300"
          : "text-green-800 dark:text-green-300";
        const contentBg = isError
          ? "bg-red-100 dark:bg-red-900/40"
          : "bg-green-100 dark:bg-green-900/40";
        const contentText = isError
          ? "text-red-700 dark:text-red-200"
          : "text-green-700 dark:text-green-200";

        const Icon = isError ? AlertCircle : CheckCircle;
        const label = isError
          ? t("commandRenderer.errorOutput")
          : t("commandRenderer.executionResult");

        return (
          <div
            key={index}
            className={`${bgColor} border ${borderColor} rounded-lg p-3`}
          >
            <div className="flex items-center space-x-2 mb-2">
              <Icon className={`w-4 h-4 ${textColor}`} />
              <span className={`text-xs font-medium ${textColor}`}>
                {label} ({output.name})
              </span>
            </div>

            <div
              data-command-output={isError ? "error" : "success"}
              className={cn(
                `p-2 rounded max-h-80 overflow-y-auto text-sm`,
                contentBg,
                contentText,
                // Use custom CSS classes for markdown element styling (defined in index.css)
                isError ? "command-output-error" : "command-output-success"
              )}
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {output.content}
              </ReactMarkdown>
            </div>
          </div>
        );
      })}

      {/* Remaining text */}
      {withoutCommands && (
        <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-code:text-red-600 prose-code:bg-gray-100">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {withoutCommands}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};
