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
});
