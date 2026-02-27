import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Trash2, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { MessageBuilder } from '@/types';

interface MessageComposerProps {
  message: MessageBuilder;
  onUpdate: (updates: Partial<MessageBuilder>) => void;
  onRemove: () => void;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  message,
  onUpdate,
  onRemove,
}) => {
  const { t } = useTranslation("common");
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="p-4 border rounded-md space-y-3">
      <div className="flex items-start gap-3">
        {/* Role Selector */}
        <div className="flex-shrink-0 w-32">
          <select
            className="w-full px-3 py-2 border rounded-md bg-background text-sm"
            value={message.role}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onUpdate({ role: e.target.value })}
          >
            <option value="user">{t('sessionBuilder.messageComposer.roles.user')}</option>
            <option value="assistant">{t('sessionBuilder.messageComposer.roles.assistant')}</option>
            <option value="system">{t('sessionBuilder.messageComposer.roles.system')}</option>
          </select>
        </div>

        {/* Content */}
        <div className="flex-1">
          <textarea
            placeholder={t('sessionBuilder.messageComposer.contentPlaceholder')}
            value={typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onUpdate({ content: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border rounded-md bg-background resize-y text-sm"
          />
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowAdvanced(!showAdvanced)}
            title={t('sessionBuilder.messageComposer.advancedOptions')}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            title={t('sessionBuilder.messageComposer.removeMessage')}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="pt-3 border-t space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`model-${message.id}`} className="text-xs">
                {t('sessionBuilder.messageComposer.advanced.model')}
              </Label>
              <Input
                id={`model-${message.id}`}
                placeholder={t('sessionBuilder.messageComposer.advanced.modelPlaceholder')}
                value={message.model || ''}
                onChange={(e) => onUpdate({ model: e.target.value || undefined })}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`parent-${message.id}`} className="text-xs">
                {t('sessionBuilder.messageComposer.advanced.parentId')}
              </Label>
              <Input
                id={`parent-${message.id}`}
                placeholder={t('sessionBuilder.messageComposer.advanced.parentIdPlaceholder')}
                value={message.parent_id || ''}
                onChange={(e) => onUpdate({ parent_id: e.target.value || undefined })}
                className="text-sm"
              />
            </div>
          </div>

          {/* Token Usage (for assistant messages) */}
          {message.role === 'assistant' && (
            <div>
              <div className="text-sm font-medium mb-2">{t('sessionBuilder.messageComposer.advanced.tokenUsage')}</div>
              <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor={`input-tokens-${message.id}`} className="text-xs">
                      {t('sessionBuilder.messageComposer.advanced.inputTokens')}
                    </Label>
                    <Input
                      id={`input-tokens-${message.id}`}
                      type="number"
                      placeholder="0"
                      value={message.usage?.input_tokens || ''}
                      onChange={(e) =>
                        onUpdate({
                          usage: {
                            ...message.usage,
                            input_tokens: e.target.value ? parseInt(e.target.value) : undefined,
                          },
                        })
                      }
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`output-tokens-${message.id}`} className="text-xs">
                      {t('sessionBuilder.messageComposer.advanced.outputTokens')}
                    </Label>
                    <Input
                      id={`output-tokens-${message.id}`}
                      type="number"
                      placeholder="0"
                      value={message.usage?.output_tokens || ''}
                      onChange={(e) =>
                        onUpdate({
                          usage: {
                            ...message.usage,
                            output_tokens: e.target.value ? parseInt(e.target.value) : undefined,
                          },
                        })
                      }
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`cache-create-${message.id}`} className="text-xs">
                      {t('sessionBuilder.messageComposer.advanced.cacheCreation')}
                    </Label>
                    <Input
                      id={`cache-create-${message.id}`}
                      type="number"
                      placeholder="0"
                      value={message.usage?.cache_creation_input_tokens || ''}
                      onChange={(e) =>
                        onUpdate({
                          usage: {
                            ...message.usage,
                            cache_creation_input_tokens: e.target.value
                              ? parseInt(e.target.value)
                              : undefined,
                          },
                        })
                      }
                      className="text-sm"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor={`cache-read-${message.id}`} className="text-xs">
                      {t('sessionBuilder.messageComposer.advanced.cacheRead')}
                    </Label>
                    <Input
                      id={`cache-read-${message.id}`}
                      type="number"
                      placeholder="0"
                      value={message.usage?.cache_read_input_tokens || ''}
                      onChange={(e) =>
                        onUpdate({
                          usage: {
                            ...message.usage,
                            cache_read_input_tokens: e.target.value
                              ? parseInt(e.target.value)
                              : undefined,
                          },
                        })
                      }
                      className="text-sm"
                    />
                  </div>
                </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
