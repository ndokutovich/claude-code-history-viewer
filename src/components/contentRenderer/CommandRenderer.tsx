import { Terminal } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  text: string;
};

export const CommandRenderer = ({ text }: Props) => {
  // Extract command message and command name
  const commandMessageRegex = /<command-message>(.*?)<\/command-message>/gs;
  const commandNameRegex = /<command-name>(.*?)<\/command-name>/gs;

  const messageMatches = text.match(commandMessageRegex);
  const nameMatches = text.match(commandNameRegex);

  const commandMessage = messageMatches
    ? messageMatches[0].replace(/<\/?command-message>/g, "").trim()
    : null;
  const commandName = nameMatches
    ? nameMatches[0].replace(/<\/?command-name>/g, "").trim()
    : null;

  // Remove command tags from original text
  const withoutCommands = text
    .replace(commandMessageRegex, "")
    .replace(commandNameRegex, "")
    .trim();

  return (
    <div className="space-y-2">
      {(commandMessage || commandName) && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
          <div className="flex items-center space-x-2 mb-2">
            <Terminal className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-medium text-indigo-800">
              명령 실행
            </span>
          </div>

          <div className="space-y-2">
            {commandName && (
              <div>
                <span className="text-xs font-medium text-indigo-700">
                  명령:
                </span>
                <code className="ml-2 px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-xs font-mono">
                  {commandName}
                </code>
              </div>
            )}

            {commandMessage && (
              <div>
                <span className="text-xs font-medium text-indigo-700">
                  상태:
                </span>
                <span className="ml-2 text-sm text-indigo-600 italic">
                  {commandMessage}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

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
