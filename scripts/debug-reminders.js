
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugReminders() {
    console.log("🔍 Debugging Reminders...");
    console.log(`Current Server Time: ${new Date().toISOString()}`);

    const events = await prisma.event.findMany({});

    console.log(`Found ${events.length} candidate events.`);

    for (const event of events) {
        console.log("---------------------------------------------------");
        console.log(`Event: ${event.title} (${event.slug})`);
        console.log(`  Status: ${event.status}`);
        console.log(`  Reminder Enabled: ${event.reminderEnabled}`);
        console.log(`  Timezone: ${event.timezone}`);
        console.log(`  Reminder Time (Raw): "${event.reminderTime}"`);
        console.log(`  Reminder Days: ${event.reminderDays}`);
        console.log(`  Last Sent: ${event.lastReminderSent ? event.lastReminderSent.toISOString() : 'NEVER'}`);

        if (!event.reminderTime) {
            console.log("  ⚠️ No reminder time set.");
            continue;
        }

        // Simulate parsing
        let [targetH, targetM] = event.reminderTime.split(':').map(part => parseInt(part.replace(/\D/g, '')));
        if (event.reminderTime.toLowerCase().includes('pm') && targetH < 12) targetH += 12;
        if (event.reminderTime.toLowerCase().includes('am') && targetH === 12) targetH = 0;

        console.log(`  Parsed Target: ${targetH}:${targetM.toString().padStart(2, '0')}`);

        // Current time in event's timezone
        try {
            const now = new Date();
            const timeInZone = now.toLocaleTimeString('en-US', { timeZone: event.timezone, hour12: false });
            console.log(`  Current Time in ${event.timezone}: ${timeInZone}`);
        } catch (e) {
            console.log(`  ❌ Invalid Timezone: ${event.timezone}`);
        }
    }
    console.log("---------------------------------------------------");
}

debugReminders()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
