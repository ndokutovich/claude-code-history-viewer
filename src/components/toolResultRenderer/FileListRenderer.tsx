import { FileText } from "lucide-react";
import { Renderer } from "../../shared/RendererHeader";

type Props = {
  toolResult: Record<string, unknown>;
};

export const FileListRenderer = ({ toolResult }: Props) => {
  return (
    <Renderer className="bg-blue-50 border-blue-200">
      <Renderer.Header
        title={`파일 목록 (${toolResult.numFiles}개)`}
        icon={<FileText className="w-4 h-4 text-blue-600" />}
        titleClassName="text-blue-800"
      />

      <Renderer.Content>
        <div className="space-y-1">
          {(toolResult.filenames as string[]).map(
            (filePath: string, idx: number) => {
              const pathParts = filePath.split("/");
              const fileName = pathParts[pathParts.length - 1] || filePath;
              const directory = filePath.substring(
                0,
                filePath.lastIndexOf("/")
              );

              return (
                <div
                  key={idx}
                  className="flex items-center space-x-2 p-2 bg-white rounded hover:bg-gray-50 transition-colors border"
                >
                  <FileText className="w-3 h-3 text-gray-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-gray-900 truncate">
                      {fileName}
                    </div>
                    {directory && (
                      <div className="font-mono text-xs text-gray-500 truncate">
                        {directory}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      </Renderer.Content>
    </Renderer>
  );
};
