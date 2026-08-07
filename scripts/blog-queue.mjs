// Prints the blog drip queue: which posts are live, which are scheduled
// (future-dated, hidden until the fortnightly deploy on/after their date),
// which are drafts, and the next open fortnightly slot.
//
// Cadence: every other Thursday, anchored at REFERENCE (must match the parity
// check in .github/workflows/fortnightly-deploy.yml).
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const REFERENCE = Date.UTC(2026, 7, 13); // 2026-08-13, first scheduled slot
const SLOT_MS = 14 * 24 * 60 * 60 * 1000;

const contentDir = path.join(process.cwd(), 'content', 'blog');
const now = Date.now();

const posts = fs
    .readdirSync(contentDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
        const { data } = matter(fs.readFileSync(path.join(contentDir, f), 'utf8'));
        return {
            slug: f.replace(/\.md$/, ''),
            title: data.title ?? 'Untitled',
            date: data.date ? new Date(data.date) : null,
            draft: data.draft === true,
        };
    })
    .sort((a, b) => (a.date?.getTime() ?? 0) - (b.date?.getTime() ?? 0));

const iso = (d) => d.toISOString().slice(0, 10);

let latest = 0;
for (const p of posts) {
    let status;
    if (p.draft) {
        status = 'DRAFT    ';
    } else if (p.date && p.date.getTime() > now) {
        status = 'SCHEDULED';
    } else {
        status = 'live     ';
    }
    if (!p.draft && p.date) {
        latest = Math.max(latest, p.date.getTime());
    }
    console.log(`${status}  ${p.date ? iso(p.date) : '(no date)'}  ${p.slug}`);
}

// Next open slot: first REFERENCE + k*14d that is after the latest queued
// post's date and not in the past.
let slot = REFERENCE;
while (slot <= latest || slot < now) {
    slot += SLOT_MS;
}
console.log(`\nNext open slot: ${iso(new Date(slot))} (fortnightly Thursdays from ${iso(new Date(REFERENCE))})`);
