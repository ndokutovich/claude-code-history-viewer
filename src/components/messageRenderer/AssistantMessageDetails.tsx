import React from 'react';
import { HelpCircle } from 'lucide-react';
import type { ClaudeMessage } from '../../types';

interface AssistantMessageDetailsProps {
  message: ClaudeMessage;
}

export const AssistantMessageDetails: React.FC<AssistantMessageDetailsProps> = ({ message }) => {
  const { model, usage, type } = message;

  if (type !== 'assistant' || !model) {
    return null;
  }

  return (
    <div className="flex items-center justify-start mt-1.5 space-x-2 text-xs text-gray-400">
      <span>Model: {model}</span>
      {usage && (usage.input_tokens || usage.output_tokens) && (
        <div className="relative group">
          <HelpCircle className="w-3.5 h-3.5 cursor-help" />
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 bg-gray-800 text-white text-xs rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-10">
            <p><strong>Token Usage:</strong></p>
            {usage.input_tokens ? <p>Input: {usage.input_tokens}</p> : null}
            {usage.output_tokens ? <p>Output: {usage.output_tokens}</p> : null}
            {usage.cache_creation_input_tokens ? <p>Cache Creation: {usage.cache_creation_input_tokens}</p> : null}
            {usage.cache_read_input_tokens ? <p>Cache Read: {usage.cache_read_input_tokens}</p> : null}
            {usage.service_tier ? <p>Tier: {usage.service_tier}</p> : null}
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-800"></div>
          </div>
        </div>
      )}
    </div>
  );
};