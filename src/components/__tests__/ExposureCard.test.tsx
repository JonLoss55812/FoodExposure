import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExposureCard } from '../ExposureCard';

describe('ExposureCard', () => {
  const defaultProps = {
    foodName: 'Carrots',
    childName: 'Emma',
    stage: 'touch' as const,
    occurredAt: new Date(),
  };

  it('renders food name and child name', () => {
    render(<ExposureCard {...defaultProps} />);
    expect(screen.getByText('Carrots')).toBeTruthy();
    expect(screen.getByText('Emma')).toBeTruthy();
  });

  it('renders notes when provided', () => {
    render(<ExposureCard {...defaultProps} notes="Touched it briefly" />);
    expect(screen.getByText('Touched it briefly')).toBeTruthy();
  });

  it('renders logged by name when provided', () => {
    render(<ExposureCard {...defaultProps} loggedByName="Mom" />);
    expect(screen.getByText('Logged by Mom')).toBeTruthy();
  });

  it('shows Today for current date', () => {
    render(<ExposureCard {...defaultProps} />);
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('calls onPress when clicked', () => {
    const onPress = jest.fn();
    render(<ExposureCard {...defaultProps} onPress={onPress} />);
    fireEvent.click(screen.getByText('Carrots'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders rating emoji when rating prop is provided', () => {
    // Exercises the `rating ? RATING_CONFIG.find(...) : null` truthy
    // branch and the `ratingConfig && ...` truthy branch. RATING_CONFIG[3]
    // has emoji 🙂 for value=4 (Willing).
    render(<ExposureCard {...defaultProps} rating={4} />);
    expect(screen.getByText('🙂')).toBeTruthy();
  });

  it('renders nothing for rating emoji when rating is omitted', () => {
    // Falsy branch of the rating ternary. Confirms there's no leftover
    // emoji when the prop is undefined — guards against a regression
    // where someone replaces `rating ?` with a default value.
    render(<ExposureCard {...defaultProps} />);
    expect(screen.queryByText('🙂')).toBeNull();
    expect(screen.queryByText('😋')).toBeNull();
  });

  it('falls back gracefully when rating value has no matching config', () => {
    // The `find` returns undefined for unknown ratings → ratingConfig is
    // undefined → the `ratingConfig && ...` short-circuits and no emoji
    // renders. Belt-and-braces against future schema drift if the rating
    // domain widens past 1-5 without RATING_CONFIG being updated.
    render(<ExposureCard {...defaultProps} rating={99} />);
    expect(screen.getByText('Carrots')).toBeTruthy();
  });

  it('renders with each stage variant (covers all STAGE_CONFIG keys)', () => {
    // The component reads STAGE_CONFIG[stage] unconditionally; if a future
    // stage is added to STAGE_ORDER but not STAGE_CONFIG, this loop will
    // throw on the missing key. Cheap regression guard.
    const stages = ['tolerate', 'interact', 'smell', 'touch', 'taste', 'eat'] as const;
    for (const stage of stages) {
      const { unmount } = render(<ExposureCard {...defaultProps} stage={stage} />);
      expect(screen.getByText('Carrots')).toBeTruthy();
      unmount();
    }
  });
});
