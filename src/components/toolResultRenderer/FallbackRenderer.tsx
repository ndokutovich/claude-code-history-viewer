import { Check } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Renderer } from "../../shared/RendererHeader";
import { cn } from "../../utils/cn";
import { COLORS } from "../../constants/colors";

type Props = {
  toolResult: Record<string, unknown>;
};

export const FallbackRenderer = ({ toolResult }: Props) => {
  return (
    <Renderer
      className={cn(COLORS.ui.background.primary, COLORS.ui.border.light)}
    >
      <Renderer.Header
        title="도구 실행 결과"
        icon={<Check className={cn(COLORS.ui.text.muted)} />}
        titleClassName={cn(COLORS.ui.text.secondary)}
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
