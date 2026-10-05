interface SyncBadgeProps {
    variant: 'telegram' | 'discord' | 'device';
}

/**
 * @component SyncBadge
 * @description Small pill badge showing how an event (or the user) is linked to
 * a sync source. Shared between the profile dashboard's header/per-event badges
 * and the event manage page's manager-sync status block so the visual language
 * stays consistent across the app.
 */
export function SyncBadge({ variant }: SyncBadgeProps) {
    if (variant === 'telegram') {
        return (
            <span className="text-xs uppercase font-bold tracking-wide px-2 py-0.5 bg-surface-2 text-telegram rounded-control border border-telegram flex items-center gap-1">
                <span data-dot className="w-1.5 h-1.5 rounded-full bg-telegram" />
                Telegram Synced
            </span>
        );
    }

    if (variant === 'discord') {
        return (
            <span className="text-xs uppercase font-bold tracking-wide px-2 py-0.5 bg-surface-2 text-discord-text rounded-control border border-discord flex items-center gap-1">
                <span data-dot className="w-1.5 h-1.5 rounded-full bg-discord" />
                Discord Synced
            </span>
        );
    }

    return (
        <span className="text-xs uppercase font-bold tracking-wide px-2 py-0.5 bg-surface-2 text-mist rounded-control border border-line flex items-center gap-1">
            <span data-dot className="w-1.5 h-1.5 rounded-full bg-mist" />
            This Device Only
        </span>
    );
}
