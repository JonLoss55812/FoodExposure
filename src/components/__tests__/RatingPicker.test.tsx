import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RatingPicker } from '../RatingPicker';
import { darkTheme, lightTheme } from '../../styles/theme';
import { rgb, setMockTheme } from '../../test-utils/mock-theme';

const THEMES = [
  ['light', lightTheme],
  ['dark', darkTheme],
] as const;

describe('RatingPicker', () => {
  it('renders all rating labels', () => {
    render(<RatingPicker onChange={() => {}} />);
    expect(screen.getByText('Refused')).toBeTruthy();
    expect(screen.getByText('Reluctant')).toBeTruthy();
    expect(screen.getByText('Neutral')).toBeTruthy();
    expect(screen.getByText('Willing')).toBeTruthy();
    expect(screen.getByText('Enjoyed')).toBeTruthy();
  });

  it('calls onChange when a rating label is clicked', () => {
    const onChange = jest.fn();
    render(<RatingPicker onChange={onChange} />);
    fireEvent.click(screen.getByText('Enjoyed'));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('calls onChange with different values', () => {
    const onChange = jest.fn();
    render(<RatingPicker onChange={onChange} />);

    fireEvent.click(screen.getByText('Refused'));
    expect(onChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByText('Neutral'));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('renders with a current value selected', () => {
    render(<RatingPicker value={3} onChange={() => {}} />);
    // All five labels still render when one is the active value;
    // exercises the truthy branch of the `value === config.value`
    // ternary on the selected button + label, and the falsy branch
    // on the other four.
    expect(screen.getByText('Refused')).toBeTruthy();
    expect(screen.getByText('Reluctant')).toBeTruthy();
    expect(screen.getByText('Neutral')).toBeTruthy();
    expect(screen.getByText('Willing')).toBeTruthy();
    expect(screen.getByText('Enjoyed')).toBeTruthy();
  });

  it('still fires onChange when picking a different rating after a value is set', () => {
    const onChange = jest.fn();
    render(<RatingPicker value={2} onChange={onChange} />);
    fireEvent.click(screen.getByText('Enjoyed'));
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('exposes each chip as an accessible button labeled "Rating: <label>"', () => {
    // The Pressable carries accessibilityRole="button" + accessibilityLabel —
    // VoiceOver/TalkBack reads "Rating: Enjoyed, button" on iOS/Android, and
    // on web the chip becomes a <button aria-label="Rating: Enjoyed">.
    // accessibilityState.selected is also passed and honored natively;
    // react-native-web does not serialize selected for button role to a DOM
    // attribute, so the web harness only verifies role + label here.
    render(<RatingPicker value={3} onChange={() => {}} />);
    for (const label of ['Refused', 'Reluctant', 'Neutral', 'Willing', 'Enjoyed']) {
      const el = screen.getByLabelText(`Rating: ${label}`);
      expect(el.tagName.toLowerCase()).toBe('button');
      expect(el.getAttribute('role')).toBe('button');
    }
  });

  it('keeps each chip click wired to onChange after a11y props are added', () => {
    const onChange = jest.fn();
    render(<RatingPicker onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Rating: Reluctant'));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  describe('deselect on re-tap (optional-field clearing)', () => {
    it('clears the rating when the selected chip is tapped again', () => {
      // Rating is optional in exposureSchema — a mis-tap must be
      // reversible back to "no rating recorded", not permanently
      // attached ("Refused" reads very differently to a therapist
      // than an absent rating).
      const onChange = jest.fn();
      render(<RatingPicker value={4} onChange={onChange} />);
      fireEvent.click(screen.getByText('Willing'));
      expect(onChange).toHaveBeenCalledWith(undefined);
    });

    it('still sets a different rating when an unselected chip is tapped', () => {
      // Regression lock: the toggle must only fire on the selected
      // chip — switching between ratings stays a single tap.
      const onChange = jest.fn();
      render(<RatingPicker value={4} onChange={onChange} />);
      fireEvent.click(screen.getByText('Refused'));
      expect(onChange).toHaveBeenCalledWith(1);
    });

    it('sets normally when no rating is selected yet', () => {
      const onChange = jest.fn();
      render(<RatingPicker onChange={onChange} />);
      fireEvent.click(screen.getByText('Neutral'));
      expect(onChange).toHaveBeenCalledWith(3);
    });
  });

  // As with ChildSelector: the selected state is not in the DOM, its style is.
  describe('theme', () => {
    afterEach(() => setMockTheme('light'));

    it.each(THEMES)('paints selected and unselected ratings with the %s tokens', (name, theme) => {
      setMockTheme(name);
      render(<RatingPicker value={4} onChange={() => {}} />);
      const selected = getComputedStyle(screen.getByLabelText('Rating: Willing'));
      expect({
        selectedBackground: selected.backgroundColor,
        selectedBorder: selected.borderTopColor,
        selectedLabel: getComputedStyle(screen.getByText('Willing')).color,
        otherBackground: getComputedStyle(screen.getByLabelText('Rating: Neutral')).backgroundColor,
        otherLabel: getComputedStyle(screen.getByText('Neutral')).color,
      }).toEqual({
        selectedBackground: rgb(theme.colors.primaryLight),
        selectedBorder: rgb(theme.colors.primary),
        selectedLabel: rgb(theme.colors.primaryStrong),
        otherBackground: rgb(theme.colors.surface),
        otherLabel: rgb(theme.colors.textSecondary),
      });
    });
  });
});
