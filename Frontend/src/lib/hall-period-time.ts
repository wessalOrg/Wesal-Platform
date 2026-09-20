const TIME_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

type ParsedHallPeriodTime = {
  hours: number;
  minutes: number;
  seconds: number;
};

export function parseHallPeriodTime(raw: string): ParsedHallPeriodTime | null {
  const match = raw.trim().match(TIME_RE);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours > 23 ||
    minutes > 59 ||
    seconds > 59
  ) {
    return null;
  }

  return { hours, minutes, seconds };
}

export function isHallPeriodTime(raw: string): boolean {
  return parseHallPeriodTime(raw) !== null;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Display / input value: HH:mm */
export function toHallPeriodHhMm(raw: string): string {
  const parsed = parseHallPeriodTime(raw);
  if (!parsed) return "";
  return `${pad2(parsed.hours)}:${pad2(parsed.minutes)}`;
}

/** API TimeOnly: HH:mm:ss */
export function toHallPeriodTimeOnly(raw: string): string {
  const parsed = parseHallPeriodTime(raw);
  if (!parsed) return raw.trim();
  return `${pad2(parsed.hours)}:${pad2(parsed.minutes)}:${pad2(parsed.seconds)}`;
}
