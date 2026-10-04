import { describe, it, expect } from 'vitest';
import { canTakeOpenSeat } from './seating';

describe('canTakeOpenSeat', () => {
    it('seats a YES voter in any open seat up to the maximum', () => {
        expect(canTakeOpenSeat('YES', 4, 3, 5)).toBe(true);
        expect(canTakeOpenSeat('YES', 5, 3, 5)).toBe(false);
    });

    it('seats an If Needed (MAYBE) voter only while the event is below its minimum', () => {
        expect(canTakeOpenSeat('MAYBE', 2, 3, 5)).toBe(true);
        expect(canTakeOpenSeat('MAYBE', 3, 3, 5)).toBe(false);
        expect(canTakeOpenSeat('MAYBE', 4, 3, 5)).toBe(false);
    });

    it('never seats MAYBE when there is no minimum, and never above the maximum', () => {
        expect(canTakeOpenSeat('MAYBE', 0, 0, 5)).toBe(false);
        expect(canTakeOpenSeat('MAYBE', 4, 6, 4)).toBe(false);
        expect(canTakeOpenSeat('MAYBE', 3, 6, 4)).toBe(true);
    });

    it('never seats a NO voter', () => {
        expect(canTakeOpenSeat('NO', 0, 3, 5)).toBe(false);
    });

    it('treats a missing preference like a YES (open seat below the maximum)', () => {
        expect(canTakeOpenSeat(undefined, 4, 3, 5)).toBe(true);
        expect(canTakeOpenSeat(undefined, 5, 3, 5)).toBe(false);
    });
});
