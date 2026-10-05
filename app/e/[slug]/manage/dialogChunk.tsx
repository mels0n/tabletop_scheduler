// Intent: shared plumbing for the lazily loaded manage dialogs (see the *Modal triggers).

/**
 * Wraps the import used by `dynamic`. A failed chunk load (typically a tab left open across a
 * deploy) reloads the page, which fetches the current build, instead of throwing into the
 * route error boundary. The returned promise never settles so nothing renders in between.
 * Prefetch calls must NOT use this: a failed hover prefetch should stay silent.
 */
export function reloadOnStaleChunk<T>(load: Promise<T>): Promise<T> {
    return load.catch(() => {
        window.location.reload();
        return new Promise<never>(() => {});
    });
}

/** Same full-screen backdrop the dialogs render, shown while their chunk is still loading. */
export function DialogBackdrop() {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" />
    );
}
