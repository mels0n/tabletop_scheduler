import { ImageResponse } from 'next/og';

// Route segment config
export const runtime = 'edge';

// Image metadata
export const alt = 'Tabletop Time Scheduler';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
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

                {/* Brand Title */}
                <div
                    style={{
                        display: 'flex',
                        background: 'linear-gradient(to right, #818cf8, #22d3ee)', // Indigo-400 to Cyan-400
                        backgroundClip: 'text',
                        color: 'transparent',
                        fontSize: 84,
                        fontWeight: 800,
                        letterSpacing: '-0.05em',
                        marginBottom: '40px',
                        zIndex: 10,
                    }}
                >
                    Tabletop Time
                </div>

                {/* Subtitle */}
                <div
                    style={{
                        color: '#94a3b8', // Slate-400
                        fontSize: 32,
                        marginBottom: '80px',
                        maxWidth: '80%',
                        textAlign: 'center',
                        zIndex: 10,
                    }}
                >
                    Coordinate D&D and board game sessions without the chaos.
                </div>

                {/* CTA Button */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#4f46e5', // Indigo-600
                        color: 'white',
                        padding: '20px 48px',
                        borderRadius: '16px',
                        fontSize: 36,
                        fontWeight: 600,
                        boxShadow: '0 20px 25px -5px rgba(79, 70, 229, 0.3)',
                        zIndex: 10,
                    }}
                >
                    Schedule Now
                </div>
            </div>
        ),
        {
            ...size,
        }
    );
}
