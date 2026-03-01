// Keyboard navigation utilities for ARIA tree widgets.
// Ported from upstream src/components/ProjectTree/treeKeyboard.ts

export type TreeNavigationKey = "ArrowDown" | "ArrowUp" | "Home" | "End";

export interface TreeItemAnnouncementLabels {
  collapsed: string;
  expanded: string;
  selected: string;
}

/**
 * Returns the next focused item index given a navigation key.
 * Clamps at the boundaries (no wrap-around) to match WAI-ARIA tree pattern.
 */
export function getNextTreeItemIndex(
  currentIndex: number,
  itemCount: number,
  key: TreeNavigationKey
): number {
  if (itemCount <= 0) {
    return -1;
  }

  switch (key) {
    case "ArrowDown":
      return Math.min(currentIndex + 1, itemCount - 1);
    case "ArrowUp":
      return Math.max(currentIndex - 1, 0);
    case "Home":
      return 0;
    case "End":
      return itemCount - 1;
    default:
      return currentIndex;
  }
}

/**
 * Normalises a label string for typeahead matching
 * (trim + lowercase).
 */
export function normalizeTypeaheadLabel(label: string): string {
  return label.trim().toLowerCase();
}

/**
 * Finds the next tree item whose text content starts with `query`,
 * starting the search one position after `currentIndex` and wrapping
 * around to the beginning if necessary.
 *
 * Returns -1 when no match is found.
 */
export function findTypeaheadMatchIndex(
  labels: string[],
  currentIndex: number,
  query: string
): number {
  if (labels.length === 0 || !query.trim()) {
    return -1;
  }

  const normalizedQuery = normalizeTypeaheadLabel(query);
  const normalizedLabels = labels.map(normalizeTypeaheadLabel);

  for (let offset = 1; offset <= normalizedLabels.length; offset += 1) {
    const index = (currentIndex + offset) % normalizedLabels.length;
    if (normalizedLabels[index]?.startsWith(normalizedQuery)) {
      return index;
    }
  }

  return -1;
}

/**
 * Builds a screen-reader announcement string for a tree item,
 * appending state descriptors (expanded/collapsed, selected) when present.
 */
export function buildTreeItemAnnouncement(
  rawLabel: string,
  state: {
    ariaExpanded?: "true" | "false" | null;
    ariaSelected?: "true" | "false" | null;
  },
  labels: TreeItemAnnouncementLabels,
  fallbackLabel: string
): string {
  const normalizedLabel = rawLabel.replace(/\s+/g, " ").trim() || fallbackLabel;
  const descriptors: string[] = [];

  if (state.ariaExpanded === "true") {
    descriptors.push(labels.expanded);
  } else if (state.ariaExpanded === "false") {
    descriptors.push(labels.collapsed);
  }

  if (state.ariaSelected === "true") {
    descriptors.push(labels.selected);
  }

  return descriptors.length > 0
    ? `${normalizedLabel}, ${descriptors.join(", ")}`
    : normalizedLabel;
}
