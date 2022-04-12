/**
 * @param {IdleRequestCallback} callback
 * @param {number} [maxDelay]
 */
const onIdle = (callback, maxDelay = 100) =>
    requestIdleCallback(callback, { timeout: maxDelay });

/**
 * Yields to the event loop, performing the callback:
 *
 * - If `requestIdleCallback` is supported: when idle or after 100ms, whichever comes first
 * - Otherwise: at the browser's fastest `setTimeout` resolution (typically 2-4ms)
 */
export const unblock =
    typeof window.requestIdleCallback === 'function' ? onIdle : setTimeout;
