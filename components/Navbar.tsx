"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusCircle, User, Calendar } from "lucide-react";
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
    const isHosted = process.env.NEXT_PUBLIC_IS_HOSTED === "true";

    // Intent: Helper to determine if a specific route is currently active for UI highlighting.
    const isActive = (path: string) => pathname === path;

    return (
        <nav className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-md sticky top-0 z-40">
            <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl text-slate-100 hover:text-indigo-400 transition-colors">
                    <Calendar className="w-6 h-6 text-indigo-500" />
                    <span>Tabletop<span className="text-indigo-500">Scheduler</span></span>
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
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                active
                    ? "bg-indigo-500/10 text-indigo-400"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            )}
        >
            {icon}
            <span className="hidden md:inline">{children}</span>
        </Link>
    );
}
