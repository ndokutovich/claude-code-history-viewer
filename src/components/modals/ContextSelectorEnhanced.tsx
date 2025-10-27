import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import type { UIMessage, UISession, UIProject } from '@/types';

interface ContextSelectorProps {
  onSelectMessages: (messages: UIMessage[]) => void;
}

type SelectionMode = 'individual' | 'range' | 'all';

interface SessionContext {
  sessionId: string;
  sessionName: string;
  projectName: string;
  messages: UIMessage[];
}

export const ContextSelectorEnhanced: React.FC<ContextSelectorProps> = ({ onSelectMessages }) => {
  const { t } = useTranslation("common");
  const projects = useAppStore((state) => state.projects);
  const loadProjectSessions = useAppStore((state) => state.loadProjectSessions);
  const selectSession = useAppStore((state) => state.selectSession);
  const messages = useAppStore((state) => state.messages);

  // Multi-session state
  const [accumulatedContexts, setAccumulatedContexts] = useState<SessionContext[]>([]);

  // Current session selection
  const [selectedProject, setSelectedProject] = useState<UIProject | null>(null);
  const [sessions, setSessions] = useState<UISession[]>([]);
  const [selectedSession, setSelectedSession] = useState<UISession | null>(null);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('individual');
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Load sessions when project is selected
  useEffect(() => {
    if (selectedProject) {
      loadProjectSessions(selectedProject.path)
        .then((loadedSessions) => {
          setSessions(loadedSessions);
        })
        .catch((error) => {
          console.error('Failed to load sessions:', error);
          setSessions([]);
        });
    } else {
      setSessions([]);
      setSelectedSession(null);
    }
  }, [selectedProject, loadProjectSessions]);

  // Load messages when session is selected
  useEffect(() => {
    if (selectedSession) {
      selectSession(selectedSession).catch((error) => {
        console.error('Failed to load session messages:', error);
      });
    }
  }, [selectedSession, selectSession]);

  // Handle selection mode change
  useEffect(() => {
    setSelectedMessageIds(new Set());

    if (selectionMode === 'all') {
      const allIds = new Set(messages.map((msg) => msg.uuid));
      setSelectedMessageIds(allIds);
    } else if (selectionMode === 'range' && messages.length > 0) {
      const start = Math.max(1, rangeStart);
      const end = Math.min(messages.length, rangeEnd);
      const rangeIds = new Set(
        messages.slice(start - 1, end).map((msg) => msg.uuid)
      );
      setSelectedMessageIds(rangeIds);
    }
  }, [selectionMode, rangeStart, rangeEnd, messages]);

  const handleToggleMessage = useCallback((messageId: string): void => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback((): void => {
    const allIds = new Set(messages.map((msg) => msg.uuid));
    setSelectedMessageIds(allIds);
  }, [messages]);

  const handleDeselectAll = useCallback((): void => {
    setSelectedMessageIds(new Set());
  }, []);

  // Add to accumulated context (NEW!)
  const handleAddToContext = useCallback((): void => {
    if (!selectedSession) return;

    const selected = messages.filter((msg) => selectedMessageIds.has(msg.uuid));

    if (selected.length === 0) return;

    const newContext: SessionContext = {
      sessionId: selectedSession.session_id,
      sessionName: selectedSession.summary || `Session ${selectedSession.session_id.substring(0, 8)}`,
      projectName: selectedSession.project_name,
      messages: selected,
    };

    setAccumulatedContexts((prev) => [...prev, newContext]);
    setSelectedMessageIds(new Set());
  }, [messages, selectedMessageIds, selectedSession]);

  // Remove accumulated context
  const handleRemoveContext = useCallback((index: number): void => {
    setAccumulatedContexts((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Final import all accumulated messages
  const handleImportAll = useCallback((): void => {
    const allMessages = accumulatedContexts.flatMap((ctx) => ctx.messages);
    onSelectMessages(allMessages);

    // Reset state
    setAccumulatedContexts([]);
    setSelectedMessageIds(new Set());
  }, [accumulatedContexts, onSelectMessages]);

  // Filter messages by search query
  const filteredMessages = messages.filter((msg) => {
    if (!searchQuery) return true;
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalAccumulatedMessages = accumulatedContexts.reduce(
    (sum, ctx) => sum + ctx.messages.length,
    0
  );

  return (
    <div className="space-y-4">
      {/* Accumulated Context Summary */}
      {accumulatedContexts.length > 0 && (
        <div className="p-4 bg-accent/30 border border-accent rounded-md">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">
              {t('sessionBuilder.contextSelector.accumulated.title')}{totalAccumulatedMessages}{t('sessionBuilder.contextSelector.accumulated.messagesFrom')}{accumulatedContexts.length}{t('sessionBuilder.contextSelector.accumulated.session')}{accumulatedContexts.length !== 1 ? t('sessionBuilder.contextSelector.accumulated.sessions') : ''})
            </h3>
            <Button
              type="button"
              onClick={handleImportAll}
              size="sm"
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {t('sessionBuilder.contextSelector.accumulated.importAll')}
            </Button>
          </div>

          <div className="space-y-2">
            {accumulatedContexts.map((ctx, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-background rounded">
                <div className="flex-1">
                  <Badge variant="outline" className="mr-2">{ctx.projectName}</Badge>
                  <span className="text-sm">{ctx.sessionName}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({ctx.messages.length}{t('sessionBuilder.contextSelector.accumulated.messagesSuffix')})
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveContext(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project Selector */}
      <div className="space-y-2">
        <Label htmlFor="context-project">{t('sessionBuilder.contextSelector.project.label')}</Label>
        <select
          id="context-project"
          className="w-full px-3 py-2 border rounded-md bg-background"
          value={selectedProject?.path || ''}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            const project = projects.find((p) => p.path === e.target.value);
            setSelectedProject(project || null);
            setSelectedSession(null);
            setSelectedMessageIds(new Set());
          }}
        >
          <option value="">{t('sessionBuilder.contextSelector.project.selectOption')}</option>
          {projects.map((project) => (
            <option key={project.path} value={project.path}>
              {project.name} ({project.session_count}{t('sessionBuilder.contextSelector.project.sessionsCount')})
            </option>
          ))}
        </select>
      </div>

      {/* Session Selector */}
      {selectedProject && (
        <div className="space-y-2">
          <Label htmlFor="context-session">{t('sessionBuilder.contextSelector.session.label')}</Label>
          <select
            id="context-session"
            className="w-full px-3 py-2 border rounded-md bg-background"
            value={selectedSession?.session_id || ''}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
              const session = sessions.find((s) => s.session_id === e.target.value);
              setSelectedSession(session || null);
              setSelectedMessageIds(new Set());
            }}
          >
            <option value="">{t('sessionBuilder.contextSelector.session.selectOption')}</option>
            {sessions.map((session) => (
              <option key={session.session_id} value={session.session_id}>
                {session.summary || t('sessionBuilder.contextSelector.session.defaultName') + session.session_id.substring(0, 8)} ({session.message_count}{t('sessionBuilder.contextSelector.session.messagesCount')})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Message Selector */}
      {selectedSession && messages.length > 0 && (
        <div className="space-y-3">
          {/* Selection Mode */}
          <div className="space-y-2">
            <Label>{t('sessionBuilder.contextSelector.selectionMode.label')}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={selectionMode === 'individual' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectionMode('individual')}
                className="flex-1"
              >
                {t('sessionBuilder.contextSelector.selectionMode.individual')}
              </Button>
              <Button
                type="button"
                variant={selectionMode === 'range' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectionMode('range')}
                className="flex-1"
              >
                {t('sessionBuilder.contextSelector.selectionMode.range')}
              </Button>
              <Button
                type="button"
                variant={selectionMode === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectionMode('all')}
                className="flex-1"
              >
                {t('sessionBuilder.contextSelector.selectionMode.all')}
              </Button>
            </div>
          </div>

          {/* Range Inputs */}
          {selectionMode === 'range' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="range-start" className="text-xs">{t('sessionBuilder.contextSelector.range.from')}</Label>
                <Input
                  id="range-start"
                  type="number"
                  min={1}
                  max={messages.length}
                  value={rangeStart}
                  onChange={(e) => setRangeStart(parseInt(e.target.value) || 1)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="range-end" className="text-xs">{t('sessionBuilder.contextSelector.range.to')}</Label>
                <Input
                  id="range-end"
                  type="number"
                  min={1}
                  max={messages.length}
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(parseInt(e.target.value) || messages.length)}
                  className="text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label>
              {t('sessionBuilder.contextSelector.messageList.label')}({selectedMessageIds.size}{t('sessionBuilder.contextSelector.messageList.of')}{filteredMessages.length}{t('sessionBuilder.contextSelector.messageList.selected')}
            </Label>
            {selectionMode === 'individual' && (
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={handleSelectAll}>
                  {t('sessionBuilder.contextSelector.messageList.selectAll')}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={handleDeselectAll}>
                  {t('sessionBuilder.contextSelector.messageList.deselectAll')}
                </Button>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('sessionBuilder.contextSelector.messageList.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Message List */}
          <div className="h-64 border rounded-md overflow-y-auto">
            <div className="p-2 space-y-2">
              {filteredMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">{t('sessionBuilder.contextSelector.messageList.noMessages')}</div>
              ) : (
                filteredMessages.map((msg, index) => (
                  <div
                    key={msg.uuid}
                    className="flex items-start gap-3 p-3 border rounded-md hover:bg-accent/50 cursor-pointer"
                    onClick={() => selectionMode === 'individual' && handleToggleMessage(msg.uuid)}
                  >
                    {selectionMode === 'individual' && (
                      <input
                        type="checkbox"
                        checked={selectedMessageIds.has(msg.uuid)}
                        onChange={() => handleToggleMessage(msg.uuid)}
                        onClick={(e: React.MouseEvent<HTMLInputElement>) => e.stopPropagation()}
                        className="mt-1"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">#{index + 1}</span>
                        <Badge variant={msg.type === 'user' ? 'default' : 'secondary'}>
                          {msg.type}
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
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Add to Context Button */}
          <Button
            type="button"
            onClick={handleAddToContext}
            disabled={selectedMessageIds.size === 0}
            className="w-full gap-2"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            {t('sessionBuilder.contextSelector.actions.addPrefix')}{selectedMessageIds.size}{t('sessionBuilder.contextSelector.actions.message')}{selectedMessageIds.size !== 1 ? t('sessionBuilder.contextSelector.actions.messagePlural') : ''}{t('sessionBuilder.contextSelector.actions.toContext')}
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!selectedProject && (
        <div className="text-center py-8 text-muted-foreground">
          {t('sessionBuilder.contextSelector.emptyState')}
        </div>
      )}
    </div>
  );
};
