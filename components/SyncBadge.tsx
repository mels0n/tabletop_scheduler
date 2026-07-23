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
            <span className="text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 bg-green-900/40 text-green-400 rounded-full border border-green-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Telegram Synced
            </span>
        );
    }

    if (variant === 'discord') {
        return (
            <span className="text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 bg-[#5865F2]/20 text-[#5865F2] rounded-full border border-[#5865F2]/50 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5865F2] animate-pulse" />
                Discord Synced
            </span>
        );
    }

    return (
        <span className="text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 bg-slate-800/60 text-slate-400 rounded-full border border-slate-700 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            This Device Only
        </span>
    );
}
