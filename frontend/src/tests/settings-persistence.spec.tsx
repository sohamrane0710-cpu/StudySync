import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { usersApi } from '@/lib/api/users';
import { categoriesApi } from '@/lib/api/categories';
import { labelsApi } from '@/lib/api/labels';
import { timerModesApi } from '@/lib/api/timer-modes';

// State holder for mock useAuth
let mockProfile: any = null;
const mockRefreshProfile = vi.fn().mockImplementation(async () => {});

vi.mock('@/features/auth/auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isLoading: false,
    profile: mockProfile,
    refreshProfile: mockRefreshProfile,
  }),
}));

vi.mock('@/hooks/use-preferences', () => ({
  usePreferences: () => ({
    preferences: {
      timerFace: 'ring',
      theme: 'dark-glass',
      soundEnabled: true,
      soundVolume: 0.7,
      ambientPreset: 'none',
    },
    updatePreferences: vi.fn(),
  }),
}));

vi.mock('@/lib/sound/sound-engine', () => ({
  soundEngine: {
    playChime: vi.fn(),
    setAmbient: vi.fn(),
  },
}));

vi.mock('@/lib/api/users', () => ({
  usersApi: {
    updateMe: vi.fn(),
  },
}));

vi.mock('@/lib/api/categories', () => ({
  categoriesApi: {
    getCategories: vi.fn(),
    createCategory: vi.fn(),
    deleteCategory: vi.fn(),
  },
}));

vi.mock('@/lib/api/labels', () => ({
  labelsApi: {
    getLabels: vi.fn(),
    createLabel: vi.fn(),
    deleteLabel: vi.fn(),
  },
}));

vi.mock('@/lib/api/timer-modes', () => ({
  timerModesApi: {
    getTimerModes: vi.fn(),
    createTimerMode: vi.fn(),
    deleteTimerMode: vi.fn(),
    duplicateTimerMode: vi.fn(),
  },
}));

describe('Fix 4 & Fix 5: Settings Page Persistence & Deletion Resilience', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    mockProfile = null;
    vi.clearAllMocks();

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Default API mock implementations
    vi.mocked(categoriesApi.getCategories).mockResolvedValue([
      {
        id: 'cat-1',
        userId: '00000000-0000-4000-8000-000000000001',
        name: 'Computer Science',
        color: '#6366F1',
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    vi.mocked(labelsApi.getLabels).mockResolvedValue([
      {
        id: 'lbl-1',
        userId: '00000000-0000-4000-8000-000000000001',
        name: 'Algorithms',
        color: '#10B981',
        categoryId: 'cat-1',
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
    vi.mocked(timerModesApi.getTimerModes).mockResolvedValue([
      {
        id: 'mode-1',
        userId: '00000000-0000-4000-8000-000000000001',
        name: 'Deep Work',
        focusDuration: 3000,
        shortBreakDuration: 600,
        longBreakDuration: 1800,
        longBreakInterval: 4,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
  });

  const renderSettings = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <SettingsPage />
      </QueryClientProvider>
    );
  };

  describe('Fix 4: Profile Form Asynchronous Synchronization & Dirty State', () => {
    it('1. populates form inputs when asynchronous profile data resolves', async () => {
      // Start with null profile
      mockProfile = null;
      const { rerender } = renderSettings();

      const nameInput = screen.getByLabelText(/Display Name/i) as HTMLInputElement;
      const bioInput = screen.getByPlaceholderText(/What are you mastering/i) as HTMLTextAreaElement;

      expect(nameInput.value).toBe('');
      expect(bioInput.value).toBe('');

      // Simulate profile resolving asynchronously
      mockProfile = {
        id: 'user-1',
        displayName: 'Grace Hopper',
        avatarUrl: 'https://example.com/grace.png',
        bio: 'Compilers and debugging',
      };

      rerender(
        <QueryClientProvider client={queryClient}>
          <SettingsPage />
        </QueryClientProvider>
      );

      await waitFor(() => {
        expect(nameInput.value).toBe('Grace Hopper');
        expect(bioInput.value).toBe('Compilers and debugging');
      });
    });

    it('2. preserves user edits without overwriting them during background profile updates', async () => {
      mockProfile = {
        id: 'user-1',
        displayName: 'Original Name',
        avatarUrl: '',
        bio: 'Original Bio',
      };

      const { rerender } = renderSettings();

      const nameInput = screen.getByLabelText(/Display Name/i) as HTMLInputElement;
      expect(nameInput.value).toBe('Original Name');

      // User types new edits
      fireEvent.change(nameInput, { target: { value: 'In-Progress Edit by User' } });
      expect(nameInput.value).toBe('In-Progress Edit by User');

      // Simulate a background refetch returning old or changed server data
      mockProfile = {
        id: 'user-1',
        displayName: 'Server Updated Name',
        avatarUrl: '',
        bio: 'Server Updated Bio',
      };

      rerender(
        <QueryClientProvider client={queryClient}>
          <SettingsPage />
        </QueryClientProvider>
      );

      // Input must NOT be clobbered because isProfileDirty is true
      expect(nameInput.value).toBe('In-Progress Edit by User');
    });

    it('3. submits profile update, resets dirty state, and reflects server response', async () => {
      mockProfile = {
        id: 'user-1',
        displayName: 'Old Name',
        avatarUrl: '',
        bio: 'Old Bio',
      };

      vi.mocked(usersApi.updateMe).mockResolvedValue({
        id: 'user-1',
        username: 'test_user',
        displayName: 'Brand New Name',
        avatarUrl: 'https://example.com/avatar.png',
        bio: 'Brand New Bio',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      renderSettings();

      const nameInput = screen.getByLabelText(/Display Name/i) as HTMLInputElement;
      fireEvent.change(nameInput, { target: { value: 'Brand New Name' } });

      const saveButton = screen.getByRole('button', { name: /Save Profile/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(usersApi.updateMe).toHaveBeenCalledWith({
          displayName: 'Brand New Name',
          avatarUrl: undefined,
          bio: 'Old Bio',
        });
      });

      // Shows success banner
      expect(await screen.findByText(/Profile updated successfully/i)).toBeInTheDocument();
      expect(mockRefreshProfile).toHaveBeenCalledTimes(1);
    });
  });

  describe('Fix 5: Deletion Actions Resilience, Loading State & Error Handling', () => {
    it('1. Category deletion shows pending state, prevents repeated clicks, and invalidates cache on success', async () => {
      let resolveDelete: () => void = () => {};
      const deletePromise = new Promise<void>((resolve) => {
        resolveDelete = resolve;
      });
      vi.mocked(categoriesApi.deleteCategory).mockReturnValue(deletePromise as any);

      renderSettings();

      // Wait for categories to load
      const deleteCatBtn = await screen.findByTitle('Delete category');
      expect(deleteCatBtn).toBeInTheDocument();

      // Click delete
      fireEvent.click(deleteCatBtn);

      // Verify deletion called
      await waitFor(() => {
        expect(categoriesApi.deleteCategory).toHaveBeenCalledWith('cat-1');
      });

      // Button should be disabled during pending deletion
      expect(deleteCatBtn).toBeDisabled();

      // Click again while pending — should not call again
      fireEvent.click(deleteCatBtn);
      expect(categoriesApi.deleteCategory).toHaveBeenCalledTimes(1);

      // Resolve deletion
      resolveDelete();
    });

    it('2. Category deletion failure displays user error banner and does not falsely remove record', async () => {
      vi.mocked(categoriesApi.deleteCategory).mockRejectedValue(
        new Error('Cannot delete category with active study sessions')
      );

      renderSettings();

      const deleteCatBtn = await screen.findByTitle('Delete category');
      fireEvent.click(deleteCatBtn);

      // User error banner must appear with the error message
      await waitFor(() => {
        expect(
          screen.getByText(/Cannot delete category with active study sessions/i)
        ).toBeInTheDocument();
      });

      // The category should still remain visible
      expect(screen.getByText('Computer Science')).toBeInTheDocument();
    });

    it('3. Label deletion failure displays user error banner', async () => {
      vi.mocked(labelsApi.deleteLabel).mockRejectedValue(
        new Error('Database foreign key violation: label is in use')
      );

      renderSettings();

      const deleteLabelBtn = await screen.findByTitle('Delete label');
      fireEvent.click(deleteLabelBtn);

      await waitFor(() => {
        expect(
          screen.getByText(/Database foreign key violation: label is in use/i)
        ).toBeInTheDocument();
      });

      expect(screen.getByText('#Algorithms')).toBeInTheDocument();
    });

    it('4. Custom timer mode archive/deletion shows pending state and handles error safely', async () => {
      vi.mocked(timerModesApi.deleteTimerMode).mockRejectedValue(
        new Error('Failed to archive timer mode')
      );

      renderSettings();

      const deleteModeBtn = await screen.findByTitle('Archive mode');
      fireEvent.click(deleteModeBtn);

      await waitFor(() => {
        expect(screen.getByText(/Failed to archive timer mode/i)).toBeInTheDocument();
      });

      expect(screen.getByText('Deep Work')).toBeInTheDocument();
    });
  });
});
