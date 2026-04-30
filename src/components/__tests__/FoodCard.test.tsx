import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { FoodCard } from '../FoodCard';

describe('FoodCard', () => {
  const defaultProps = {
    name: 'Broccoli',
    category: 'vegetable' as const,
    exposureCount: 5,
    isSafeFood: false,
  };

  it('renders food name', () => {
    render(<FoodCard {...defaultProps} />);
    expect(screen.getByText('Broccoli')).toBeTruthy();
  });

  it('renders stage badge when currentStage provided', () => {
    render(<FoodCard {...defaultProps} currentStage="taste" />);
    expect(screen.getByText('Taste')).toBeTruthy();
  });

  it('renders safe food badge', () => {
    render(<FoodCard {...defaultProps} isSafeFood={true} />);
    expect(screen.getByText('Safe Food')).toBeTruthy();
  });

  it('renders safe food star indicator', () => {
    render(<FoodCard {...defaultProps} isSafeFood={true} />);
    expect(screen.getByLabelText('Safe food')).toBeTruthy();
  });

  it('does not render safe food badge when not safe', () => {
    render(<FoodCard {...defaultProps} />);
    expect(screen.queryByText('Safe Food')).toBeNull();
    expect(screen.queryByLabelText('Safe food')).toBeNull();
  });

  it('renders exposure progress', () => {
    render(<FoodCard {...defaultProps} />);
    expect(screen.getByText('5/15')).toBeTruthy();
  });

  it('calls onPress when clicked', () => {
    const onPress = jest.fn();
    render(<FoodCard {...defaultProps} onPress={onPress} />);
    fireEvent.click(screen.getByText('Broccoli'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes the card as an accessible button labeled "Open <name> details"', () => {
    render(<FoodCard {...defaultProps} />);
    const el = screen.getByLabelText('Open Broccoli details');
    expect(el.tagName.toLowerCase()).toBe('button');
    expect(el.getAttribute('role')).toBe('button');
  });

  it('keeps onPress wired to the labeled card', () => {
    const onPress = jest.fn();
    render(<FoodCard {...defaultProps} onPress={onPress} />);
    fireEvent.click(screen.getByLabelText('Open Broccoli details'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
