import { GitBranch } from "lucide-react";
import { useTranslation } from 'react-i18next';

type Props = {
  gitData: Record<string, unknown>;
};

// Render Git workflow results
export const GitWorkflowRenderer = ({ gitData }: Props) => {
  const { t } = useTranslation('components');
  const command = gitData.command || "";
  const status = gitData.status || "";
  const files = gitData.files || [];
  const diff = gitData.diff || "";

  return (
    <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
      <div className="flex items-center space-x-2 mb-3">
        <GitBranch className="w-4 h-4 text-orange-600" />
        <span className="font-medium text-orange-800">{t('gitWorkflowRenderer.gitWorkflow')}</span>
        {command && (
          <code className="text-xs bg-orange-100 px-2 py-1 rounded text-orange-700">
            git {String(command)}
          </code>
        )}
      </div>

      {status && (
        <div className="mb-2 text-sm text-orange-700">
          <span className="font-medium">{t('gitWorkflowRenderer.status')}</span> {String(status)}
        </div>
      )}

      {Array.isArray(files) && files.length > 0 && (
        <details className="mb-2">
          <summary className="cursor-pointer text-orange-700 font-medium text-sm">
            {t('gitWorkflowRenderer.changedFiles', { count: files.length })}
          </summary>
          <div className="mt-2 space-y-1">
            {files.map((file, idx) => (
              <div
                key={idx}
                className="text-xs font-mono text-orange-800 bg-orange-100 px-2 py-1 rounded"
              >
                {String(file)}
              </div>
            ))}
          </div>
        </details>
      )}

      {diff && (
        <details>
          <summary className="cursor-pointer text-orange-700 font-medium text-sm">
            {t('gitWorkflowRenderer.viewDiff')}
          </summary>
          <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-48">
            {String(diff)}
          </pre>
        </details>
      )}
    </div>
  );
};
