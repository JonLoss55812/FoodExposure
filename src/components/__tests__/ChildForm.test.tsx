/**
 * Theme coverage for `ChildForm`, the last component in `src/components/`
 * without a dark-mode render test (NEXT_STEPS C9). Its behaviour — validation,
 * the insert/update, the `selectChild` repair — is covered through its hosts
 * in `app/child/__tests__/` and `app/onboarding/__tests__/`; this file pins
 * only the colours, which those screen tests never look at.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { createMockDb, type MockDb } from '@/src/test-utils/mock-db';
import { darkTheme, lightTheme } from '../../styles/theme';
import { rgb, setMockTheme } from '../../test-utils/mock-theme';

let mockDb: MockDb;
jest.mock('@/src/db/client', () => ({
  get db() {
    return mockDb.db;
  },
}));

import { ChildForm } from '../ChildForm';

const THEMES = [
  ['light', lightTheme],
  ['dark', darkTheme],
] as const;

describe('ChildForm', () => {
  beforeEach(() => {
    mockDb = createMockDb();
  });

  // accessibilityState.selected does not reach the DOM under react-native-web,
  // but the selected avatar's style does, so this also pins the highlight.
  describe('theme', () => {
    afterEach(() => setMockTheme('light'));

    it.each(THEMES)('paints labels, avatars and inputs with the %s tokens', (name, theme) => {
      setMockTheme(name);
      render(<ChildForm submitLabel="Add Child" onSaved={() => {}} />);
      const selected = getComputedStyle(screen.getByLabelText('Avatar: 👶'));
      const other = getComputedStyle(screen.getByLabelText('Avatar: 👧'));
      const input = getComputedStyle(screen.getByLabelText("Child's name"));
      expect({
        label: getComputedStyle(screen.getByText('Avatar')).color,
        selectedBackground: selected.backgroundColor,
        selectedBorder: selected.borderTopColor,
        otherBackground: other.backgroundColor,
        inputBackground: input.backgroundColor,
        inputText: input.color,
        inputBorder: input.borderTopColor,
      }).toEqual({
        label: rgb(theme.colors.text),
        selectedBackground: rgb(theme.colors.primaryLight),
        selectedBorder: rgb(theme.colors.primary),
        otherBackground: rgb(theme.colors.surface),
        inputBackground: rgb(theme.colors.inputBackground),
        inputText: rgb(theme.colors.text),
        inputBorder: rgb(theme.colors.border),
      });
    });

    it.each(THEMES)('paints a validation error with the %s error token', async (name, theme) => {
      setMockTheme(name);
      render(<ChildForm submitLabel="Add Child" onSaved={() => {}} />);
      await act(async () => {
        fireEvent.click(screen.getByLabelText('Add Child'));
      });
      const error = await screen.findByText('Name is required');
      expect(getComputedStyle(error).color).toBe(rgb(theme.colors.error));
      expect(mockDb.writes).toHaveLength(0);
    });
  });
});
