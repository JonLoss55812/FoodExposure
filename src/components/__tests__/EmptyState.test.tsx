import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../EmptyState';
import { darkTheme, lightTheme } from '../../styles/theme';
import { rgb, setMockTheme } from '../../test-utils/mock-theme';

const THEMES = [
  ['light', lightTheme],
  ['dark', darkTheme],
] as const;

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState icon="X" title="No Foods" description="Add some foods" />);
    expect(screen.getByText('No Foods')).toBeTruthy();
    expect(screen.getByText('Add some foods')).toBeTruthy();
  });

  it('renders action button when provided', () => {
    const onAction = jest.fn();
    render(
      <EmptyState
        icon="X"
        title="No Foods"
        description="Add some foods"
        actionLabel="Add Food"
        onAction={onAction}
      />
    );
    const button = screen.getByText('Add Food');
    expect(button).toBeTruthy();
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('announces the action button to assistive tech via role + label', () => {
    const onAction = jest.fn();
    render(
      <EmptyState
        icon="X"
        title="No Foods"
        description="Add some foods"
        actionLabel="Add Food"
        onAction={onAction}
      />
    );
    const button = screen.getByLabelText('Add Food');
    expect(button.getAttribute('role')).toBe('button');
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when no actionLabel', () => {
    render(<EmptyState icon="X" title="No Foods" description="Add some foods" />);
    expect(screen.queryByText('Add Food')).toBeNull();
  });

  // Module-level StyleSheet.create factory: the path that froze in light mode
  // in the jest mock before v0.5.239. Each case pairs with its other theme, so
  // a colour hardcoded to either token fails one of them.
  describe('theme', () => {
    afterEach(() => setMockTheme('light'));

    it.each(THEMES)('paints text and the action with the %s tokens', (name, theme) => {
      setMockTheme(name);
      render(
        <EmptyState icon="X" title="No Foods" description="Add some" actionLabel="Add Food" onAction={() => {}} />
      );
      expect({
        title: getComputedStyle(screen.getByText('No Foods')).color,
        description: getComputedStyle(screen.getByText('Add some')).color,
        button: getComputedStyle(screen.getByLabelText('Add Food')).backgroundColor,
        buttonLabel: getComputedStyle(screen.getByText('Add Food')).color,
      }).toEqual({
        title: rgb(theme.colors.text),
        description: rgb(theme.colors.textSecondary),
        button: rgb(theme.colors.primaryStrong),
        buttonLabel: rgb(theme.colors.onPrimaryStrong),
      });
    });
  });
});
