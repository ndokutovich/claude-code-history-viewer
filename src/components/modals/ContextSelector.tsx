import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Download } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { UIMessage, UISession, UIProject } from '@/types';

interface ContextSelectorProps {
  onSelectMessages: (messages: UIMessage[]) => void;
}

export const ContextSelector: React.FC<ContextSelectorProps> = ({ onSelectMessages }) => {
  const projects = useAppStore((state) => state.projects);
  const loadProjectSessions = useAppStore((state) => state.loadProjectSessions);
  const selectSession = useAppStore((state) => state.selectSession);
  const messages = useAppStore((state) => state.messages);

  const [selectedProject, setSelectedProject] = useState<UIProject | null>(null);
  const [sessions, setSessions] = useState<UISession[]>([]);
  const [selectedSession, setSelectedSession] = useState<UISession | null>(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
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

  const handleToggleMessage = useCallback((messageId: string) => {
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

  const handleSelectAll = useCallback(() => {
    const allIds = new Set(messages.map((msg) => msg.uuid));
    setSelectedMessageIds(allIds);
  }, [messages]);

  const handleDeselectAll = useCallback(() => {
    setSelectedMessageIds(new Set());
  }, []);

  const handleImport = useCallback(() => {
    const selected = messages.filter((msg) => selectedMessageIds.has(msg.uuid));
    onSelectMessages(selected);
    // Reset state
    setSelectedMessageIds(new Set());
  }, [messages, selectedMessageIds, onSelectMessages]);

  // Filter messages by search query
  const filteredMessages = messages.filter((msg) => {
    if (!searchQuery) return true;
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="space-y-4">
      {/* Project Selector */}
      <div className="space-y-2">
        <Label htmlFor="context-project">Select Project</Label>
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
          <option value="">-- Select a project --</option>
          {projects.map((project) => (
            <option key={project.path} value={project.path}>
              {project.name} ({project.session_count} sessions)
            </option>
          ))}
        </select>
      </div>

      {/* Session Selector */}
      {selectedProject && (
        <div className="space-y-2">
          <Label htmlFor="context-session">Select Session</Label>
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
            <option value="">-- Select a session --</option>
            {sessions.map((session) => (
              <option key={session.session_id} value={session.session_id}>
                {session.summary || session.session_id.substring(0, 8)} ({session.message_count}{' '}
                messages)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Message Selector */}
      {selectedSession && messages.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>
              Select Messages ({selectedMessageIds.size} of {filteredMessages.length} selected)
            </Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSelectAll}
              >
                Select All
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDeselectAll}
              >
                Deselect All
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Message List */}
          <div className="h-64 border rounded-md overflow-y-auto">
            <div className="p-2 space-y-2">
              {filteredMessages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No messages found
                </div>
              ) : (
                filteredMessages.map((msg) => (
                  <div
                    key={msg.uuid}
                    className="flex items-start gap-3 p-3 border rounded-md hover:bg-accent/50 cursor-pointer"
                    onClick={() => handleToggleMessage(msg.uuid)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMessageIds.has(msg.uuid)}
                      onChange={() => handleToggleMessage(msg.uuid)}
                      onClick={(e: React.MouseEvent<HTMLInputElement>) => e.stopPropagation()}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
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

          {/* Import Button */}
          <Button
            type="button"
            onClick={handleImport}
            disabled={selectedMessageIds.size === 0}
            className="w-full"
          >
            <Download className="h-4 w-4 mr-2" />
            Import {selectedMessageIds.size} Message{selectedMessageIds.size !== 1 ? 's' : ''}
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!selectedProject && (
        <div className="text-center py-8 text-muted-foreground">
          Select a project to browse its sessions and messages
        </div>
      )}
    </div>
  );
};
