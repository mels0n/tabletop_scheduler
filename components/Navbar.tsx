"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, User, Dices } from "lucide-react";
import { clsx } from "clsx";

/**
 * @component Navbar
 * @description The global top navigation bar for the application.
 * Highlights the active route and provides responsive links to core features:
 * - Home (Event Dashboard)
 * - New Event (Creation Wizard)
 * - My Events (User Profile/History)
 *
 * @returns {JSX.Element} The sticky navigation bar.
 */
export function Navbar() {
    const pathname = usePathname();

    // Intent: Helper to determine if a specific route is currently active for UI highlighting.
    const isActive = (path: string) => pathname === path;

    return (
        <nav className="border-b border-line bg-ink sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2.5 font-display font-bold text-xl tracking-[0.01em] text-parchment hover:text-gold-bright transition-colors">
                    <span className="icon-tile size-7" aria-hidden="true"><Dices className="w-4 h-4" /></span>
                    <span>Tabletop<span className="text-gold">Scheduler</span></span>
                </Link>

                <div className="flex items-center gap-1 md:gap-4">
                    <NavLink href="/" active={isActive('/')} icon={<Home className="w-4 h-4" />}>
                        Home
                    </NavLink>
                    <NavLink href="/new" active={isActive('/new')} icon={<PlusCircle className="w-4 h-4" />}>
                        New Event
                    </NavLink>
                    <NavLink href="/profile" active={isActive('/profile')} icon={<User className="w-4 h-4" />}>
                        My Events
                    </NavLink>

                </div>
            </div>
        </nav>
    );
}

/**
 * @component NavLink
 * @description Internal helper component for rendering consistent navigation links.
 * Handles responsive icon/text definitions and active state styling.
 *
 * @param {Object} props - Component props.
 * @param {string} props.href - Destination URL.
 * @param {boolean} props.active - Whether this link represents the current page.
 * @param {ReactNode} props.icon - Icon element to display.
 * @param {ReactNode} props.children - Label content (hidden on mobile).
 */
function NavLink({ href, active, icon, children }: { href: string, active: boolean, icon: React.ReactNode, children: string }) {
    return (
        <Link
            href={href}
            aria-label={children}
            className={clsx(
                "flex items-center gap-2 px-3 py-2 rounded-control text-sm font-medium transition-colors",
                active
                    ? "bg-surface-2 text-parchment"
                    : "text-mist hover:text-parchment hover:bg-surface"
            )}
        >
            {icon}
            <span className="hidden md:inline">{children}</span>
        </Link>
    );
}
