import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState icon="X" title="No Foods" description="Add some foods" />);
    expect(screen.getByText('No Foods')).toBeTruthy();
    expect(screen.getByText('Add some foods')).toBeTruthy();
  });

  it('renders action button when provided', () => {
    const onAction = jest.fn();
    render(
      <EmptyState
        icon="X"
        title="No Foods"
        description="Add some foods"
        actionLabel="Add Food"
        onAction={onAction}
      />
    );
    const button = screen.getByText('Add Food');
    expect(button).toBeTruthy();
    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when no actionLabel', () => {
    render(<EmptyState icon="X" title="No Foods" description="Add some foods" />);
    expect(screen.queryByText('Add Food')).toBeNull();
  });
});
