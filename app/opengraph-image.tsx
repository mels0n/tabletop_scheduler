import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Image metadata
export const alt = 'Tabletop Time Scheduler';
export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';

export default async function Image() {
    const [cormorant, spectral] = await Promise.all([
        readFile(join(process.cwd(), 'app/_fonts/CormorantSC-Bold.ttf')),
        readFile(join(process.cwd(), 'app/_fonts/Spectral-Regular.ttf')),
    ]);

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
                    backgroundColor: '#0F1626',
                    fontFamily: 'Spectral',
                }}
            >
                {/* Brand Title */}
                <div
                    style={{
                        display: 'flex',
                        color: '#D4AF5A',
                        fontFamily: 'Cormorant SC',
                        fontSize: 96,
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                        marginBottom: '28px',
                    }}
                >
                    Tabletop Time
                </div>

                {/* Ornament */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '32px',
                    }}
                >
                    <div style={{ display: 'flex', width: '160px', height: '1px', backgroundColor: '#56709F' }} />
                    <div
                        style={{
                            display: 'flex',
                            width: '14px',
                            height: '14px',
                            margin: '0 20px',
                            backgroundColor: '#D4AF5A',
                            transform: 'rotate(45deg)',
                        }}
                    />
                    <div style={{ display: 'flex', width: '160px', height: '1px', backgroundColor: '#56709F' }} />
                </div>

                {/* Subtitle */}
                <div
                    style={{
                        color: '#CFC6B2',
                        fontSize: 32,
                        marginBottom: '64px',
                        maxWidth: '80%',
                        textAlign: 'center',
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
                        backgroundColor: '#D4AF5A',
                        color: '#1A1404',
                        padding: '20px 48px',
                        borderRadius: '4px',
                        fontSize: 36,
                        fontWeight: 400,
                    }}
                >
                    Schedule Now
                </div>
            </div>
        ),
        {
            ...size,
            fonts: [
                { name: 'Cormorant SC', data: cormorant, weight: 700, style: 'normal' },
                { name: 'Spectral', data: spectral, weight: 400, style: 'normal' },
            ],
        }
    );
}
