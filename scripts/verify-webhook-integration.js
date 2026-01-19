/**
 * usage: node scripts/verify-webhook-integration.js [webhook_url] [base_url]
 * 
 * defaults:
 *   base_url: https://tabletoptime.us
 *   webhook_url: (prompts user if missing)
 */

const readline = require('readline');

// Config
let BASE_URL = process.argv[3] || "https://tabletoptime.us";
let WEBHOOK_URL = process.argv[2];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
    console.log("=== Integration Verification Script ===");
    console.log(`Target: ${BASE_URL}`);

    if (!WEBHOOK_URL) {
        WEBHOOK_URL = await new Promise(resolve => {
            rl.question('Enter Webhook URL (e.g. from webhook.site): ', (answer) => {
                resolve(answer.trim());
            });
        });
    }

    if (!WEBHOOK_URL.startsWith('http')) {
        console.error("Invalid URL. Must start with http/https");
        process.exit(1);
    }

    // 1. Create Event
    console.log("\n[1/3] Creating Test Event...");
    const createRes = await fetch(`${BASE_URL}/api/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            title: "Integration Test Event",
            description: "Automated test for webhooks",
            minPlayers: 1,
            slots: [
                {
                    startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
                    endTime: new Date(Date.now() + 90000000).toISOString()
                }
            ],
            timezone: "UTC",
            fromUrl: WEBHOOK_URL,
            fromUrlId: "TEST-SCRIPT-001"
        })
    });

    if (!createRes.ok) {
        console.error(`Creation Failed: ${createRes.status} ${createRes.statusText}`);
        console.error(await createRes.text());
        process.exit(1);
    }

    const event = await createRes.json();
    console.log(`✅ Event Created!`);
    console.log(`   Slug: ${event.slug}`);
    console.log(`   Admin Token: ${event.adminToken}`);
    console.log(`   Link: ${BASE_URL}/e/${event.slug}`);
    console.log(`👉 CHECK WEBHOOK: You should receive a "CREATED" payload now.`);

    // 2. Voting Page Check (Simulated)
    console.log("\n[2/3] verifying Voting Page Prefill...");
    // We can't check JS execution, but we can verify the URL works
    const votePageRes = await fetch(`${BASE_URL}/e/${event.slug}?userID=AutoTester`);
    if (votePageRes.ok) {
        console.log(`✅ Page accessible (Status: ${votePageRes.status})`);
        console.log("   (Manual Check: Open link in browser, verify name is 'AutoTester')");
    } else {
        console.warn(`⚠️ Voting page returned ${votePageRes.status}`);
    }

    // 3. Finalize Event
    console.log("\n[3/3] Finalizing Event...");

    // Auth: Construct Cookie
    const cookieHeader = `tabletop_admin_${event.slug}=${event.adminToken}`;

    // Get the slot ID (we know it's the first one we created, but let's fetch event to be sure)
    const getRes = await fetch(`${BASE_URL}/api/event/${event.slug}`);
    const eventDetails = await getRes.json();
    const slotId = eventDetails.timeSlots[0].id;

    // Use FormData for Finalize endpoint
    const formData = new FormData();
    formData.append('slotId', slotId.toString());
    formData.append('location', 'Test Script Virtual Location');

    const finalizeRes = await fetch(`${BASE_URL}/api/event/${event.slug}/finalize`, {
        method: 'POST',
        headers: {
            'Cookie': cookieHeader
            // FormData automatically sets Content-Type with boundary
        },
        body: formData
    });

    // Handle redirection (303 or 307) or 200 depending on Next.js setup
    // Fetch follows redirects automatically.
    // If successful, we expect to NOT get a 401/500
    if (finalizeRes.ok) {
        console.log(`✅ Event Finalized!`);
        console.log(`👉 CHECK WEBHOOK: You should receive a "FINALIZED" payload now.`);
    } else {
        console.error(`Finalization Failed: ${finalizeRes.status}`);
        console.error(await finalizeRes.text());
    }

    console.log("\n=== Verification Complete ===");
    console.log("Notes on Cancellation:");
    console.log("   Cancellation requires manual testing via the UI as it uses Server Actions.");
    console.log(`   Go to ${BASE_URL}/e/${event.slug}/manage to cancel manually.`);
    process.exit(0);
}

main().catch(err => {
    console.error("Script Error:", err);
    process.exit(1);
});
