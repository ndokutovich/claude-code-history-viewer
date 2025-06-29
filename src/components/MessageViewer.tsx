import React from "react";
import { MessageCircle } from "lucide-react";
import type { ClaudeMessage } from "../types";
import { ClaudeContentArrayRenderer } from "./contentRenderer";
import {
  ClaudeToolUseDisplay,
  ToolExecutionResultRouter,
  MessageContentDisplay,
} from "./messageRenderer";
import { formatTime, extractClaudeMessageContent } from "../utils/messageUtils";

interface MessageViewerProps {
  messages: ClaudeMessage[];
  isLoading: boolean;
}

interface MessageNodeProps {
  message: ClaudeMessage;
  depth: number;
}

const ClaudeMessageNode = ({ message, depth }: MessageNodeProps) => {
  return (
    <div className="w-full px-4 py-2">
      <div className="max-w-4xl mx-auto">
        {/* 메시지 헤더 (시간, 사용자 정보) */}
        <div
          className={`flex items-center space-x-2 mb-1 text-xs text-gray-500 ${
            message.type === "user" ? "justify-end" : "justify-start"
          }`}
        >
          <span className="font-medium">
            {message.type === "user"
              ? "사용자"
              : message.type === "assistant"
              ? "Claude"
              : "시스템"}
          </span>
          <span>{formatTime(message.timestamp)}</span>
          {message.isSidechain && (
            <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full">
              분기
            </span>
          )}
        </div>

        {/* 메시지 내용 */}
        <div className="w-full">
          {/* Message Content */}
          <MessageContentDisplay
            content={extractClaudeMessageContent(message)}
            messageType={message.type}
          />

          {/* Claude API Content Array */}
          {message.content &&
            typeof message.content === "object" &&
            Array.isArray(message.content) &&
            (message.type !== "assistant" ||
              (message.type === "assistant" &&
                !extractClaudeMessageContent(message))) && (
              <div className="mb-2">
                <ClaudeContentArrayRenderer
                  content={message.content}
                  messageType={message.type}
                />
              </div>
            )}

          {/* Special case: when content is null but toolUseResult exists */}
          {!extractClaudeMessageContent(message) &&
            message.toolUseResult &&
            typeof message.toolUseResult === "object" &&
            Array.isArray(message.toolUseResult.content) && (
              <div className="text-sm text-gray-600 mb-2">
                <span className="italic">도구 실행 결과:</span>
              </div>
            )}

          {/* Tool Use */}
          {message.toolUse && (
            <ClaudeToolUseDisplay toolUse={message.toolUse} />
          )}

          {/* Tool Result */}
          {message.toolUseResult && (
            <ToolExecutionResultRouter
              toolResult={message.toolUseResult}
              depth={depth}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const MessageViewer: React.FC<MessageViewerProps> = ({
  messages,
  isLoading,
}) => {
  // 메시지를 트리 구조로 변환
  const buildMessageTree = (messages: ClaudeMessage[]) => {
    const messageMap = new Map<string, ClaudeMessage>();
    const roots: ClaudeMessage[] = [];

    // 모든 메시지를 맵에 저장
    messages.forEach((msg) => messageMap.set(msg.uuid, msg));

    // 루트 메시지들과 자식 메시지들 구분
    messages.forEach((msg) => {
      if (!msg.parentUuid || msg.parentUuid === null) {
        roots.push(msg);
      }
    });

    return roots;
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center space-x-2 text-gray-500">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-claude-orange"></div>
          <span>메시지를 불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
        <div className="mb-4">
          <MessageCircle className="w-16 h-16 mx-auto text-gray-400" />
        </div>
        <h3 className="text-lg font-medium mb-2">메시지가 없습니다</h3>
        <p className="text-sm text-center">
          왼쪽에서 프로젝트와 세션을 선택하여
          <br />
          대화 내용을 확인하세요.
        </p>
      </div>
    );
  }

  const renderMessageTree = (
    message: ClaudeMessage,
    depth = 0,
    visitedIds = new Set<string>()
  ): React.ReactNode => {
    // 순환 참조 방지
    if (visitedIds.has(message.uuid)) {
      console.warn(`Circular reference detected for message: ${message.uuid}`);
      return null;
    }

    visitedIds.add(message.uuid);
    const children = messages.filter((m) => m.parentUuid === message.uuid);

    return (
      <div key={message.uuid}>
        <ClaudeMessageNode message={message} depth={depth} />
        {children.map((child) =>
          renderMessageTree(child, depth + 1, new Set(visitedIds))
        )}
      </div>
    );
  };

  const rootMessages = buildMessageTree(messages);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-4xl mx-auto">
        {rootMessages.map((message) => renderMessageTree(message))}
      </div>
    </div>
  );
};
