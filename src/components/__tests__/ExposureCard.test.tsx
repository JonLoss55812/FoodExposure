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

  it('exposes role=button and an a11y label when onPress is provided', () => {
    // Without role+label, a screen-reader user navigating the dashboard
    // recently-logged list hears each card as separate text nodes (food
    // name, child name, "Today") with no anchor that the row is tappable.
    // Mirror the v0.5.24 FoodCard pattern: name-bearing label so the SR
    // announces "Open Carrots details, button" as the highlight lands.
    const onPress = jest.fn();
    render(<ExposureCard {...defaultProps} onPress={onPress} />);
    const button = screen.getByLabelText('Open Carrots details');
    expect(button).toBeTruthy();
    fireEvent.click(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('omits role and label when onPress is undefined (decorative)', () => {
    // The food detail page mounts ExposureCard without onPress (read-only
    // history list). It should not be announced as a tappable button when
    // tapping does nothing.
    render(<ExposureCard {...defaultProps} />);
    expect(screen.queryByLabelText('Open Carrots details')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
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

  it('renders meta row when any optional field is provided', () => {
    // Data round-trips into SQLite from the v0.5.39/v0.5.41 chip rows on
    // the Log Exposure form (mealType, temperature, texture, setting). The
    // food detail history view dropped them silently before this fix; lock
    // the display contract so a future ExposureCard refactor cannot
    // regress to silent-data-drop again.
    render(
      <ExposureCard
        {...defaultProps}
        mealType="lunch"
        temperature="hot"
        texture="crunchy"
        setting="home"
      />
    );
    expect(screen.getByText('🍽️ lunch')).toBeTruthy();
    expect(screen.getByText('🌡️ hot')).toBeTruthy();
    expect(screen.getByText('🧊 crunchy')).toBeTruthy();
    expect(screen.getByText('📍 home')).toBeTruthy();
  });

  it('omits the meta row when no optional fields are provided', () => {
    // Most exposures will skip the optional details block (the form's
    // "Add More Details" toggle is collapsed by default). Confirms the
    // card stays clean when fields are undefined — no leftover icons,
    // no empty row taking layout space.
    render(<ExposureCard {...defaultProps} />);
    expect(screen.queryByText(/🍽️/)).toBeNull();
    expect(screen.queryByText(/🌡️/)).toBeNull();
    expect(screen.queryByText(/🧊/)).toBeNull();
    expect(screen.queryByText(/📍/)).toBeNull();
  });

  it('renders only the meta fields that are populated', () => {
    // Partial-fill is the common case — a parent might log meal context
    // (lunch) without bothering with texture. Each field gates its own
    // <Text/>; this test pins the per-field independence.
    render(<ExposureCard {...defaultProps} mealType="dinner" />);
    expect(screen.getByText('🍽️ dinner')).toBeTruthy();
    expect(screen.queryByText(/🌡️/)).toBeNull();
    expect(screen.queryByText(/🧊/)).toBeNull();
    expect(screen.queryByText(/📍/)).toBeNull();
  });

  it('hides the childName Text when childName is empty', () => {
    // The food detail page mounts ExposureCard with childName="" because
    // the parent already chose the child upstream — there is no need to
    // re-state it on every history row. Rendering an empty <Text/> still
    // pulled the parent's `gap: 2` into the header layout, leaving a
    // 2px ghost line below the food name. Gating the Text on truthy
    // childName collapses the gap cleanly.
    render(<ExposureCard {...defaultProps} childName="" />);
    expect(screen.getByText('Carrots')).toBeTruthy();
    expect(screen.queryByText('Emma')).toBeNull();
    // The food name is still the only header text node — no empty Text
    // sibling.
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
