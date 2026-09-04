import { formatSwimTime } from '../competitions-utils';

describe('formatSwimTime', () => {
  it('formats zero seconds', () => {
    expect(formatSwimTime(0)).toBe('00:00.00');
  });

  it('zero-pads single-digit seconds and hundredths', () => {
    expect(formatSwimTime(5.3)).toBe('00:05.30');
  });

  it('formats seconds with hundredths', () => {
    expect(formatSwimTime(24.5)).toBe('00:24.50');
  });

  it('carries seconds over a minute', () => {
    expect(formatSwimTime(62.34)).toBe('01:02.34');
  });

  it('formats a whole minute and a half', () => {
    expect(formatSwimTime(90)).toBe('01:30.00');
  });

  it('formats just under an hour', () => {
    expect(formatSwimTime(3599.99)).toBe('59:59.99');
  });

  it('rounds and carries across the minute boundary', () => {
    expect(formatSwimTime(59.999)).toBe('01:00.00');
  });

  it('does not falsely carry just below the boundary', () => {
    expect(formatSwimTime(59.99)).toBe('00:59.99');
  });

  it('renders a single dash for missing time', () => {
    expect(formatSwimTime(null)).toBe('-');
    expect(formatSwimTime(undefined)).toBe('-');
  });

  it('renders a double dash for negative time', () => {
    expect(formatSwimTime(-1)).toBe('--');
  });
});
