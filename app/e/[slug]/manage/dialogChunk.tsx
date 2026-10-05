'use client';

// Intent: shared plumbing for the lazily loaded manage dialogs (see the *Modal triggers).

import { useEffect, useState, type ComponentType, type ReactNode } from 'react';

interface DialogProps {
    open: boolean;
    onClose: () => void;
}

/** Same full-screen backdrop the dialogs render, shown while their chunk is still loading. */
export function DialogBackdrop({ children }: { children?: ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            {children}
        </div>
    );
}

/** Shown when a dialog's code could not be fetched. Nothing reloads unless the manager asks. */
function DialogLoadFailed({ onClose }: { onClose: () => void }) {
    return (
        <DialogBackdrop>
            <div
                role="alert"
                className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-sm shadow-2xl p-4 space-y-4 animate-in zoom-in-95 duration-200"
            >
                <p className="text-sm text-slate-200">This page was updated or your connection dropped.</p>
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                    >
                        Close
                    </button>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium text-xs shadow-lg shadow-indigo-900/20 transition-all"
                    >
                        Reload
                    </button>
                </div>
            </div>
        </DialogBackdrop>
    );
}

/**
 * Loads a dialog's code on first open. While it loads the backdrop shows; if the import
 * rejects (typically a tab left open across a deploy, or a dropped connection) the manager
 * gets a Reload / Close prompt instead of an automatic reload that would discard input
 * elsewhere on the page. A failure is not cached: opening the dialog again retries.
 * Prefetch calls use the plain import and ignore failures, so they stay silent.
 */
export function lazyDialog<P extends DialogProps>(importDialog: () => Promise<ComponentType<P>>) {
    let loaded: ComponentType<P> | null = null;

    return function LazyDialog(props: P) {
        const { open, onClose } = props;
        const [Dialog, setDialog] = useState<ComponentType<P> | null>(() => loaded);
        const [failed, setFailed] = useState(false);

        useEffect(() => {
            if (!open || Dialog || failed) return;
            let cancelled = false;
            importDialog().then(
                component => {
                    loaded = component;
                    if (!cancelled) setDialog(() => component);
                },
                () => {
                    if (!cancelled) setFailed(true);
                },
            );
            return () => { cancelled = true; };
        }, [open, Dialog, failed]);

        if (Dialog) return <Dialog {...props} />;
        if (!open) return null;
        if (failed) {
            return <DialogLoadFailed onClose={() => { setFailed(false); onClose(); }} />;
        }
        return <DialogBackdrop />;
    };
}
