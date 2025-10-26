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
import { ValidationErrors } from '@/components/ui/ValidationErrors';
import { FolderOpen, Plus, Save, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { useSourceStore } from '@/store/useSourceStore';
import {
  getAllSourcesWithCapabilities,
  getWritableSources,
  getWriteDisabledMessage,
  type SourceWithCapability,
} from '@/adapters/utils/capabilityHelpers';
import { type MessageBuilder, type UIMessage } from '@/types';
import { adapterRegistry } from '@/adapters/registry/AdapterRegistry';
import { open } from '@tauri-apps/plugin-dialog';
import { validateSessionBuilder } from '@/utils/sessionValidation';
import { convertUIMessagesToBuilders } from '@/utils/messageTransform';
import { MessageComposer } from './MessageComposer';
import { ContextSelectorEnhanced } from './ContextSelectorEnhanced';
import { SessionPreview } from './SessionPreview';

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
  const { t } = useTranslation("common");

  // Store state
  const projects = useAppStore((state) => state.projects);

  // Sources with capability metadata (SINGLE POINT OF TRUTH!)
  const allSources = useSourceStore((state) => state.sources);
  const sourcesWithCapabilities = React.useMemo(() => {
    return getAllSourcesWithCapabilities(allSources);
  }, [allSources]);

  // Get writable sources using SSOT helper
  const writableSources = React.useMemo(() => {
    return getWritableSources(allSources);
  }, [allSources]);

  const hasWritableSources = writableSources.length > 0;

  // Source selection state (Step 1 - NEW!)
  const [selectedSource, setSelectedSource] = useState<SourceWithCapability | null>(() => {
    const enrichedWritable = sourcesWithCapabilities.filter((s) => s.canWrite);
    if (enrichedWritable.length === 1) {
      return enrichedWritable[0] || null;
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
  const [activeTab, setActiveTab] = useState<'compose' | 'context' | 'preview'>('compose');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Handlers
  const handleBrowseFolder = useCallback(async (): Promise<void> => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('sessionBuilder.source.selectFolderDialog'),
      });

      if (selected && typeof selected === 'string') {
        setCustomParentPath(selected);
      }
    } catch (error) {
      console.error('Failed to open folder dialog:', error);
    }
  }, []);

  const handleAddMessage = useCallback((): void => {
    const newMessage: MessageBuilder = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: '',
      isExpanded: true,
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  const handleUpdateMessage = useCallback((id: string, updates: Partial<MessageBuilder>): void => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
    );
  }, []);

  const handleRemoveMessage = useCallback((id: string): void => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  }, []);

  const handleReorderMessages = useCallback((reorderedMessages: MessageBuilder[]): void => {
    setMessages(reorderedMessages);
  }, []);

  const resetForm = useCallback((): void => {
    setProjectMode('new');
    setSelectedProjectPath('');
    setNewProjectName('');
    setCustomParentPath('');
    setSessionSummary('');
    setMessages([]);
    setValidationErrors([]);
    setActiveTab('compose');
  }, []);

  const handleSourceChange = useCallback((sourceId: string): void => {
    const source = sourcesWithCapabilities.find((s) => s.id === sourceId);
    // Only allow selecting writable sources
    if (source?.canWrite) {
      setSelectedSource(source);
      // Reset project selection when source changes
      setSelectedProjectPath('');
      setNewProjectName('');
    }
  }, [sourcesWithCapabilities]);

  const handleImportMessages = useCallback((selectedMessages: UIMessage[]): void => {
    const newMessages = convertUIMessagesToBuilders(selectedMessages);
    setMessages((prev) => [...prev, ...newMessages]);
    setActiveTab('preview');
  }, []);

  const validateInputs = useCallback((): boolean => {
    const result = validateSessionBuilder({
      selectedSource,
      projectMode,
      selectedProjectPath,
      newProjectName,
      messages,
      t,
    });

    setValidationErrors(result.errors);
    return result.isValid;
  }, [selectedSource, projectMode, selectedProjectPath, newProjectName, messages, t]);

  const handleSave = useCallback(async (): Promise<void> => {
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

  const handleClose = useCallback((): void => {
    if (!isSaving) {
      onClose();
      resetForm();
    }
  }, [isSaving, onClose, resetForm]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('sessionBuilder.modal.title')}</DialogTitle>
          <DialogDescription>
            {t('sessionBuilder.modal.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-4">
          <div className="space-y-6">
            {/* Source Selection - NEW! Step 1 */}
            <div className="space-y-2">
              <Label htmlFor="source-select" className="text-base font-semibold">
                {t('sessionBuilder.source.label')}
              </Label>
              {!hasWritableSources ? (
                <div className="p-4 bg-destructive/10 border border-destructive rounded-md">
                  <p className="text-sm text-destructive font-semibold mb-1">
                    {t('sessionBuilder.source.noWritableSources')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('sessionBuilder.source.noWritableSourcesHint')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <select
                    id="source-select"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={selectedSource?.id || ''}
                    onChange={(e) => handleSourceChange(e.target.value)}
                  >
                    <option value="">{t('sessionBuilder.source.selectSource')}</option>
                    {sourcesWithCapabilities.map((source) => (
                      <option
                        key={source.id}
                        value={source.id}
                        disabled={!source.canWrite}
                        className={!source.canWrite ? 'text-muted-foreground' : ''}
                      >
                        {source.name} ({source.providerId})
                        {!source.canWrite ? t('sessionBuilder.source.readOnly') : t('sessionBuilder.source.writable')}
                      </option>
                    ))}
                  </select>

                  {/* Show why a source is disabled */}
                  {sourcesWithCapabilities.some((s) => !s.canWrite) && (
                    <div className="text-xs text-muted-foreground italic">
                      {t('sessionBuilder.source.readOnlyHint')}
                      {sourcesWithCapabilities.find((s) => s.providerId === 'cursor' && !s.canWrite) && (
                        <span className="block mt-1">
                          {t('sessionBuilder.source.cursorPrefix')}{getWriteDisabledMessage(
                            sourcesWithCapabilities.find((s) => s.providerId === 'cursor')!,
                            t
                          )}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Project Selection - Step 2 */}
            {selectedSource && (
              <div className="space-y-4">
                <Label className="text-base font-semibold">{t('sessionBuilder.project.label')}</Label>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={projectMode === 'existing' ? 'default' : 'outline'}
                    onClick={() => setProjectMode('existing')}
                    className="flex-1"
                  >
                    {t('sessionBuilder.project.existingProject')}
                  </Button>
                  <Button
                    type="button"
                    variant={projectMode === 'new' ? 'default' : 'outline'}
                    onClick={() => setProjectMode('new')}
                    className="flex-1"
                  >
                    {t('sessionBuilder.project.newProject')}
                  </Button>
                </div>

                {projectMode === 'existing' && (
                  <div className="space-y-2">
                  <Label htmlFor="project-select">{t('sessionBuilder.project.selectProject')}</Label>
                  <select
                    id="project-select"
                    className="w-full px-3 py-2 border rounded-md bg-background"
                    value={selectedProjectPath}
                    onChange={(e) => setSelectedProjectPath(e.target.value)}
                  >
                    <option value="">{t('sessionBuilder.project.selectProjectOption')}</option>
                    {projects.map((project) => (
                      <option key={project.path} value={project.path}>
                        {project.name} ({project.session_count}{t('sessionBuilder.project.sessionsCount')})
                      </option>
                    ))}
                  </select>
                  </div>
                )}

                {projectMode === 'new' && (
                  <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="project-name">{t('sessionBuilder.project.projectName')}</Label>
                    <Input
                      id="project-name"
                      placeholder={t('sessionBuilder.project.projectNamePlaceholder')}
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="parent-path">
                      {t('sessionBuilder.project.parentFolder')}
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        id="parent-path"
                        placeholder={t('sessionBuilder.project.parentFolderPlaceholder')}
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
              <Label htmlFor="summary">{t('sessionBuilder.session.summaryLabel')}</Label>
              <Input
                id="summary"
                placeholder={t('sessionBuilder.session.summaryPlaceholder')}
                value={sessionSummary}
                onChange={(e) => setSessionSummary(e.target.value)}
              />
              </div>
            )}

            {/* Messages - Step 4 */}
            {selectedSource && (
              <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">{t('sessionBuilder.messages.label')}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddMessage}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('sessionBuilder.messages.addMessage')}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant={activeTab === 'compose' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('compose')}
                  >
                    {t('sessionBuilder.messages.compose')}
                  </Button>
                  <Button
                    type="button"
                    variant={activeTab === 'context' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('context')}
                  >
                    {t('sessionBuilder.messages.fromExisting')}
                  </Button>
                  <Button
                    type="button"
                    variant={activeTab === 'preview' ? 'default' : 'outline'}
                    onClick={() => setActiveTab('preview')}
                  >
                    {t('sessionBuilder.messages.preview')}({messages.length}){t('sessionBuilder.messages.previewSuffix')}
                  </Button>
                </div>

                {activeTab === 'compose' && (
                  <div className="space-y-3 mt-4">
                  {messages.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {t('sessionBuilder.messages.noMessages')}
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
                  <ContextSelectorEnhanced
                    onSelectMessages={handleImportMessages}
                  />
                  </div>
                )}

                {activeTab === 'preview' && (
                  <div className="mt-4">
                    <SessionPreview
                      messages={messages}
                      onReorder={handleReorderMessages}
                      onRemove={handleRemoveMessage}
                    />
                  </div>
                )}
              </div>
              </div>
            )}

            {/* Validation Errors */}
            <ValidationErrors
              errors={validationErrors}
              title={t('sessionBuilder.validation.errorHeader')}
              className="mb-4"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            <X className="h-4 w-4 mr-2" />
            {t('sessionBuilder.modal.cancel')}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? t('sessionBuilder.modal.creating') : t('sessionBuilder.modal.createSession')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
