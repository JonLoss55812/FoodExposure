import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChildSelector } from '../ChildSelector';

const mockChildren = [
  { id: '1', name: 'Emma', avatarEmoji: 'E' },
  { id: '2', name: 'Jack', avatarEmoji: 'J' },
  { id: '3', name: 'Lily', avatarEmoji: 'L' },
];

describe('ChildSelector', () => {
  it('renders all children names', () => {
    render(
      <ChildSelector children={mockChildren} selectedId="1" onSelect={() => {}} />
    );
    expect(screen.getByText('Emma')).toBeTruthy();
    expect(screen.getByText('Jack')).toBeTruthy();
    expect(screen.getByText('Lily')).toBeTruthy();
  });

  it('calls onSelect when child is clicked', () => {
    const onSelect = jest.fn();
    render(
      <ChildSelector children={mockChildren} selectedId="1" onSelect={onSelect} />
    );
    fireEvent.click(screen.getByText('Jack'));
    expect(onSelect).toHaveBeenCalledWith('2');
  });

  it('returns null when no children', () => {
    const { container } = render(
      <ChildSelector children={[]} selectedId={null} onSelect={() => {}} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('exposes each chip as an accessible button labeled "Select <name>"', () => {
    // The Pressable carries accessibilityRole="button" + accessibilityLabel —
    // VoiceOver/TalkBack will read "Select Emma, button" on iOS/Android, and
    // on web the chip becomes a <button aria-label="Select Emma">. The
    // accessibilityState.selected prop is also passed and honored natively;
    // react-native-web does not serialize selected state for button role to
    // a DOM attribute, so we only assert what is observable from the web
    // testing harness here.
    render(
      <ChildSelector children={mockChildren} selectedId="1" onSelect={() => {}} />
    );
    for (const name of ['Emma', 'Jack', 'Lily']) {
      const el = screen.getByLabelText(`Select ${name}`);
      expect(el.tagName.toLowerCase()).toBe('button');
      expect(el.getAttribute('role')).toBe('button');
    }
  });

  it('keeps each chip click wired to onSelect after a11y props are added', () => {
    const onSelect = jest.fn();
    render(
      <ChildSelector children={mockChildren} selectedId="1" onSelect={onSelect} />
    );
    fireEvent.click(screen.getByLabelText('Select Lily'));
    expect(onSelect).toHaveBeenCalledWith('3');
  });
});
