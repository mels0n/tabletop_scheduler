import { publicConfig } from "@/shared/config/public";

/**
 * The hosted bot's profile picture, the same face people see on Telegram and Discord.
 * Self-hosted instances run their own bot with their own avatar, so this renders nothing
 * there and callers keep their existing icon as the fallback.
 *
 * @param size - Rendered width and height in pixels.
 * @param badge - Optional platform mark shown on the bottom-right corner.
 */
export function BotAvatar({ size, badge, className = "" }: {
    size: number;
    badge?: React.ReactNode;
    className?: string;
}) {
    if (!publicConfig.isHosted) return null;
    const src = size > 96 ? "/images/bot/avatar-384.webp" : "/images/bot/avatar-96.webp";
    return (
        <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- images are unoptimized in next.config; the file is pre-sized */}
            <img
                src={src}
                alt="Tabletop Time bot avatar"
                width={size}
                height={size}
                className="rounded-full border border-line-strong object-cover"
                style={{ width: size, height: size }}
            />
            {badge && (
                <span className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-surface-2" aria-hidden="true">
                    {badge}
                </span>
            )}
        </span>
    );
}
