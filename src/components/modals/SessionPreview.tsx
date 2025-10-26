import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronUp, ChevronDown, Trash2, GripVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MessageBuilder } from '@/types';

interface SessionPreviewProps {
  messages: MessageBuilder[];
  onReorder: (messages: MessageBuilder[]) => void;
  onRemove: (id: string) => void;
}

export const SessionPreview: React.FC<SessionPreviewProps> = ({
  messages,
  onReorder,
  onRemove,
}) => {
  const { t } = useTranslation("common");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Estimate token count (rough approximation: 1 token ≈ 4 characters)
  const estimatedTokens = messages.reduce((sum, msg) => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return sum + Math.ceil(content.length / 4);
  }, 0);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    const newMessages = [...messages];
    const current = newMessages[index];
    const previous = newMessages[index - 1];
    if (!current || !previous) return;
    newMessages[index - 1] = current;
    newMessages[index] = previous;
    onReorder(newMessages);
  }, [messages, onReorder]);

  const handleMoveDown = useCallback((index: number) => {
    if (index === messages.length - 1) return;
    const newMessages = [...messages];
    const current = newMessages[index];
    const next = newMessages[index + 1];
    if (!current || !next) return;
    newMessages[index + 1] = current;
    newMessages[index] = next;
    onReorder(newMessages);
  }, [messages, onReorder]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newMessages = [...messages];
    const [draggedItem] = newMessages.splice(draggedIndex, 1);
    if (draggedItem) {
      newMessages.splice(dropIndex, 0, draggedItem);
      onReorder(newMessages);
    }
    setDraggedIndex(null);
  }, [draggedIndex, messages, onReorder]);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
  }, []);

  if (messages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('sessionBuilder.preview.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-accent/30 rounded-md">
        <div>
          <div className="text-sm text-muted-foreground">{t('sessionBuilder.preview.stats.totalMessages')}</div>
          <div className="text-2xl font-semibold">{messages.length}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">{t('sessionBuilder.preview.stats.estimatedTokens')}</div>
          <div className="text-2xl font-semibold">~{estimatedTokens.toLocaleString()}</div>
        </div>
      </div>

      {/* Message List with Drag-Drop */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground mb-2">
          {t('sessionBuilder.preview.order')}
        </div>

        {messages.map((msg, index) => (
          <div
            key={msg.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`
              group relative flex items-start gap-2 p-3 border rounded-md
              ${draggedIndex === index ? 'opacity-50' : ''}
              hover:bg-accent/50 transition-colors cursor-move
            `}
          >
            {/* Drag Handle */}
            <div className="flex-shrink-0 mt-1 text-muted-foreground cursor-grab active:cursor-grabbing">
              <GripVertical className="h-4 w-4" />
            </div>

            {/* Message Number */}
            <div className="flex-shrink-0 w-8 mt-1">
              <span className="text-xs font-mono text-muted-foreground">
                #{index + 1}
              </span>
            </div>

            {/* Message Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={msg.role === 'user' ? 'default' : 'secondary'}>
                  {msg.role}
                </Badge>
                {msg.model && (
                  <span className="text-xs text-muted-foreground">{msg.model}</span>
                )}
              </div>
              <p className="text-sm line-clamp-2">
                {typeof msg.content === 'string'
                  ? msg.content
                  : JSON.stringify(msg.content).substring(0, 100) + '...'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex-shrink-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleMoveUp(index)}
                disabled={index === 0}
                className="h-6 w-6 p-0"
                title={t('sessionBuilder.preview.actions.moveUp')}
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleMoveDown(index)}
                disabled={index === messages.length - 1}
                className="h-6 w-6 p-0"
                title={t('sessionBuilder.preview.actions.moveDown')}
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemove(msg.id)}
                className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                title={t('sessionBuilder.preview.actions.remove')}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Help Text */}
      <div className="text-xs text-muted-foreground italic">
        {t('sessionBuilder.preview.helpText')}
      </div>
    </div>
  );
};
