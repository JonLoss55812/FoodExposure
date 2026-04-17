import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { StageIndicator } from '../StageIndicator';

describe('StageIndicator', () => {
  it('renders stage labels', () => {
    render(<StageIndicator size="md" />);
    expect(screen.getByText('Tolerate')).toBeTruthy();
    expect(screen.getByText('Interact')).toBeTruthy();
    expect(screen.getByText('Smell')).toBeTruthy();
    expect(screen.getByText('Touch')).toBeTruthy();
    expect(screen.getByText('Taste')).toBeTruthy();
    expect(screen.getByText('Eat')).toBeTruthy();
  });

  it('calls onStageSelect when interactive and clicked', () => {
    const onSelect = jest.fn();
    render(<StageIndicator interactive onStageSelect={onSelect} size="md" />);
    fireEvent.click(screen.getByText('Taste'));
    expect(onSelect).toHaveBeenCalledWith('taste');
  });

  it('renders without crashing when no props', () => {
    const { container } = render(<StageIndicator />);
    expect(container).toBeTruthy();
  });

  it('exposes all 6 stages as selectable segments when interactive at lg size (log form context)', () => {
    const onSelect = jest.fn();
    render(<StageIndicator interactive onStageSelect={onSelect} size="lg" />);

    for (const label of ['Tolerate', 'Interact', 'Smell', 'Touch', 'Taste', 'Eat']) {
      expect(screen.getByText(label)).toBeTruthy();
    }

    fireEvent.click(screen.getByText('Tolerate'));
    fireEvent.click(screen.getByText('Eat'));
    expect(onSelect).toHaveBeenNthCalledWith(1, 'tolerate');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'eat');
  });
});
