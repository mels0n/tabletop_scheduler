"use client";

import React from 'react';
import { usePathname } from "next/navigation";

export default function UntapBadge({ type = 'Designed' }: { type?: 'Designed' | 'Hosted' | 'Built' | 'Powered' }) {
  const isHome = usePathname() === "/";
  return (
    <a href="https://untapweb.com" target="_blank" rel={isHome ? "noopener noreferrer" : "nofollow noopener noreferrer"} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375em', fontSize: 'inherit', color: 'inherit', textDecoration: 'none', opacity: 0.7, transition: 'opacity 0.2s' }} onMouseOver={(e) => e.currentTarget.style.opacity = '1'} onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}>
      <svg width="1.1em" height="1.25em" viewBox="0 0 44 50" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="text-untap" style={{ flexShrink: 0 }}>
        <line x1="7" y1="9" x2="7" y2="31" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="37" y1="9" x2="37" y2="31" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 31 Q7 46 22 46 Q37 46 37 31" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        <line x1="7" y1="20" x2="37" y2="20" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 5" opacity="0.4" />
        <line x1="7" y1="31" x2="37" y2="9" stroke="currentColor" strokeWidth="1" opacity="0.25" />
        <circle cx="7" cy="9" r="4" fill="currentColor" />
        <circle cx="37" cy="9" r="4" fill="currentColor" />
        <circle cx="7" cy="20" r="2.5" fill="currentColor" opacity="0.5" />
        <circle cx="37" cy="20" r="2.5" fill="currentColor" opacity="0.5" />
        <circle cx="7" cy="31" r="3" fill="currentColor" />
        <circle cx="37" cy="31" r="3" fill="currentColor" />
        <circle cx="22" cy="46" r="4" className="fill-untap-accent" />
      </svg>
      <span style={{ lineHeight: 1 }}>{type} by <strong style={{ fontWeight: 700 }}>Untap Web</strong></span>
    </a>
  );
};