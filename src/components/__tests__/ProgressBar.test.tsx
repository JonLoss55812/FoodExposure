import React from 'react';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from '../ProgressBar';

describe('ProgressBar', () => {
  it('renders with label showing current/target', () => {
    render(<ProgressBar current={5} target={15} />);
    expect(screen.getByText('5/15')).toBeTruthy();
  });

  it('hides label when showLabel is false', () => {
    render(<ProgressBar current={5} target={15} showLabel={false} />);
    expect(screen.queryByText('5/15')).toBeNull();
  });

  it('uses default target of 15', () => {
    render(<ProgressBar current={10} />);
    expect(screen.getByText('10/15')).toBeTruthy();
  });

  it('renders the fill bar', () => {
    const { container } = render(<ProgressBar current={7} target={14} />);
    // Just verify it renders without crashing
    expect(container).toBeTruthy();
  });
});
