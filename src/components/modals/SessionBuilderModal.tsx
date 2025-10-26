import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FolderOpen, Plus, Save, X } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useSourceStore } from '@/store/useSourceStore';
import { adapterRegistry } from '@/adapters/registry/AdapterRegistry';
import {
  type MessageBuilder,
  type UniversalSource,
} from '@/types';
import { open } from '@tauri-apps/plugin-dialog';
import { MessageComposer } from './MessageComposer';
import { ContextSelector } from './ContextSelector';

interface SessionBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultProjectPath?: string;
}

export const SessionBuilderModal: React.FC<SessionBuilderModalProps> = ({
  isOpen,
  onClose,
  defaultProjectPath,
}) => {
  // Store state
  const projects = useAppStore((state) => state.projects);

  // Sources (filtered to writable only)
  const allSources = useSourceStore((state) => state.sources);
  const writableSources = React.useMemo(() => {
    return allSources.filter((source) => {
      if (!source.isAvailable) return false;
      const adapter = adapterRegistry.tryGet(source.providerId);
      if (!adapter) return false;
      return adapter.providerDefinition.capabilities.supportsSessionCreation === true;
    });
  }, [allSources]);

  // Source selection state (Step 1 - NEW!)
  const [selectedSource, setSelectedSource] = useState<UniversalSource | null>(() => {
    if (writableSources.length === 1) {
      return writableSources[0] || null;
    }
    return null;
  });

  // Project selection state
  const [projectMode, setProjectMode] = useState<'existing' | 'new'>(
    defaultProjectPath ? 'existing' : 'new'
  );
  const [selectedProjectPath, setSelectedProjectPath] = useState<string>(
    defaultProjectPath || ''
  );
  const [newProjectName, setNewProjectName] = useState<string>('');
  const [customParentPath, setCustomParentPath] = useState<string>('');

  // Session state
  const [sessionSummary, setSessionSummary] = useState<string>('');
  const [messages, setMessages] = useState<MessageBuilder[]>([]);
  const [activeTab, setActiveTab] = useState<'compose' | 'context'>('compose');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Handlers
  const handleBrowseFolder = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Folder',
      });

      if (selected && typeof selected === 'string') {
        setCustomParentPath(selected);
      }
    } catch (error) {
      console.error('Failed to open folder dialog:', error);
    }
  }, []);

  const handleAddMessage = useCallback(() => {
    const newMessage: MessageBuilder = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: '',
      isExpanded: true,
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  const handleUpdateMessage = useCallback((id: string, updates: Partial<MessageBuilder>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
    );
  }, []);

  const handleRemoveMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  }, []);

  const resetForm = useCallback(() => {
    setProjectMode('new');
    setSelectedProjectPath('');
    setNewProjectName('');
    setCustomParentPath('');
    setSessionSummary('');
    setMessages([]);
    setValidationErrors([]);
    setActiveTab('compose');
  }, []);

  const validateInputs = useCallback((): boolean => {
    const errors: string[] = [];

    // Validate source selection (NEW!)
    if (!selectedSource) {
      errors.push('Please select a source');
    }

    // Validate project
    if (projectMode === 'existing' && !selectedProjectPath) {
      errors.push('Please select a project');
    }
    if (projectMode === 'new' && !newProjectName.trim()) {
      errors.push('Please enter a project name');
    }

    // Validate messages
    if (messages.length === 0) {
      errors.push('Please add at least one message');
    }

    // Validate message content
    messages.forEach((msg, index) => {
      if (typeof msg.content === 'string' && !msg.content.trim()) {
        errors.push(`Message ${index + 1} is empty`);
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  }, [selectedSource, projectMode, selectedProjectPath, newProjectName, messages]);

  const handleSave = useCallback(async () => {
    if (!validateInputs() || !selectedSource) {
      return;
    }

    setIsSaving(true);
    setValidationErrors([]);

    try {
      // Get the adapter for this source
      const adapter = adapterRegistry.tryGet(selectedSource.providerId);
      if (!adapter?.createProject || !adapter?.createSession) {
        throw new Error(`Provider ${selectedSource.providerId} does not support writing`);
      }

      let projectPath = selectedProjectPath;

      // Step 1: Create project if needed
      if (projectMode === 'new') {
        const createResult = await adapter.createProject(
          selectedSource.path,  // Use source path!
          newProjectName
        );

        if (!createResult.success || !createResult.data) {
          throw new Error(createResult.error?.message || 'Failed to create project');
        }

        projectPath = createResult.data.projectPath;
      }

      // Step 2: Create session using adapter
      const createResult = await adapter.createSession(projectPath, {
        messages: messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          parent_id: msg.parent_id,
          model: msg.model,
          tool_use: msg.tool_use,
          tool_use_result: msg.tool_use_result,
          usage: msg.usage,
        })),
        summary: sessionSummary || undefined,
      });

      if (!createResult.success) {
        throw new Error(createResult.error?.message || 'Failed to create session');
      }

      // Success! Refresh projects and close modal
      await useAppStore.getState().scanProjects();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Failed to save session:', error);
      setValidationErrors([
        error instanceof Error ? error.message : 'Failed to create session',
      ]);
    } finally {
      setIsSaving(false);
    }
  }, [
    validateInputs,
    selectedSource,
    projectMode,
    selectedProjectPath,
    newProjectName,
    messages,
    sessionSummary,
    onClose,
    resetForm,
  ]);

  const handleClose = useCallback(() => {
    if (!isSaving) {
      onClose();
      resetForm();
    }
  }, [isSaving, onClose, resetForm]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Session</DialogTitle>
          <DialogDescription>
            Compose a new Claude Code conversation session
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-4">
          <div className="space-y-6">
            {/* Source Selection - NEW! Step 1 */}
            <div className="space-y-2">
              <Label htmlFor="source-select" className="text-base font-semibold">
                Source
              </Label>
              {writableSources.length === 0 ? (
                <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
                  <p className="text-sm text-destructive">
                    No writable sources available. Please add a Claude Code source in Settings.
                  </p>
                </div>
              ) : (
                <select
                  id="source-select"
                  className="w-full px-3 py-2 border rounded-md bg-background"
                  value={selectedSource?.id || ''}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    const source = writableSources.find((s) => s.id === e.target.value);
                    setSelectedSource(source || null);
                  }}
                >
                  <option value="">-- Select a source --</option>
                  {writableSources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name} ({source.providerId}) - {source.path}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Project Selection - Step 2 */}
            {selectedSource && (
              <div className="space-y-4">
                <Label className="text-base font-semibold">Project</Label>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={projectMode === 'existing' ? 'default' : 'outline'}
                    onClick={() => setProjectMode('existing')}
                    className="flex-1"
                  >
                    Existing Project
                  </Button>
                  <Button
                    type="button"
                    variant={projectMode === 'new' ? 'default' : 'outline'}
                    onClick={() => setProjectMode('new')}
                    className="flex-1"
                  >
                    New Project
                  </Button>
                </div>

                {projectMode === 'existing' && (
                  <div className="space-y-2">
                  <Label htmlFor="project-select">Select Project</Label>
                  <select
                    id="project-select"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={selectedProjectPath}
                    onChange={(e) => setSelectedProjectPath(e.target.value)}
                  >
                    <option value="">-- Select a project --</option>
                    {projects.map((project) => (
                      <option key={project.path} value={project.path}>
                        {project.name} ({project.session_count} sessions)
                      </option>
                    ))}
                  </select>
                  </div>
                )}

                {projectMode === 'new' && (
                  <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input
                      id="project-name"
                      placeholder="my-project"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parent-path">
                      Parent Folder (optional, defaults to ~/.claude/projects/)
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="parent-path"
                        placeholder="~/.claude/projects/"
                        value={customParentPath}
                        onChange={(e) => setCustomParentPath(e.target.value)}
                        readOnly
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleBrowseFolder}
                      >
                        <FolderOpen className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  </div>
                )}
              </div>
              </div>
            )}

            {/* Session Summary - Step 3 */}
            {selectedSource && (
              <div className="space-y-2">
              <Label htmlFor="summary">Session Summary (optional)</Label>
              <Input
                id="summary"
                placeholder="Brief description of this conversation"
                value={sessionSummary}
                onChange={(e) => setSessionSummary(e.target.value)}
              />
              </div>
            )}

            {/* Messages - Step 4 */}
            {selectedSource && (
              <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Messages</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddMessage}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Message
                </Button>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={activeTab === 'compose' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('compose')}
                    className="flex-1"
                  >
                    Compose
                  </Button>
                  <Button
                    type="button"
                    variant={activeTab === 'context' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('context')}
                    className="flex-1"
                  >
                    From Existing
                  </Button>
                </div>

                {activeTab === 'compose' && (
                  <div className="space-y-3 mt-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No messages yet. Click "Add Message" to start.
                    </div>
                  ) : (
                    messages.map((message) => (
                      <MessageComposer
                        key={message.id}
                        message={message}
                        onUpdate={(updates) => handleUpdateMessage(message.id, updates)}
                        onRemove={() => handleRemoveMessage(message.id)}
                      />
                    ))
                  )}
                  </div>
                )}

                {activeTab === 'context' && (
                  <div className="mt-4">
                  <ContextSelector
                    onSelectMessages={(selectedMessages) => {
                      const newMessages: MessageBuilder[] = selectedMessages.map((msg) => ({
                        id: `imported-${msg.uuid}`,
                        role: msg.type,
                        content: (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)) || '',
                        parent_id: msg.parentUuid,
                        model: msg.model,
                        usage: msg.usage,
                        isExpanded: false,
                      }));
                      setMessages((prev) => [...prev, ...newMessages]);
                      setActiveTab('compose');
                    }}
                  />
                  </div>
                )}
              </div>
              </div>
            )}

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
                <p className="font-semibold text-destructive mb-2">
                  Please fix the following errors:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-destructive">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Creating...' : 'Create Session'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
