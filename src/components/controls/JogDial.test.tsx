import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JogDial } from './JogDial';

describe('JogDial Component Unit Tests', () => {
  it('renders slider element with correct ARIA attributes', () => {
    render(<JogDial value={25} min={1} max={120} onChange={() => {}} label="Focus Duration" />);

    const slider = screen.getByRole('slider', { name: 'Focus Duration' });
    expect(slider).toBeDefined();
    expect(slider.getAttribute('aria-valuenow')).toBe('25');
    expect(slider.getAttribute('aria-valuemin')).toBe('1');
    expect(slider.getAttribute('aria-valuemax')).toBe('120');
  });

  it('increments and decrements value on keyboard arrow keys', () => {
    const handleChange = vi.fn();
    render(<JogDial value={25} min={1} max={120} onChange={handleChange} label="Focus Duration" />);

    const slider = screen.getByRole('slider');

    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    expect(handleChange).toHaveBeenCalledWith(26);

    fireEvent.keyDown(slider, { key: 'ArrowLeft' });
    expect(handleChange).toHaveBeenCalledWith(24);

    fireEvent.keyDown(slider, { key: 'PageUp' });
    expect(handleChange).toHaveBeenCalledWith(30);

    fireEvent.keyDown(slider, { key: 'PageDown' });
    expect(handleChange).toHaveBeenCalledWith(20);

    fireEvent.keyDown(slider, { key: 'Home' });
    expect(handleChange).toHaveBeenCalledWith(1);

    fireEvent.keyDown(slider, { key: 'End' });
    expect(handleChange).toHaveBeenCalledWith(120);
  });

  it('handles increment and decrement button clicks', () => {
    const handleChange = vi.fn();
    render(<JogDial value={50} min={1} max={120} onChange={handleChange} label="Focus Duration" />);

    const plusBtn = screen.getByRole('button', { name: 'Increase duration' });
    fireEvent.click(plusBtn);
    expect(handleChange).toHaveBeenCalledWith(51);

    const minusBtn = screen.getByRole('button', { name: 'Decrease duration' });
    fireEvent.click(minusBtn);
    expect(handleChange).toHaveBeenCalledWith(49);
  });

  it('handles direct numeric input changes and clamps to bounds', () => {
    const handleChange = vi.fn();
    render(<JogDial value={25} min={5} max={90} onChange={handleChange} label="Focus Duration" />);

    const input = screen.getByRole('spinbutton', { name: 'Focus Duration numeric input' });
    fireEvent.change(input, { target: { value: '45' } });
    expect(handleChange).toHaveBeenCalledWith(45);

    // Over maximum (90)
    fireEvent.change(input, { target: { value: '999' } });
    expect(handleChange).toHaveBeenCalledWith(90);

    // Below minimum (5)
    fireEvent.change(input, { target: { value: '1' } });
    expect(handleChange).toHaveBeenCalledWith(5);
  });
});
