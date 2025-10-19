// ============================================================================
// SOURCE MANAGER COMPONENT (v2.0.0)
// ============================================================================
// UI for managing multiple conversation data sources

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSourceStore } from '../store/useSourceStore';
import type { UniversalSource, HealthStatus } from '../types/universal';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { Badge } from './ui/badge';
import {
  FolderOpen,
  Plus,
  Trash2,
  Star,
  StarOff,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';

export const SourceManager: React.FC = () => {
  const { t, i18n } = useTranslation('sourceManager');

  // DEBUG: Log translation info
  console.log('🔍 SourceManager Translation Debug:');
  console.log('  Current language:', i18n.language);
  console.log('  Available namespaces:', i18n.options.ns);
  console.log('  Test translation t("title"):', t('title'));
  console.log('  Test translation t("description"):', t('description'));
  console.log('  Raw resources:', i18n.getResourceBundle(i18n.language, 'sourceManager'));

  const {
    sources,
    selectedSourceId,
    isLoadingSources,
    isAddingSource,
    isValidatingSource,
    error,
    initializeSources,
    addSource,
    removeSource,
    setDefaultSource,
    refreshSource,
    refreshAllSources,
    selectSource,
    validatePath,
    clearErrors,
  } = useSourceStore();

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSourcePath, setNewSourcePath] = useState('');
  const [newSourceName, setNewSourceName] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Initialize sources on mount
  useEffect(() => {
    initializeSources();
  }, [initializeSources]);

  // Handle add source
  const handleAddSource = async () => {
    clearErrors();
    setValidationError(null);

    if (!newSourcePath.trim()) {
      setValidationError(t('validation.enterPath'));
      return;
    }

    try {
      // Validate path
      const validation = await validatePath(newSourcePath);

      if (!validation.isValid) {
        setValidationError(validation.error || t('validation.invalidPath'));
        return;
      }

      // Add source
      await addSource(newSourcePath, newSourceName.trim() || undefined);

      // Reset form and close dialog
      setNewSourcePath('');
      setNewSourceName('');
      setIsAddDialogOpen(false);
    } catch (err) {
      setValidationError((err as Error).message);
    }
  };

  // Handle browse for folder
  const handleBrowseFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('dialog.selectFolder'),
      });

      if (selected && typeof selected === 'string') {
        setNewSourcePath(selected);
      }
    } catch (err) {
      console.error('Failed to open folder browser:', err);
    }
  };

  // Handle remove source
  const handleRemoveSource = async (sourceId: string) => {
    if (confirm(t('dialog.confirmRemove'))) {
      try {
        await removeSource(sourceId);
      } catch (err) {
        // Error handled in store
        console.error('Failed to remove source:', err);
      }
    }
  };

  // Handle set default
  const handleSetDefault = async (sourceId: string) => {
    try {
      await setDefaultSource(sourceId);
    } catch (err) {
      console.error('Failed to set default source:', err);
    }
  };

  // Render health status icon
  const renderHealthIcon = (status: HealthStatus) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'offline':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  // Render provider badge
  const renderProviderBadge = (providerId: string) => {
    const colors: Record<string, string> = {
      'claude-code': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
      'cursor': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'copilot': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    };

    const colorClass = colors[providerId] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';

    return (
      <Badge variant="secondary" className={`text-xs ${colorClass}`}>
        {providerId}
      </Badge>
    );
  };

  if (isLoadingSources) {
    return (
      <div className="p-4 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>{t('loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refreshAllSources()}
            disabled={isLoadingSources}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            {t('refreshAll')}
          </Button>
          <Button
            size="sm"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('addSource')}
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Source List */}
      <div className="space-y-2">
        {sources.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>{t('emptyState.title')}</p>
            <p className="text-sm">{t('emptyState.description')}</p>
          </div>
        ) : (
          sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              isSelected={source.id === selectedSourceId}
              onSelect={() => selectSource(source.id)}
              onSetDefault={() => handleSetDefault(source.id)}
              onRemove={() => handleRemoveSource(source.id)}
              onRefresh={() => refreshSource(source.id)}
              renderHealthIcon={renderHealthIcon}
              renderProviderBadge={renderProviderBadge}
            />
          ))
        )}
      </div>

      {/* Add Source Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('dialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name Field */}
            <div className="space-y-2">
              <Label htmlFor="source-name">{t('dialog.nameLabel')}</Label>
              <Input
                id="source-name"
                placeholder={t('dialog.namePlaceholder')}
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
              />
            </div>

            {/* Path Field */}
            <div className="space-y-2">
              <Label htmlFor="source-path">{t('dialog.pathLabel')}</Label>
              <div className="flex gap-2">
                <Input
                  id="source-path"
                  placeholder={t('dialog.pathPlaceholder')}
                  value={newSourcePath}
                  onChange={(e) => setNewSourcePath(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBrowseFolder}
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Validation Error */}
            {validationError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{validationError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setNewSourcePath('');
                setNewSourceName('');
                setValidationError(null);
              }}
            >
              {t('dialog.cancel')}
            </Button>
            <Button
              onClick={handleAddSource}
              disabled={isAddingSource || isValidatingSource}
            >
              {isAddingSource || isValidatingSource ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  {t('dialog.adding')}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('dialog.add')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============================================================================
// SOURCE CARD COMPONENT
// ============================================================================

interface SourceCardProps {
  source: UniversalSource;
  isSelected: boolean;
  onSelect: () => void;
  onSetDefault: () => void;
  onRemove: () => void;
  onRefresh: () => void;
  renderHealthIcon: (status: HealthStatus) => React.ReactNode;
  renderProviderBadge: (providerId: string) => React.ReactNode;
}

const SourceCard: React.FC<SourceCardProps> = ({
  source,
  isSelected,
  onSelect,
  onSetDefault,
  onRemove,
  onRefresh,
  renderHealthIcon,
  renderProviderBadge,
}) => {
  const { t } = useTranslation('sourceManager');
  return (
    <div
      className={`
        p-4 border rounded-lg cursor-pointer transition-colors
        ${isSelected ? 'border-primary bg-accent' : 'border-border hover:bg-accent/50'}
      `}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium truncate">{source.name}</h3>
            {source.isDefault && (
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
            )}
            {renderHealthIcon(source.healthStatus)}
            {renderProviderBadge(source.providerId)}
          </div>

          {/* Path */}
          <p className="text-xs text-muted-foreground truncate mb-2">
            {source.path}
          </p>

          {/* Stats */}
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>{source.stats.projectCount} {t('stats.projects')}</span>
            <span>{source.stats.sessionCount} {t('stats.sessions')}</span>
            <span>{source.stats.messageCount.toLocaleString()} {t('stats.messages')}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            title={t('actions.refresh')}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          {!source.isDefault && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSetDefault();
              }}
              title={t('actions.setDefault')}
            >
              <StarOff className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title={t('actions.remove')}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
