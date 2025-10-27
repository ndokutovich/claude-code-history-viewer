// ============================================================================
// UNIFIED FILE ACTIONS (v1.6.1)
// ============================================================================
// Provides unified "Open File" and "Open Folder" functionality across the app
// Uses tauri-plugin-opener for cross-platform file/folder opening

import { openPath } from '@tauri-apps/plugin-opener';
import { dirname } from '@tauri-apps/api/path';
import { toast } from 'sonner';

export interface FileActionOptions {
  /** Internationalization function */
  t: (key: string, options?: Record<string, any>) => string;
}

/**
 * Opens a file with its associated application
 * Cross-platform: Uses system default application for the file type
 *
 * @param filePath - Absolute path to the file
 * @param options - Configuration options
 */
export async function openFile(filePath: string, options: FileActionOptions): Promise<void> {
  const { t } = options;

  try {
    await openPath(filePath);
    toast.success(t('fileActions.openedFile'), {
      description: filePath,
      duration: 3000,
    });
  } catch (error) {
    console.error('Failed to open file:', error);
    toast.error(t('fileActions.failedToOpenFile'), {
      description: error instanceof Error ? error.message : String(error),
      duration: 5000,
    });
    throw error;
  }
}

/**
 * Opens the folder containing a file
 * Shows the file's parent directory in the system file explorer
 *
 * @param filePath - Absolute path to the file (folder will be extracted)
 * @param options - Configuration options
 */
export async function openFolder(filePath: string, options: FileActionOptions): Promise<void> {
  const { t } = options;

  try {
    const folderPath = await dirname(filePath);
    await openPath(folderPath);
    toast.success(t('fileActions.openedFolder'), {
      description: folderPath,
      duration: 3000,
    });
  } catch (error) {
    console.error('Failed to open folder:', error);
    toast.error(t('fileActions.failedToOpenFolder'), {
      description: error instanceof Error ? error.message : String(error),
      duration: 5000,
    });
    throw error;
  }
}

/**
 * Creates unified file action buttons for toast notifications
 * Returns action objects compatible with sonner toast
 *
 * @param filePath - Absolute path to the file
 * @param options - Configuration options
 */
export function createFileActions(filePath: string, options: FileActionOptions) {
  const { t } = options;

  return {
    openFile: {
      label: t('fileActions.openFile'),
      onClick: () => openFile(filePath, options),
    },
    openFolder: {
      label: t('fileActions.openFolder'),
      onClick: () => openFolder(filePath, options),
    },
  };
}
