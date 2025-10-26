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
import {
  type MessageBuilder,
  type CreateProjectRequest,
  type CreateSessionRequest,
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
  // Store actions
  const createProject = useAppStore((state) => state.createProject);
  const createSession = useAppStore((state) => state.createSession);
  const projects = useAppStore((state) => state.projects);

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

  const validateInputs = useCallback((): boolean => {
    const errors: string[] = [];

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
  }, [projectMode, selectedProjectPath, newProjectName, messages]);

  const handleSave = useCallback(async () => {
    if (!validateInputs()) {
      return;
    }

    setIsSaving(true);
    setValidationErrors([]);

    try {
      let projectPath = selectedProjectPath;

      // Step 1: Create project if needed
      if (projectMode === 'new') {
        const projectRequest: CreateProjectRequest = {
          name: newProjectName,
          parent_path: customParentPath || undefined,
        };

        const projectResponse = await createProject(projectRequest);
        projectPath = projectResponse.project_path;
      }

      // Step 2: Create session
      const sessionRequest: CreateSessionRequest = {
        project_path: projectPath,
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
      };

      await createSession(sessionRequest);

      // Success! Close modal
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
    projectMode,
    selectedProjectPath,
    newProjectName,
    customParentPath,
    messages,
    sessionSummary,
    createProject,
    createSession,
    onClose,
  ]);

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
            {/* Project Selection */}
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

            {/* Session Summary */}
            <div className="space-y-2">
              <Label htmlFor="summary">Session Summary (optional)</Label>
              <Input
                id="summary"
                placeholder="Brief description of this conversation"
                value={sessionSummary}
                onChange={(e) => setSessionSummary(e.target.value)}
              />
            </div>

            {/* Messages */}
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
