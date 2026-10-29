import { publicConfig } from "@/shared/config/public";

/**
 * The hosted bot's profile picture, the same face people see on Telegram and Discord.
 * Self-hosted instances run their own bot with their own avatar, so there this renders
 * `fallback` instead (nothing by default).
 *
 * @param size - Rendered width and height in pixels.
 * @param badge - Optional platform mark shown on the bottom-right corner.
 * @param fallback - What to render on a self-hosted instance.
 * @param decorative - Hide the image from assistive tech when nearby text already names the bot.
 */
export function BotAvatar({ size, badge, fallback = null, decorative = false, className = "" }: {
    size: number;
    badge?: React.ReactNode;
    fallback?: React.ReactNode;
    decorative?: boolean;
    className?: string;
}) {
    if (!publicConfig.isHosted) return <>{fallback}</>;
    const src = size > 96 ? "/images/bot/avatar-384.webp" : "/images/bot/avatar-96.webp";
    return (
        <span className={`relative inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- images are unoptimized in next.config; the file is pre-sized */}
            <img
                src={src}
                alt={decorative ? "" : "Tabletop Time bot avatar"}
                width={size}
                height={size}
                className="rounded-full border border-line-strong object-cover"
                style={{ width: size, height: size }}
            />
            {badge && (
                <span data-testid="bot-avatar-badge" className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 border-surface-2" aria-hidden="true">
                    {badge}
                </span>
            )}
        </span>
    );
}
