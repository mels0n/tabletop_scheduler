import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}));

// Intent: make the dialog's dynamic import reject, as it does when a chunk 404s after a deploy.
const loader = vi.hoisted(() => ({ attempts: 0 }));
vi.mock('./EditLocationDialog', () => {
    loader.attempts += 1;
    throw new Error('Loading chunk failed');
});

import { EditLocationModal } from './EditLocationModal';

const MESSAGE = 'This page was updated or your connection dropped.';

describe('EditLocationModal: dialog chunk fails to load', () => {
    const originalLocation = window.location;
    const reload = vi.fn();

    beforeEach(() => {
        reload.mockClear();
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: { ...originalLocation, reload },
        });
    });

    afterEach(() => {
        Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    });

    it('shows a message with Reload and Close and does not reload on its own', async () => {
        render(<EditLocationModal slug="evt" initialLocation={null} />);
        fireEvent.click(screen.getByTitle('Edit Location'));

        expect(await screen.findByText(MESSAGE)).toBeTruthy();
        expect(screen.getByText('Reload')).toBeTruthy();
        expect(screen.getByText('Close')).toBeTruthy();
        expect(reload).not.toHaveBeenCalled();
    });

    it('Close dismisses the message and returns to the trigger', async () => {
        render(<EditLocationModal slug="evt" initialLocation={null} />);
        fireEvent.click(screen.getByTitle('Edit Location'));
        await screen.findByText(MESSAGE);

        fireEvent.click(screen.getByText('Close'));

        expect(screen.queryByText(MESSAGE)).toBeNull();
        expect(screen.getByTitle('Edit Location')).toBeTruthy();
        expect(reload).not.toHaveBeenCalled();
    });

    it('Reload reloads the page exactly once', async () => {
        render(<EditLocationModal slug="evt" initialLocation={null} />);
        fireEvent.click(screen.getByTitle('Edit Location'));
        await screen.findByText(MESSAGE);

        fireEvent.click(screen.getByText('Reload'));

        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('a failed prefetch on hover or focus shows nothing and does not reload', async () => {
        render(<EditLocationModal slug="evt" initialLocation={null} />);
        const trigger = screen.getByTitle('Edit Location');

        fireEvent.pointerEnter(trigger);
        fireEvent.focus(trigger);
        await waitFor(() => expect(loader.attempts).toBeGreaterThan(0));
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(screen.queryByText(MESSAGE)).toBeNull();
        expect(reload).not.toHaveBeenCalled();
    });
});
