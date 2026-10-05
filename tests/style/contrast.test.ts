import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// WCAG contrast for the Tome color tokens declared in app/globals.css.

const css = readFileSync(join(__dirname, "..", "..", "app", "globals.css"), "utf8");

function token(name: string): [number, number, number] {
    const m = css.match(new RegExp(`--c-${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)\\s*;`));
    if (!m) throw new Error(`token --c-${name} not found in globals.css`);
    return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function luminance([r, g, b]: [number, number, number]): number {
    const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
    const [x, y] = [luminance(token(a)), luminance(token(b))];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("Tome token contrast", () => {
    it.each(["parchment", "parchment-2", "mist", "gold", "gold-bright", "yes", "no", "discord-text"])(
        "%s text meets 4.5:1 on ink and surface",
        (fg) => {
            expect(contrast(fg, "ink")).toBeGreaterThanOrEqual(4.5);
            expect(contrast(fg, "surface")).toBeGreaterThanOrEqual(4.5);
        },
    );

    it.each([
        ["on-gold", "gold"],
        ["on-yes", "yes"],
        ["on-maybe", "maybe"],
        ["on-no", "no"],
    ])("%s on %s meets 4.5:1", (fg, bg) => {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });

    it("control borders meet 3:1 on field and surface", () => {
        expect(contrast("line-strong", "field")).toBeGreaterThanOrEqual(3);
        expect(contrast("line-strong", "surface")).toBeGreaterThanOrEqual(3);
    });

    it.each(["yes", "maybe", "no"])("selected %s vote fill meets 3:1 against an unselected button", (fill) => {
        expect(contrast(fill, "field")).toBeGreaterThanOrEqual(3);
    });

    it.each([
        ["parchment", "surface-2"],
        ["gold-bright", "surface-2"],
        ["mist", "surface-2"],
        ["telegram", "surface-2"],
        ["discord-text", "surface-2"],
        ["no", "surface-2"],
        ["yes", "yes-bg"],
        ["maybe", "maybe-bg"],
        ["no", "no-bg"],
    ])("%s text meets 4.5:1 on %s", (fg, bg) => {
        expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });

    it("every Tailwind color token has a --c- declaration and vice versa", () => {
        const config = readFileSync(join(__dirname, "..", "..", "tailwind.config.ts"), "utf8");
        const list = config.match(/const TOKENS = \[([\s\S]*?)\] as const/);
        if (!list) throw new Error("TOKENS list not found in tailwind.config.ts");
        const configured = [...list[1].matchAll(/"([a-z0-9-]+)"/g)].map((m) => m[1]).sort();
        const declared = [...css.matchAll(/--c-([a-z0-9-]+):/g)].map((m) => m[1]).sort();
        expect(configured).toEqual(declared);
    });
});
