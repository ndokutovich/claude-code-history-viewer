/**
 * Geometry for the session minimap (upstream #634).
 *
 * The strip maps the whole transcript onto [0, 1]: every row gets an equal
 * band, and the viewport box shows which slice of the document is visible.
 * Keeping the maths here means the component only draws and forwards input.
 */

export interface MinimapViewport {
  /** Top of the visible slice, 0..1 */
  start: number;
  /** Height of the visible slice, 0..1 (clamped to 1) */
  size: number;
}

const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

/**
 * Visible slice of the document as fractions of its full height.
 * Zero-height content reports a full-height viewport so the box never
 * disappears while the list is still loading.
 */
export function viewportFraction(
  scrollTop: number,
  viewportHeight: number,
  contentHeight: number
): MinimapViewport {
  if (contentHeight <= 0) {
    return { start: 0, size: 1 };
  }
  const size = clamp01(viewportHeight / contentHeight);
  const maxStart = 1 - size;
  const start = Math.min(maxStart, clamp01(scrollTop / contentHeight));
  return { start, size };
}

/**
 * Where a click at `fraction` (0 = top of the strip) should scroll to.
 * The viewport is centred on the click, so dragging the strip feels like
 * moving the box rather than jumping its top edge.
 */
export function fractionToScrollTop(
  fraction: number,
  viewportHeight: number,
  contentHeight: number
): number {
  if (contentHeight <= 0) return 0;
  const centred = clamp01(fraction) * contentHeight - viewportHeight / 2;
  const maxScroll = Math.max(0, contentHeight - viewportHeight);
  return Math.min(maxScroll, Math.max(0, centred));
}

/** Row index a click at `fraction` falls on (equal bands per row). */
export function fractionToRowIndex(fraction: number, rowCount: number): number | null {
  if (rowCount <= 0) return null;
  const index = Math.floor(clamp01(fraction) * rowCount);
  return Math.min(rowCount - 1, Math.max(0, index));
}

/**
 * Band for row `index` in the strip, in fractions of its height.
 * Rows keep a minimum visible thickness so a long transcript still shows
 * structure instead of a solid block at typical strip widths.
 */
export function rowBand(index: number, rowCount: number): { top: number; size: number } {
  if (rowCount <= 0) return { top: 0, size: 0 };
  const size = 1 / rowCount;
  return { top: clamp01(index * size), size };
}
