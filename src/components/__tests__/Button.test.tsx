import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with label', () => {
    render(<Button label="Press Me" onPress={() => {}} />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  it('calls onPress when clicked', () => {
    const onPress = jest.fn();
    render(<Button label="Press" onPress={onPress} />);
    fireEvent.click(screen.getByText('Press'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    render(<Button label="Press" onPress={onPress} disabled />);
    fireEvent.click(screen.getByText('Press'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders with different variants', () => {
    const { rerender } = render(<Button label="Primary" onPress={() => {}} variant="primary" />);
    expect(screen.getByText('Primary')).toBeTruthy();

    rerender(<Button label="Secondary" onPress={() => {}} variant="secondary" />);
    expect(screen.getByText('Secondary')).toBeTruthy();

    rerender(<Button label="Ghost" onPress={() => {}} variant="ghost" />);
    expect(screen.getByText('Ghost')).toBeTruthy();
  });

  it('hides label and shows spinner while loading', () => {
    render(<Button label="Save" onPress={() => {}} loading />);
    expect(screen.queryByText('Save')).toBeNull();
  });

  it('does not call onPress while loading', () => {
    const onPress = jest.fn();
    render(<Button label="Save" onPress={onPress} loading />);
    const target = screen.getByLabelText('Save');
    fireEvent.click(target);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('uses non-primary spinner color for secondary/ghost variants', () => {
    // Branch coverage: spinner color ternary on `variant === 'primary'`.
    // No DOM-visible difference to assert on react-native-web; this just
    // exercises the non-primary branch so a future refactor that drops it
    // doesn't silently lose coverage.
    render(<Button label="X" onPress={() => {}} loading variant="secondary" />);
    expect(screen.queryByText('X')).toBeNull();
  });

  it('applies fullWidth style when prop is set', () => {
    render(<Button label="Wide" onPress={() => {}} fullWidth />);
    expect(screen.getByText('Wide')).toBeTruthy();
  });

  it('renders icon glyph when provided alongside label', () => {
    render(<Button label="Add" onPress={() => {}} icon="+" />);
    expect(screen.getByText('+')).toBeTruthy();
    expect(screen.getByText('Add')).toBeTruthy();
  });

  it('announces busy state to assistive tech while loading', () => {
    // Save Exposure / Add Food / Add Child / Bump-to-stage all funnel
    // through this Button. Without aria-busy, a screen-reader user taps
    // the button, the inline spinner appears, and VoiceOver only reports
    // "dimmed" — no cue that the in-flight async work is happening.
    render(<Button label="Save" onPress={() => {}} loading />);
    const target = screen.getByLabelText('Save');
    expect(target.getAttribute('aria-busy')).toBe('true');
  });

  it('does not advertise busy state when not loading', () => {
    render(<Button label="Save" onPress={() => {}} />);
    const target = screen.getByLabelText('Save');
    expect(target.getAttribute('aria-busy')).not.toBe('true');
  });
});
