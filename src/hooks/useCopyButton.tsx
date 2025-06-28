import { useState } from "react";
import { RefreshCw, Check, X, Clipboard } from "lucide-react";

interface CopyState {
  [key: string]: "idle" | "copying" | "success" | "error";
}

export const useCopyButton = () => {
  // 클립보드 복사 상태 관리
  const [copyStates, setCopyStates] = useState<CopyState>({});

  // 클립보드 복사 헬퍼 함수
  const copyToClipboard = async (text: string, id: string) => {
    setCopyStates((prev) => ({ ...prev, [id]: "copying" }));

    try {
      await navigator.clipboard.writeText(text);
      setCopyStates((prev) => ({ ...prev, [id]: "success" }));

      // 2초 후 상태 초기화
      setTimeout(() => {
        setCopyStates((prev) => ({ ...prev, [id]: "idle" }));
      }, 2000);
    } catch (error) {
      console.error("클립보드 복사 실패:", error);
      setCopyStates((prev) => ({ ...prev, [id]: "error" }));

      // 2초 후 상태 초기화
      setTimeout(() => {
        setCopyStates((prev) => ({ ...prev, [id]: "idle" }));
      }, 2000);
    }
  };

  // 복사 버튼 렌더링 헬퍼
  const renderCopyButton = (
    text: string,
    id: string,
    label: string = "복사"
  ) => {
    const state = copyStates[id] || "idle";

    return (
      <button
        onClick={() => copyToClipboard(text, id)}
        disabled={state === "copying"}
        className={`flex items-center space-x-1 px-2 py-1 text-xs rounded transition-colors ${
          state === "success"
            ? "bg-green-100 text-green-700"
            : state === "error"
            ? "bg-red-100 text-red-700"
            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
        }`}
        title={`${label}하기`}
      >
        {state === "copying" ? (
          <>
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>복사 중...</span>
          </>
        ) : state === "success" ? (
          <>
            <Check className="w-3 h-3" />
            <span>복사됨</span>
          </>
        ) : state === "error" ? (
          <>
            <X className="w-3 h-3" />
            <span>실패</span>
          </>
        ) : (
          <>
            <Clipboard className="w-3 h-3" />
            <span>{label}</span>
          </>
        )}
      </button>
    );
  };

  return {
    copyStates,
    copyToClipboard,
    renderCopyButton,
  };
};
