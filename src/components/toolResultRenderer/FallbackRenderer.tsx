import { Check } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
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
          <Highlight
            theme={themes.vsDark}
            code={JSON.stringify(toolResult, null, 2)}
            language="json"
          >
            {({ className, style, tokens, getLineProps, getTokenProps }) => (
              <pre
                className={className}
                style={{
                  ...style,
                  margin: 0,
                  fontSize: "0.75rem",
                  padding: "0.5rem",
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
      </Renderer.Content>
    </Renderer>
  );
};
