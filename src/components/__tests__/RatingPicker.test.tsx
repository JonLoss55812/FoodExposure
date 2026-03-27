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
});
