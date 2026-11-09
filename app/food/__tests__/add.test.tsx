/**
 * Screen tests for `app/food/add.tsx` (NEXT_STEPS gap #1).
 *
 * Built on the v0.5.146 harness (`createMockDb` + the documented seams).
 * The load-bearing untested logic here is the v0.5.136 duplicate-name guard:
 * a second `foods` row for the same food silently splits the per-food
 * exposure count that the 15/20/30 acceptance threshold is read from, and
 * the split is invisible until it can no longer be fixed cheaply. The guard
 * shipped screen-level and therefore unverified.
 *
 * See `app/onboarding/__tests__/join.test.tsx` for the seam rationale, and
 * NEXT_STEPS gap #1 for the harness gotchas (mock-prefixed router variable,
 * getter-based db mock, `getByLabelText` + `fireEvent.change`).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';
import { createMockDb, type MockDb } from '@/src/test-utils/mock-db';
import { pressAlertButton } from '@/src/test-utils/screen-helpers';

const mockRouter = { replace: jest.fn(), back: jest.fn(), push: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

let mockDb: MockDb;
jest.mock('@/src/db/client', () => ({
  get db() {
    return mockDb.db;
  },
}));

import AddFoodScreen from '../add';
import { useAuthStore } from '@/src/stores/auth-store';
import { darkTheme, lightTheme } from '@/src/styles/theme';
import { rgb, rgba, setMockTheme } from '@/src/test-utils/mock-theme';

const THEMES = [
  ['light', lightTheme],
  ['dark', darkTheme],
] as const;

function typeName(value: string) {
  fireEvent.change(screen.getByLabelText('Food name'), { target: { value } });
}

function tapAdd() {
  fireEvent.click(screen.getByLabelText('Add Food'));
}

describe('AddFoodScreen', () => {
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    mockDb = createMockDb();
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    useAuthStore.getState().logout();
    useAuthStore.getState().login({
      userId: 'user-1',
      familyId: 'fam-1',
      email: 'anne@tonguetutor.app',
      displayName: 'Anne',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the name field, the category grid and the submit action', () => {
    render(<AddFoodScreen />);
    expect(screen.getByLabelText('Food name')).toBeTruthy();
    expect(screen.getByLabelText('Category: Fruit')).toBeTruthy();
    expect(screen.getByLabelText('Add Food')).toBeTruthy();
  });

  it('gives the header Cancel link a 44pt tap target', () => {
    // The header link is text-only; the min-height makes its tap target 44pt
    // rather than the ~20px line of text (react-native-web ignores hitSlop).
    render(<AddFoodScreen />);
    expect(getComputedStyle(screen.getByLabelText('Cancel and go back')).minHeight).toBe('44px');
  });

  it('rejects a whitespace-only name through the schema and issues no query', async () => {
    render(<AddFoodScreen />);
    typeName('   ');
    tapAdd();

    // foodSchema.name is `.trim().min(1)` (v0.5.75) — the guard belongs to the
    // schema, so the screen must not reach the database at all.
    await waitFor(() => expect(screen.getByText('Food name is required')).toBeTruthy());
    expect(mockDb.selectCount()).toBe(0);
    expect(mockDb.writes).toHaveLength(0);
  });

  it('blocks a case-insensitive duplicate, names the existing row, and writes nothing', async () => {
    mockDb.queueSelect([{ id: 'food-1', name: 'Apple' }]);
    render(<AddFoodScreen />);
    typeName('apple');
    tapAdd();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Already Added');
    // Naming the colliding row is what points the parent at the real next
    // action (log an exposure on the existing food) instead of a dead end.
    expect(alertSpy.mock.calls[0][1]).toContain('Apple');
    expect(mockDb.writes).toHaveLength(0);
  });

  it('blocks a duplicate that differs only by surrounding whitespace', async () => {
    mockDb.queueSelect([{ id: 'food-1', name: 'Broccoli' }]);
    render(<AddFoodScreen />);
    typeName('  Broccoli  ');
    tapAdd();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Already Added');
    expect(mockDb.writes).toHaveLength(0);
  });

  it('inserts the trimmed name scoped to the family when there is no collision', async () => {
    mockDb.queueSelect([{ id: 'food-1', name: 'Apple' }]);
    render(<AddFoodScreen />);
    typeName('  Pear  ');
    tapAdd();

    await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    const write = mockDb.writes[0] as { kind: string; values: Record<string, unknown> };
    expect(write.kind).toBe('insert');
    expect(write.values.name).toBe('Pear');
    expect(write.values.familyId).toBe('fam-1');
    expect(write.values.category).toBe('other');
    expect(write.values.isSafeFood).toBe(false);
    expect(write.values.defaultPreparation).toBeNull();
    expect(alertSpy.mock.calls[0][0]).toBe('Added!');
  });

  it('persists the selected category and the safe-food flag', async () => {
    render(<AddFoodScreen />);
    typeName('Yogurt');
    fireEvent.click(screen.getByLabelText('Category: Dairy'));
    fireEvent.click(screen.getByLabelText('Mark as safe food'));
    tapAdd();

    await waitFor(() => expect(mockDb.writes).toHaveLength(1));
    const write = mockDb.writes[0] as { kind: string; values: Record<string, unknown> };
    expect(write.values.category).toBe('dairy');
    expect(write.values.isSafeFood).toBe(true);
  });

  it('clears the form when the parent chooses Add Another', async () => {
    render(<AddFoodScreen />);
    typeName('Pear');
    fireEvent.click(screen.getByLabelText('Category: Dairy'));
    tapAdd();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    // v0.5.16: batch-adding foods must not require deleting the previous name.
    await pressAlertButton(alertSpy, 'Add Another');

    await waitFor(() =>
      expect((screen.getByLabelText('Food name') as HTMLInputElement).value).toBe(''),
    );
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('navigates back when the parent chooses Done', async () => {
    render(<AddFoodScreen />);
    typeName('Pear');
    tapAdd();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    await pressAlertButton(alertSpy, 'Done');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('alerts and writes nothing when the duplicate lookup fails', async () => {
    mockDb.failReads();
    render(<AddFoodScreen />);
    typeName('Pear');
    tapAdd();

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    expect(alertSpy.mock.calls[0][0]).toBe('Error');
    // A failed read must not fall through to the insert — that would be a
    // back door around the duplicate guard on exactly the flaky path.
    expect(mockDb.writes).toHaveLength(0);
  });

  it('releases the in-flight latch after a failure so a retry re-queries', async () => {
    mockDb.failReads();
    render(<AddFoodScreen />);
    typeName('Pear');
    tapAdd();
    await waitFor(() => expect(mockDb.selectCount()).toBe(1));

    tapAdd();
    await waitFor(() => expect(mockDb.selectCount()).toBe(2));
  });

  // Add Food opens from the Foods tab and the Log tab's empty state, so a light
  // token left here would flash white in dark mode. 'Other' starts selected and
  // Fruit does not, so both category states are pinned without a tap; the
  // preparation chip and the safe toggle are pinned off, then tapped and pinned
  // on (the toggle's on state is the `success + '10'` tint).
  describe('theme', () => {
    afterEach(() => setMockTheme('light'));

    it.each(THEMES)('paints the form with the %s tokens', async (name, theme) => {
      setMockTheme(name);
      render(<AddFoodScreen />);

      // The submit button is also labelled 'Add Food'; the title renders first.
      const title = screen.getAllByText('Add Food')[0];
      // The first ancestor of the title that paints a background is the screen.
      let container = title.parentElement!;
      const unpainted = ['', 'rgba(0, 0, 0, 0)'];
      while (unpainted.includes(getComputedStyle(container).backgroundColor)) {
        container = container.parentElement!;
      }
      const color = (text: string | RegExp) => getComputedStyle(screen.getByText(text)).color;
      const box = (label: string) => {
        const style = getComputedStyle(screen.getByLabelText(label));
        return { background: style.backgroundColor, border: style.borderTopColor };
      };
      const nameInput = screen.getByLabelText('Food name');
      const inputStyle = getComputedStyle(nameInput);
      const c = theme.colors;
      expect({
        background: getComputedStyle(container).backgroundColor,
        cancel: color('Cancel'),
        title: getComputedStyle(title).color,
        label: color('Food Name'),
        input: {
          background: inputStyle.backgroundColor,
          color: inputStyle.color,
          border: inputStyle.borderTopColor,
          placeholder: nameInput.style.getPropertyValue('--placeholderTextColor'),
        },
        selectedCategory: box('Category: Other'),
        selectedCategoryText: color('Other'),
        category: getComputedStyle(screen.getByLabelText('Category: Fruit')).backgroundColor,
        categoryText: color('Fruit'),
        chip: box('Preparation: Raw'),
        chipText: color('Raw'),
        safeToggle: box('Mark as safe food'),
        safeTitle: color('Safe Food'),
        safeDesc: color('A food your child already accepts and enjoys'),
      }).toEqual({
        background: rgb(c.background),
        cancel: rgb(c.primaryStrong),
        title: rgb(c.text),
        label: rgb(c.text),
        input: {
          background: rgb(c.inputBackground),
          color: rgb(c.text),
          border: rgb(c.border),
          // react-native-web passes placeholderTextColor through unconverted.
          placeholder: c.textTertiary,
        },
        selectedCategory: { background: rgb(c.primaryLight), border: rgb(c.primary) },
        selectedCategoryText: rgb(c.primaryStrong),
        category: rgb(c.surface),
        categoryText: rgb(c.textSecondary),
        chip: { background: rgb(c.surface), border: rgb(c.border) },
        chipText: rgb(c.textSecondary),
        safeToggle: { background: rgb(c.surface), border: rgb(c.border) },
        safeTitle: rgb(c.text),
        safeDesc: rgb(c.textSecondary),
      });

      fireEvent.click(screen.getByLabelText('Preparation: Raw'));
      fireEvent.click(screen.getByLabelText('Mark as safe food'));
      tapAdd();
      await waitFor(() => expect(screen.getByText('Food name is required')).toBeTruthy());
      expect({
        selectedChip: box('Preparation: Raw'),
        selectedChipText: color('Raw'),
        safeToggle: box('Mark as safe food'),
        error: color('Food name is required'),
      }).toEqual({
        selectedChip: { background: rgb(c.primaryLight), border: rgb(c.primary) },
        selectedChipText: rgb(c.primaryStrong),
        safeToggle: { background: rgba(c.success, '10'), border: rgb(c.success) },
        error: rgb(c.error),
      });
    });
  });
});
