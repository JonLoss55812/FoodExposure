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

  it('hides text labels at sm size (icon-only mode)', () => {
    // sm size renders the icon dots but suppresses the label <Text>. This
    // is the compact variant used in places like food cards / list rows
    // where horizontal space is at a premium.
    render(<StageIndicator size="sm" currentStage="taste" />);
    for (const label of ['Tolerate', 'Interact', 'Smell', 'Touch', 'Taste', 'Eat']) {
      expect(screen.queryByText(label)).toBeNull();
    }
    // The icons themselves are still rendered.
    expect(screen.getByText('👁️')).toBeTruthy(); // tolerate icon
    expect(screen.getByText('😋')).toBeTruthy(); // eat icon
  });

  it('does not wrap dots in a Pressable when interactive=true but no onStageSelect handler is provided', () => {
    // Defensive contract: the component only adds a clickable wrapper when
    // BOTH interactive=true AND onStageSelect is provided. Without a
    // handler there is nothing to fire, so wrapping in Pressable would
    // create a dead button. Lock this so a future "always wrap if
    // interactive" refactor can't silently change the behavior.
    render(<StageIndicator interactive size="md" />);
    // No element with role="button" should be present.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('does not wrap dots in a Pressable when interactive=false even if onStageSelect is provided', () => {
    // Symmetric to the previous test: handler alone is not enough; the
    // caller must opt in via interactive=true.
    const onSelect = jest.fn();
    render(<StageIndicator size="md" onStageSelect={onSelect} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    // And clicking the dot's text does not call the handler.
    fireEvent.click(screen.getByText('Eat'));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('renders all 6 stages including those past currentStage (inactive segments still visible)', () => {
    // Contract: a child at "smell" stage on a food still sees the
    // touch/taste/eat dots — the hierarchy is the goal, not just history.
    // If a future refactor accidentally clipped to currentIndex+1, the
    // higher-stage segments would disappear and the parent would lose
    // sight of where they're heading.
    render(<StageIndicator currentStage="smell" size="md" />);
    for (const label of ['Tolerate', 'Interact', 'Smell', 'Touch', 'Taste', 'Eat']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('does not crash when currentStage is undefined (no stage reached yet)', () => {
    // Initial state for a freshly-added food: no exposures yet, so the
    // detail page passes currentStage={undefined}. currentIndex resolves
    // to -1 and isActive (index <= -1) is false for all dots — every
    // segment renders in the inactive style.
    const { container } = render(<StageIndicator size="md" />);
    expect(container).toBeTruthy();
    expect(screen.getByText('Tolerate')).toBeTruthy();
    expect(screen.getByText('Eat')).toBeTruthy();
  });
});
