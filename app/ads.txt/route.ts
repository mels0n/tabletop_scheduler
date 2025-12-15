import { NextResponse } from 'next/server';

/**
 * @function GET
 * @description Serves the `ads.txt` file dynamically.
 *
 * Pattern: Dynamic Configuration.
 * Usage: Allows the AdSense publisher ID to be pulled from environment variables
 * (`ADS_TXT_CONTENT`) rather than hardcoding it in the repo. This is useful for
 * managing different AdSense accounts across environments or keeping IDs private.
 *
 * @returns {NextResponse} The plain text content of ads.txt.
 */
export async function GET() {
    // Intent: Serve ads.txt content from environment variable
    // This allows vercel-only configuration without committing the file to the repo.
    const content = process.env.ADS_TXT_CONTENT || '';

    return new NextResponse(content, {
        headers: {
            'Content-Type': 'text/plain',
        },
    });
}
