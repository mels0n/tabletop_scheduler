import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// Guards the Tome visual system: UI files use the design tokens in
// tailwind.config.ts, never raw palette colors or the effects the redesign removed.

const ROOT = join(__dirname, "..", "..");
const DIRS = ["app", "components", "features"];

function collect(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) return collect(full);
        return name.endsWith(".tsx") && !name.endsWith(".test.tsx") ? [full] : [];
    });
}

const files = DIRS.flatMap((d) => collect(join(ROOT, d)))
    .map((f) => relative(ROOT, f).split(sep).join("/"))
    .sort();

// Image generators and the viewport themeColor need literal hex values.
const HEX_ALLOWED = /(opengraph-image|icon)\.tsx$|^app\/layout\.tsx$/;

const BANNED: Array<[string, RegExp]> = [
    ["raw palette color", /\b(?:slate|indigo|cyan|emerald|purple|sky|blue|green|yellow|amber|red|gray|zinc|neutral|stone|orange|pink|rose|violet|teal|lime|fuchsia)-(?:50|[1-9]00|950)\b/],
    ["gradient", /\bbg-gradient-/],
    ["gradient text", /\bbg-clip-text\b/],
    ["backdrop blur", /\bbackdrop-blur/],
    ["arbitrary shadow", /\bshadow-\[/],
    ["hover scale", /\bhover:scale-/],
    ["large radius", /\brounded-(?:2xl|3xl)\b/],
    ["emoji icon", /[\u{1F409}\u{1F0CF}\u{1F3B2}\u{1F6AB}\u{1F4C5}\u{1F4E7}\u{1F4CE}\u{1F3AF}\u{1F39F}\u{26A0}\u{1F614}\u{2615}]/u],
];

const DOT = /data-dot|\b(?:size-(?:1|1\.5|2|2\.5|3)|w-(?:1\.5|2|2\.5|3) h-(?:1\.5|2|2\.5|3))\b/;

function violations(path: string): string[] {
    const lines = readFileSync(join(ROOT, path), "utf8").split("\n");
    const found: string[] = [];
    lines.forEach((line, i) => {
        const at = `${path}:${i + 1}`;
        for (const [label, re] of BANNED) {
            if (re.test(line)) found.push(`${at} ${label}`);
        }
        if (!HEX_ALLOWED.test(path) && /#[0-9a-fA-F]{6}\b/.test(line)) found.push(`${at} raw hex`);
        if (/\brounded-full\b/.test(line) && !DOT.test(line)) found.push(`${at} rounded-full outside a status dot`);
        if (/\banimate-pulse\b/.test(line) && !path.endsWith("loading.tsx")) found.push(`${at} animate-pulse outside a loading skeleton`);
    });
    return found;
}

describe("Tome styling guard", () => {
    it.each(files)("%s has no legacy styling", (path) => {
        expect(violations(path)).toEqual([]);
    });

    it("globals.css stops the donation ticker under reduced motion", () => {
        const css = readFileSync(join(ROOT, "app", "globals.css"), "utf8");
        expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*{[^}]*\.ticker-track/);
    });
});
