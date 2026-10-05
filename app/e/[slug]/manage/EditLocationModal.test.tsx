import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}));

import { EditLocationModal } from './EditLocationModal';

describe('EditLocationModal: dialog body loads on demand', () => {
    it('shows only the trigger until clicked, then the dialog, and keeps typed text across reopen', async () => {
        render(<EditLocationModal slug="evt" initialLocation="Old Place" />);

        expect(screen.queryByText('Edit Location', { selector: 'h3' })).toBeNull();
        fireEvent.click(screen.getByTitle('Edit Location'));

        const input = await screen.findByPlaceholderText('e.g. 123 Main St');
        expect((input as HTMLInputElement).value).toBe('Old Place');
        await waitFor(() => expect(document.activeElement).toBe(input));
        fireEvent.change(input, { target: { value: 'New Place' } });

        fireEvent.click(screen.getByText('Cancel'));
        expect(screen.queryByPlaceholderText('e.g. 123 Main St')).toBeNull();

        fireEvent.click(screen.getByTitle('Edit Location'));
        const reopened = await screen.findByPlaceholderText('e.g. 123 Main St') as HTMLInputElement;
        expect(reopened.value).toBe('New Place');
        await waitFor(() => expect(document.activeElement).toBe(reopened));
    });
});
