/**
 * A hard ceiling for update checks.
 *
 * The updater plugin's `check()` runs its request on the Rust side and has no
 * timeout of its own: when the release endpoint stalls — throttling, a
 * half-open connection, a proxy that accepts and never answers — the promise
 * never settles and the settings spinner turns forever. The plugin's `timeout`
 * option is passed through, and this race guarantees the UI is released even
 * if the installed plugin predates that option.
 */
export const UPDATE_CHECK_TIMEOUT_MS = 15_000;

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}
