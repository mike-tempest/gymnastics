import { BadRequestException } from '@nestjs/common';

export function validDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new BadRequestException('Use a valid calendar date');
  }
  return value;
}

export function weeklyDates(start: string, end: string, weekday: number): string[] {
  validDate(start);
  validDate(end);
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end}T00:00:00Z`);
  if (
    start > end ||
    to.getTime() - from.getTime() > 366 * 86400000 ||
    !Number.isInteger(weekday) ||
    weekday < 0 ||
    weekday > 6
  ) {
    throw new BadRequestException('A term must last at most 366 days and have a valid weekday');
  }
  const dates: string[] = [];
  for (; from <= to; from.setUTCDate(from.getUTCDate() + 1)) {
    if (from.getUTCDay() === weekday) dates.push(from.toISOString().slice(0, 10));
  }
  return dates;
}

/** Resolve a wall-clock time without relying on the server timezone or shifting DST gaps. */
export function localInstant(date: string, time: string, timezone: string): Date {
  validDate(date);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new BadRequestException('Use a valid time');
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const wall = (instant: number) => {
    const parts = Object.fromEntries(
      formatter.formatToParts(instant).map((p) => [p.type, p.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };
  const target = `${date}T${time}`;
  const nominal = Date.parse(`${target}:00Z`);
  // Sampling the offsets either side also detects both instants in a clock-change overlap.
  const offsets = new Set(
    [-36, 0, 36].map((hours) => {
      const instant = nominal + hours * 3600000;
      return Date.parse(`${wall(instant)}:00Z`) - instant;
    }),
  );
  const matches = [...offsets]
    .map((offset) => nominal - offset)
    .filter((instant) => wall(instant) === target);
  if (matches.length !== 1)
    throw new BadRequestException(
      `${date} ${time} is ambiguous or does not exist in ${timezone}. Choose another time or exclude this date.`,
    );
  return new Date(matches[0]);
}
