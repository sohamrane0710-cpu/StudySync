import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CompletionModal } from '@/components/timer/CompletionModal';

// Mock confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock soundEngine
vi.mock('@/lib/sound/sound-engine', () => ({
  soundEngine: {
    playChime: vi.fn(),
  },
}));

// Mock categoriesApi and labelsApi
vi.mock('@/lib/api/categories', () => ({
  categoriesApi: {
    getCategories: vi.fn().mockResolvedValue([
      { id: 'cat-1', name: 'Work', color: '#6366F1' },
    ]),
  },
}));

vi.mock('@/lib/api/labels', () => ({
  labelsApi: {
    getLabels: vi.fn().mockResolvedValue([
      { id: 'lbl-1', name: 'Important', color: '#10B981' },
    ]),
  },
}));

describe('Fix 1: CompletionModal — Skip Tagging Session Completion & Error Handling', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderModal = (props: Partial<React.ComponentProps<typeof CompletionModal>> = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <CompletionModal
          isOpen={true}
          onClose={vi.fn()}
          onConfirm={vi.fn().mockResolvedValue(undefined)}
          targetDuration={1500}
          phase="FOCUS"
          isMutating={false}
          {...props}
        />
      </QueryClientProvider>
    );
  };

  it('1. clicking Skip Tagging completes the session with empty categories, labels, and advanceToNextPhase=true', async () => {
    const onConfirmMock = vi.fn().mockResolvedValue(undefined);
    const onCloseMock = vi.fn();

    renderModal({
      onConfirm: onConfirmMock,
      onClose: onCloseMock,
    });

    const skipButton = await screen.findByRole('button', { name: /Skip Tagging/i });
    expect(skipButton).toBeInTheDocument();

    fireEvent.click(skipButton);

    await waitFor(() => {
      expect(onConfirmMock).toHaveBeenCalledTimes(1);
    });

    expect(onConfirmMock).toHaveBeenCalledWith({
      categoryIds: [],
      labelIds: [],
      notes: undefined,
      advanceToNextPhase: true,
    });

    // onClose should be called after onConfirm succeeds to dismiss the modal
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('2. repeated clicks on Skip Tagging do not create duplicate completion requests while pending', async () => {
    let resolvePromise: () => void = () => {};
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    const onConfirmMock = vi.fn().mockReturnValue(pendingPromise);

    renderModal({ onConfirm: onConfirmMock });

    const skipButton = await screen.findByRole('button', { name: /Skip Tagging/i });
    const saveButton = screen.getByRole('button', { name: /Save & Finish/i });

    // First click initiates submission
    fireEvent.click(skipButton);

    expect(onConfirmMock).toHaveBeenCalledTimes(1);

    // Buttons should now be disabled
    expect(skipButton).toBeDisabled();
    expect(saveButton).toBeDisabled();

    // Repeated clicks while pending should be ignored
    fireEvent.click(skipButton);
    fireEvent.click(skipButton);

    expect(onConfirmMock).toHaveBeenCalledTimes(1);

    // Complete the promise
    resolvePromise();
  });

  it('3. a failed API request does not show false success and displays an error banner', async () => {
    const onConfirmMock = vi.fn().mockRejectedValue(new Error('Network error: Failed to save study session'));
    const onCloseMock = vi.fn();

    renderModal({
      onConfirm: onConfirmMock,
      onClose: onCloseMock,
    });

    const skipButton = await screen.findByRole('button', { name: /Skip Tagging/i });
    fireEvent.click(skipButton);

    await waitFor(() => {
      expect(screen.getByText(/Network error: Failed to save study session/i)).toBeInTheDocument();
    });

    // Modal must NOT close or indicate false success
    expect(onCloseMock).not.toHaveBeenCalled();

    // After failure, buttons should be re-enabled so user can retry
    expect(skipButton).not.toBeDisabled();
  });

  it('4. Save & Continue also completes with chosen categories and advances timer', async () => {
    const onConfirmMock = vi.fn().mockResolvedValue(undefined);

    renderModal({ onConfirm: onConfirmMock });

    // Wait for categories to load
    const categoryButton = await screen.findByRole('button', { name: /Work/i });
    fireEvent.click(categoryButton);

    const saveButton = screen.getByRole('button', { name: /Save & Finish/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(onConfirmMock).toHaveBeenCalledTimes(1);
    });

    expect(onConfirmMock).toHaveBeenCalledWith(
      expect.objectContaining({
        categoryIds: ['cat-1'],
        advanceToNextPhase: true,
      })
    );
  });
});
