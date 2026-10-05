import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Image metadata
export const size = {
    width: 32,
    height: 32,
};
export const contentType = 'image/png';

// Image generation
export default async function Icon() {
    const cormorant = await readFile(join(process.cwd(), 'app/_fonts/CormorantSC-Bold.ttf'));

    return new ImageResponse(
        (
            // ImageResponse JSX element
            <div
                style={{
                    fontSize: 26,
                    fontFamily: 'Cormorant SC',
                    fontWeight: 700,
                    background: '#0F1626',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#D4AF5A',
                    borderRadius: '4px',
                }}
            >
                T
            </div>
        ),
        // ImageResponse options
        {
            ...size,
            fonts: [{ name: 'Cormorant SC', data: cormorant, weight: 700, style: 'normal' }],
        }
    );
}
