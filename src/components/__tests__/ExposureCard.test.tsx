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
});
