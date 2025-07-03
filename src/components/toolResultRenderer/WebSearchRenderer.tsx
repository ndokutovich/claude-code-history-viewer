import { Globe } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useTranslation } from "react-i18next";

type Props = {
  searchData: Record<string, unknown>;
};

export const WebSearchRenderer = ({ searchData }: Props) => {
  const { t } = useTranslation('components');
  const query = typeof searchData.query === "string" ? searchData.query : "";
  const results = Array.isArray(searchData.results) ? searchData.results : [];
  const durationSeconds =
    typeof searchData.durationSeconds === "number"
      ? searchData.durationSeconds
      : null;

  return (
    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center space-x-2 mb-2">
        <Globe className="w-4 h-4" />
        <span className="font-medium text-blue-800">{t('webSearchRenderer.title')}</span>
      </div>

      {/* 검색 정보 */}
      <div className="mb-3">
        <div className="text-xs font-medium text-gray-600 mb-1">{t('webSearchRenderer.query')}</div>
        <code className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-800 block">
          {query}
        </code>
      </div>

      {/* 메타데이터 */}
      {durationSeconds && (
        <div className="mb-3 text-xs">
          <div className="bg-white p-2 rounded border">
            <div className="text-gray-600">{t('webSearchRenderer.duration')}</div>
            <div className="font-medium text-blue-600">
              {durationSeconds.toFixed(2)}{t('webSearchRenderer.seconds')}
            </div>
          </div>
        </div>
      )}

      {/* 검색 결과 */}
      {results.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-600 mb-2">
            {t('webSearchRenderer.results', { count: results.length })}
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {results.map((result: unknown, index: number) => (
              <div
                key={index}
                className="bg-white p-3 rounded border border-gray-200 hover:border-blue-300 transition-colors"
              >
                {typeof result === "string" ? (
                  (() => {
                    // 문자열이 JSON인지 확인하고 파싱 시도
                    try {
                      const trimmed = result.trim();
                      if (
                        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
                        (trimmed.startsWith("[") && trimmed.endsWith("]"))
                      ) {
                        const parsed = JSON.parse(trimmed);

                        // 파싱된 객체가 웹 검색 결과 구조인지 확인
                        if (parsed && typeof parsed === "object") {
                          const title =
                            typeof parsed.title === "string"
                              ? parsed.title
                              : null;
                          const url =
                            typeof parsed.url === "string" ? parsed.url : null;
                          const description =
                            typeof parsed.description === "string"
                              ? parsed.description
                              : null;

                          if (title || url || description) {
                            return (
                              <div className="space-y-2">
                                {/* Title */}
                                {title && (
                                  <div className="space-y-1">
                                    <h4 className="font-medium text-gray-900 text-sm leading-tight">
                                      {title}
                                    </h4>
                                  </div>
                                )}

                                {/* URL */}
                                {url && (
                                  <div className="flex items-center space-x-2">
                                    <Globe className="w-3 h-3 text-green-500 flex-shrink-0" />
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-green-600 hover:text-green-800 hover:underline truncate"
                                      title={url}
                                    >
                                      {url.length > 60
                                        ? `${url.substring(0, 60)}...`
                                        : url}
                                    </a>
                                  </div>
                                )}

                                {/* Description */}
                                {description && (
                                  <div className="text-sm text-gray-700 leading-relaxed">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {description}
                                    </ReactMarkdown>
                                  </div>
                                )}
                              </div>
                            );
                          }
                        }
                      }
                    } catch {
                      // JSON 파싱 실패시 일반 텍스트로 처리
                    }

                    // 일반 마크다운 텍스트로 처리
                    return (
                      <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-blue-600 prose-code:text-red-600 prose-code:bg-gray-100">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {result}
                        </ReactMarkdown>
                      </div>
                    );
                  })()
                ) : result && typeof result === "object" ? (
                  <div>
                    {/* Handle structured web search result */}
                    {(() => {
                      const resultObj = result as Record<string, unknown>;
                      const title =
                        typeof resultObj.title === "string"
                          ? resultObj.title
                          : null;
                      const url =
                        typeof resultObj.url === "string"
                          ? resultObj.url
                          : null;
                      const description =
                        typeof resultObj.description === "string"
                          ? resultObj.description
                          : null;

                      // 웹 검색 결과 구조인지 확인
                      if (title || url || description) {
                        return (
                          <div className="space-y-2">
                            {/* Title */}
                            {title && (
                              <div className="space-y-1">
                                <h4 className="font-medium text-gray-900 text-sm leading-tight">
                                  {title}
                                </h4>
                              </div>
                            )}

                            {/* URL */}
                            {url && (
                              <div className="flex items-center space-x-2">
                                <Globe className="w-3 h-3 text-green-500 flex-shrink-0" />
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-green-600 hover:text-green-800 hover:underline truncate"
                                  title={url}
                                >
                                  {url.length > 60
                                    ? `${url.substring(0, 60)}...`
                                    : url}
                                </a>
                              </div>
                            )}

                            {/* Description */}
                            {description && (
                              <div className="text-sm text-gray-700 leading-relaxed">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {description}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // 다른 구조화된 결과 처리
                      if (
                        "content" in resultObj &&
                        Array.isArray(resultObj.content)
                      ) {
                        return (
                          <div className="space-y-2">
                            {resultObj.content.map(
                              (item: unknown, idx: number) => (
                                <div key={idx}>
                                  {item &&
                                  typeof item === "object" &&
                                  "text" in item &&
                                  typeof item.text === "string" ? (
                                    <div className="prose prose-sm max-w-none">
                                      <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                      >
                                        {item.text}
                                      </ReactMarkdown>
                                    </div>
                                  ) : (
                                    <pre className="text-xs text-gray-600 overflow-x-auto bg-gray-50 p-2 rounded">
                                      {JSON.stringify(item, null, 2)}
                                    </pre>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        );
                      }

                      // 일반적인 객체 표시
                      return (
                        <pre className="text-xs text-gray-600 overflow-x-auto bg-gray-50 p-2 rounded">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    {t('webSearchRenderer.unknownResultFormat')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
