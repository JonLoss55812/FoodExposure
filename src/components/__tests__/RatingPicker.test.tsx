import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RatingPicker } from '../RatingPicker';

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
});
