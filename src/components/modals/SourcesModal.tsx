// ============================================================================
// SOURCES MODAL (v2.0.0)
// ============================================================================
// Modal dialog for managing data sources

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { SourceManager } from '../SourceManager';

interface SourcesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SourcesModal: React.FC<SourcesModalProps> = ({ open, onOpenChange }) => {
  const { t } = useTranslation('sourceManager');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          <SourceManager />
        </div>
      </DialogContent>
    </Dialog>
  );
};
