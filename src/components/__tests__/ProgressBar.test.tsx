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

  it('exposes progressbar role to assistive tech', () => {
    // The bar is mounted on the dashboard, food detail, and progress tab —
    // every "X/Y exposures" indicator. Without progressbar role + value
    // a SR user got nothing for the visual fill. Lock the v0.5.29 contract:
    // role lands on the outer wrapper. (react-native-web does not serialize
    // accessibilityValue to aria-valuenow/min/max; native iOS/Android does
    // honor the prop, so it is still passed for those platforms.)
    const { container } = render(<ProgressBar current={7} target={15} />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar).toBeTruthy();
  });

  it('forwards an optional accessibilityLabel for context-rich announcements', () => {
    // The Progress tab renders multiple bars in sequence; the per-food
    // progress section can pass `accessibilityLabel="Broccoli progress"`
    // so the SR-user hears "Broccoli progress, progressbar" instead of
    // an unanchored "progressbar".
    const { container } = render(
      <ProgressBar current={3} target={15} accessibilityLabel="Broccoli progress" />
    );
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-label')).toBe('Broccoli progress');
  });

  it('omits aria-label when no accessibilityLabel is passed (no leaky default)', () => {
    // Default render path — most call sites are paired with a visible
    // heading and rely on role+visible-text alone, so the wrapper should
    // not synthesize a stand-in label.
    const { container } = render(<ProgressBar current={3} target={15} />);
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-label')).toBeNull();
  });

  describe('pathological numeric input defense', () => {
    // Pin the defensive coercion: callers today pass validated numbers,
    // but the bracket-deref `current / target` would produce Infinity
    // (target=0), NaN (NaN inputs), or negative widths (negative current)
    // that flow verbatim into `width: ${pct * 100}%` — invalid CSS that
    // silently drops the bar's visual fill. Each test pins one drift
    // surface so a future contributor dropping the guard fails loudly.
    it('coerces target=0 to a renderable progressbar (no division by zero)', () => {
      const { container } = render(<ProgressBar current={5} target={0} />);
      // Fallback target is 1 — current=5 clamps visually to 100%
      expect(screen.getByText('5/1')).toBeTruthy();
      expect(container).toBeTruthy();
    });

    it('coerces NaN current to 0', () => {
      const { container } = render(<ProgressBar current={NaN} target={15} />);
      expect(screen.getByText('0/15')).toBeTruthy();
      expect(container).toBeTruthy();
    });

    it('coerces Infinity current to 0', () => {
      const { container } = render(<ProgressBar current={Infinity} target={15} />);
      expect(screen.getByText('0/15')).toBeTruthy();
      expect(container).toBeTruthy();
    });

    it('coerces negative current to 0', () => {
      const { container } = render(<ProgressBar current={-7} target={15} />);
      expect(screen.getByText('0/15')).toBeTruthy();
      expect(container).toBeTruthy();
    });

    it('coerces negative target to fallback 1', () => {
      const { container } = render(<ProgressBar current={3} target={-5} />);
      expect(screen.getByText('3/1')).toBeTruthy();
      expect(container).toBeTruthy();
    });

    it('coerces NaN target to fallback 1', () => {
      const { container } = render(<ProgressBar current={3} target={NaN} />);
      expect(screen.getByText('3/1')).toBeTruthy();
      expect(container).toBeTruthy();
    });
  });
});
