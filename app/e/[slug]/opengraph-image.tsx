import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import prisma from "@/shared/lib/prisma";

export const size = {
    width: 1200,
    height: 630,
};

export const contentType = 'image/png';
export const alt = 'Tabletop Time Event';
export const revalidate = 86400; // Cache for 24 hours

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const event = await prisma.event.findUnique({
        where: { slug },
        select: { title: true, description: true },
    });

    const title = event?.title || 'Tabletop Event';
    const description = event?.description || 'Join this game session on Tabletop Time!';

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
                    padding: '40px',
                    textAlign: 'center',
                }}
            >
                {/* Brand Title Small */}
                <div
                    style={{
                        display: 'flex',
                        color: '#93A0BA',
                        fontSize: 24,
                        marginBottom: '20px',
                    }}
                >
                    Tabletop Time Event
                </div>

                {/* Event Title */}
                <div
                    style={{
                        display: 'flex',
                        color: '#D4AF5A',
                        fontFamily: 'Cormorant SC',
                        fontSize: 80,
                        fontWeight: 700,
                        letterSpacing: '0.01em',
                        marginBottom: '24px',
                        lineHeight: 1.1,
                    }}
                >
                    {title}
                </div>

                {/* Ornament */}
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '28px',
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

                {/* Description */}
                <div
                    style={{
                        color: '#CFC6B2',
                        fontSize: 32,
                        maxWidth: '80%',
                        lineHeight: 1.4,
                    }}
                >
                    {description.slice(0, 120) + (description.length > 120 ? '...' : '')}
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
