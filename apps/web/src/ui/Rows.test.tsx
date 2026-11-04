import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Row, Rows } from './primitives.js';

describe('Rows', () => {
  it('renders three rows', () => {
    render(
      <Rows columns="auto 1fr auto" label="Recent workouts">
        <Row>
          <span>Mon</span>
          <span>Push</span>
          <span>45m</span>
        </Row>
        <Row>
          <span>Tue</span>
          <span>Pull</span>
          <span>50m</span>
        </Row>
        <Row>
          <span>Wed</span>
          <span>Legs</span>
          <span>55m</span>
        </Row>
      </Rows>,
    );
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('wraps the first cell in a link when href is set', () => {
    render(
      <Rows columns="1fr auto" label="Workout">
        <Row href="https://jim.example.com/history/w1">
          <span>Push A</span>
          <span>48m</span>
        </Row>
      </Rows>,
    );
    const link = screen.getByRole('link', { name: 'Push A' });
    expect(link).toHaveAttribute('href', 'https://jim.example.com/history/w1');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
