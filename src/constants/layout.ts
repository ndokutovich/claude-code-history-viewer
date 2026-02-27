/**
 * Layout and UI Constants
 *
 * This file contains magic numbers extracted from components
 * to improve maintainability and avoid hard-coded values.
 */

// Message Viewer
export const MAX_DEPTH_MARGIN = 16; // Maximum margin for nested messages (ml-${Math.min(depth * 4, MAX_DEPTH_MARGIN)})
export const SCROLL_ADJUSTMENT_DELAY = 50; // ms delay for scroll position adjustment
export const SESSION_SCROLL_DELAY = 100; // ms delay for session switch scroll
export const SCROLL_BOTTOM_THRESHOLD = 100; // px from bottom to show scroll button
export const SCROLL_THROTTLE_DELAY = 100; // ms throttle for scroll event
export const MIN_MESSAGES_FOR_SCROLL_BTN = 5; // Minimum messages to show scroll-to-bottom button

// Analytics Dashboard
export const HEATMAP_DAYS = 7; // Number of days in heatmap view
export const HOURS_PER_DAY = 24; // Hours in a day
export const HOUR_LABEL_INTERVAL = 3; // Interval for displaying hour labels (every 3 hours)
export const TOP_TOOLS_COUNT = 6; // Number of top tools to display in chart

// Token Stats Viewer
export const SESSION_ID_DISPLAY_LENGTH = 8; // Number of characters to show from session ID

// Web Search Renderer
export const MAX_URL_DISPLAY_LENGTH = 60; // Maximum characters for URL display before truncation

// File Activity Table
export const FILE_ACTIVITY_ROW_HEIGHT = 60; // Estimated row height for virtual scrolling
export const VIRTUAL_OVERSCAN = 10; // Overscan count for virtual scroller

// Project Tree
export const SESSION_ID_PREVIEW_LENGTH = 8; // Session ID preview length in project tree

// Search View
export const SAMPLE_PROJECTS_COUNT = 5; // Number of sample projects to show in search results
export const SEARCH_NAVIGATION_PAGE_SIZE = 10000; // Large page size for search result navigation to ensure target message is loaded
