import { useState, useEffect, useRef } from 'react';

interface ResizableSplitterProps {
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
  onWidthChange?: (width: number) => void;
  className?: string;
}

/**
 * A vertical draggable splitter for resizing panels
 */
export const ResizableSplitter: React.FC<ResizableSplitterProps> = ({
  minWidth = 200,
  maxWidth = 800,
  onWidthChange,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const splitterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      const clampedWidth = Math.min(Math.max(newWidth, minWidth), maxWidth);
      onWidthChange?.(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, minWidth, maxWidth, onWidthChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  return (
    <>
      {/* Invisible overlay when dragging to prevent text selection */}
      {isDragging && (
        <div className="fixed inset-0 z-50 cursor-col-resize" />
      )}

      {/* Splitter handle */}
      <div
        ref={splitterRef}
        onMouseDown={handleMouseDown}
        className={`
          relative flex-shrink-0 w-1 bg-gray-300 dark:bg-gray-600
          hover:bg-blue-500 dark:hover:bg-blue-500
          cursor-col-resize group transition-colors
          ${isDragging ? 'bg-blue-500' : ''}
          ${className}
        `}
        style={{ width: '4px' }}
      >
        {/* Visual indicator on hover */}
        <div className="absolute inset-y-0 left-0 w-full opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="h-full w-full bg-blue-500/50" />
        </div>
      </div>
    </>
  );
};
