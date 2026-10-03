import { spawn } from 'child_process';
import { createDecipheriv, scryptSync } from 'crypto';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

// --- Configuration ---
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY_RAW = process.env.BACKUP_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY_RAW) {
    console.error('❌ Error: BACKUP_ENCRYPTION_KEY is not set in .env');
    process.exit(1);
}

if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL is not set in .env');
    process.exit(1);
}

const backupFile = process.argv[2];
if (!backupFile) {
    console.error('❌ Usage: node scripts/db-restore.mjs <path-to-backup.enc>');
    process.exit(1);
}

const rl = createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log(`⚠️  DANGER: You are about to RESTORE a database.`);
console.log(`This will OVERWRITE data in: ${process.env.DATABASE_URL}`);
console.log(`Source: ${backupFile}`);
console.log('');

rl.question('Type "RESTORE" to confirm: ', (answer) => {
    if (answer !== 'RESTORE') {
        console.log('❌ Restore cancelled.');
        process.exit(0);
    }

    console.log('🔓 Decrypting and restoring...');

    // Create Key
    const key = scryptSync(ENCRYPTION_KEY_RAW, 'salt', 32);

    // Read File structure: [IV (16 bytes)] [Ciphertext...]
    // We need to read the IV first
    const input = createReadStream(backupFile, { start: 0, end: 15 });

    let iv = Buffer.alloc(0);
    input.on('data', (chunk) => {
        iv = Buffer.concat([iv, chunk]);
    });

    input.on('end', () => {
        if (iv.length !== 16) {
            console.error('❌ Invalid backup file format (IV missing)');
            process.exit(1);
        }

        // Now recreate stream starting after IV
        const fileStream = createReadStream(backupFile, { start: 16 });
        const decipher = createDecipheriv(ALGORITHM, key, iv);

        // Spawn psql
        const psql = spawn('psql', [process.env.DATABASE_URL]);

        // Pipeline: File -> Decipher -> psql
        fileStream.pipe(decipher).pipe(psql.stdin);

        psql.stderr.on('data', (data) => console.error(`[psql]: ${data}`));

        psql.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Restore Completed Successfully.');
                rl.close();
            } else {
                console.error('❌ Restore Failed.');
                rl.close();
                process.exit(code);
            }
        });
    });
});
