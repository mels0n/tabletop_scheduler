import { ImageResponse } from 'next/og';
import prisma from "@/shared/lib/prisma";

export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';
export const alt = 'Tabletop Time Event';
export const revalidate = 86400; // Cache for 24 hours

export default async function Image({ params }: { params: { slug: string } }) {
    const event = await prisma.event.findUnique({
        where: { slug: params.slug },
    });

    const title = event?.title || 'Tabletop Event';
    const description = event?.description || 'Join this game session on Tabletop Time!';

    return new ImageResponse(
        (
            <div
                style={{
                    height: '100%',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#020617', // Slate-950
                    fontFamily: 'sans-serif',
                    padding: '40px',
                    textAlign: 'center',
                }}
            >
                {/* Background Gradients */}
                <div
                    style={{
                        position: 'absolute',
                        top: '-20%',
                        left: '20%',
                        width: '600px',
                        height: '600px',
                        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, rgba(0,0,0,0) 70%)',
                        filter: 'blur(40px)',
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        bottom: '-20%',
                        right: '20%',
                        width: '600px',
                        height: '600px',
                        background: 'radial-gradient(circle, rgba(34, 211, 238, 0.15) 0%, rgba(0,0,0,0) 70%)',
                        filter: 'blur(40px)',
                    }}
                />

                {/* Brand Title Small */}
                <div
                    style={{
                        display: 'flex',
                        color: '#94a3b8', // Slate-400
                        fontSize: 24,
                        fontWeight: 600,
                        marginBottom: '20px',
                        zIndex: 10,
                    }}
                >
                    Tabletop Time Event
                </div>

                {/* Event Title */}
                <div
                    style={{
                        display: 'flex',
                        background: 'linear-gradient(to right, #818cf8, #22d3ee)', // Indigo-400 to Cyan-400
                        backgroundClip: 'text',
                        color: 'transparent',
                        fontSize: 72,
                        fontWeight: 800,
                        letterSpacing: '-0.025em',
                        marginBottom: '30px',
                        zIndex: 10,
                        lineHeight: 1.1,
                        textShadow: '0 0 40px rgba(129, 140, 248, 0.3)',
                    }}
                >
                    {title}
                </div>

                {/* Description */}
                <div
                    style={{
                        color: '#cbd5e1', // Slate-300
                        fontSize: 32,
                        maxWidth: '80%',
                        zIndex: 10,
                        lineHeight: 1.4,
                    }}
                >
                    {description.slice(0, 120) + (description.length > 120 ? '...' : '')}
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
