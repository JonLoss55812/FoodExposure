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

  it('renders at 0% without crashing', () => {
    const { container } = render(<ProgressBar current={0} target={15} />);
    expect(screen.getByText('0/15')).toBeTruthy();
    expect(container).toBeTruthy();
  });

  it('renders at exactly 100% without crashing', () => {
    const { container } = render(<ProgressBar current={15} target={15} />);
    expect(screen.getByText('15/15')).toBeTruthy();
    expect(container).toBeTruthy();
  });

  it('renders past-threshold (>100%) without crashing and shows actual count', () => {
    const { container } = render(<ProgressBar current={22} target={15} />);
    // Label shows the real current count, even though the bar clamps visually
    expect(screen.getByText('22/15')).toBeTruthy();
    expect(container).toBeTruthy();
  });
});
