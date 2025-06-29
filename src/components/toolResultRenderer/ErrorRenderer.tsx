import { X } from "lucide-react";
import { Renderer } from "../../shared/RendererHeader";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  error: string;
};

export const ErrorRenderer = ({ error }: Props) => {
  // Extract the error details
  const errorMessage = error.replace("Error: ", "");

  return (
    <Renderer className="bg-red-50 border-red-200">
      <Renderer.Header
        title="도구 실행 오류"
        icon={<X className="w-4 h-4 text-red-500" />}
        titleClassName="text-red-800"
      />
      <Renderer.Content>
        <div className="text-sm text-red-700 bg-red-100 border border-red-200 rounded-lg p-3 whitespace-pre-wrap max-h-80 overflow-y-scroll">
          <Markdown remarkPlugins={[remarkGfm]}>{errorMessage}</Markdown>
        </div>
      </Renderer.Content>
    </Renderer>
  );
};
