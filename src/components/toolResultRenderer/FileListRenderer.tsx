import { FileText } from "lucide-react";
import { Renderer } from "../../shared/RendererHeader";
import { useTranslation } from 'react-i18next';
import { cn } from "../../utils/cn";
import { COLORS } from "../../constants/colors";

type Props = {
  toolResult: Record<string, unknown>;
};

export const FileListRenderer = ({ toolResult }: Props) => {
  const { t } = useTranslation('components');
  return (
    <Renderer className={cn(COLORS.tools.file.bg, COLORS.tools.file.border)}>
      <Renderer.Header
        title={t('fileListRenderer.fileList', { count: Number(toolResult.numFiles) })}
        icon={<FileText className={cn("w-4 h-4", COLORS.tools.file.icon)} />}
        titleClassName={COLORS.tools.file.text}
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
                  className={cn(
                    "flex items-center space-x-2 p-2 rounded border",
                    COLORS.ui.background.primary,
                    COLORS.ui.border.medium
                  )}
                >
                  <FileText className={cn("w-4 h-4", COLORS.ui.text.muted)} />
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        "font-mono text-sm",
                        COLORS.ui.text.primary
                      )}
                    >
                      {fileName}
                    </div>
                    {directory && (
                      <div
                        className={cn(
                          "font-mono text-xs",
                          COLORS.ui.text.muted
                        )}
                      >
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
