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
});
