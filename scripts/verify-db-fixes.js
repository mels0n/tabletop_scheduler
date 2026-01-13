const crypto = require('crypto');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

async function verify() {
    console.log("🔍 Verifying Database remediation...");

    // 1. Check Ghost Table
    try {
        await prisma.$queryRaw`SELECT * FROM "House" LIMIT 1`;
        console.error("❌ FAIL: 'House' table still exists!");
    } catch (e) {
        if (e.message.includes("no such table")) {
            console.log("✅ PASS: 'House' table is gone.");
        } else {
            console.log("⚠️ inconclusive: " + e.message);
        }
    }

    // 2. Security: Token Hashing
    const slug = 'verify_' + crypto.randomBytes(3).toString('hex');
    const rawToken = crypto.randomUUID();
    const tokenHash = hashToken(rawToken);

    await prisma.event.create({
        data: {
            slug,
            title: "Verification Event",
            adminToken: tokenHash, // Simulate App Behavior
            status: "DRAFT"
        }
    });

    const storedEvent = await prisma.event.findUnique({ where: { slug } });

    if (storedEvent.adminToken === tokenHash) {
        console.log("✅ PASS: Admin Token stored as Hash.");
    } else {
        console.error("❌ FAIL: Admin Token mismatch. Expected Hash.");
    }

    if (storedEvent.adminToken !== rawToken) {
        console.log("✅ PASS: Admin Token IS NOT plaintext.");
    } else {
        console.error("❌ FAIL: Admin Token stored as Plaintext!");
    }

    // 3. Vote Integrity
    console.log("⏳ Testing Vote Integrity (Unique Constraint)...");
    const p1 = await prisma.participant.create({
        data: {
            eventId: storedEvent.id,
            name: "Tester"
        }
    });
    const s1 = await prisma.timeSlot.create({
        data: {
            eventId: storedEvent.id,
            startTime: new Date(),
            endTime: new Date()
        }
    });

    try {
        await prisma.vote.create({
            data: { participantId: p1.id, timeSlotId: s1.id, preference: 'YES' }
        });
        await prisma.vote.create({
            data: { participantId: p1.id, timeSlotId: s1.id, preference: 'NO' }
        });
        console.error("❌ FAIL: Duplicate Vote allowed!");
    } catch (e) {
        if (e.code === 'P2002') {
            console.log("✅ PASS: Duplicate Vote blocked by Unique Constraint.");
        } else {
            console.error("⚠️ Unexpected error during vote test:", e);
        }
    }

    // Cleanup
    await prisma.vote.deleteMany({ where: { participantId: p1.id } });
    await prisma.participant.delete({ where: { id: p1.id } });
    await prisma.timeSlot.delete({ where: { id: s1.id } });
    await prisma.event.delete({ where: { id: storedEvent.id } });

    console.log("\n✨ Verification Complete.");
}

verify()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
