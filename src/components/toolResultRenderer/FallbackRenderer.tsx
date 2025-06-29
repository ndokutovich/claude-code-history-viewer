import { Check } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Renderer } from "../../shared/RendererHeader";

type Props = {
  toolResult: Record<string, unknown>;
};

export const FallbackRenderer = ({ toolResult }: Props) => {
  return (
    <Renderer className="bg-gray-50 border border-gray-200">
      <Renderer.Header
        title="도구 실행 결과"
        icon={<Check className="w-4 h-4 text-gray-500" />}
        titleClassName="text-gray-800"
      />
      <Renderer.Content>
        <div className="text-sm">
          <SyntaxHighlighter
            language="json"
            style={vscDarkPlus}
            customStyle={{
              margin: 0,
              fontSize: "0.75rem",
              padding: "0.5rem",
            }}
          >
            {JSON.stringify(toolResult, null, 2)}
          </SyntaxHighlighter>
        </div>
      </Renderer.Content>
    </Renderer>
  );
};
