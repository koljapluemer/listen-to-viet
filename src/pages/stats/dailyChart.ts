const DAY_MS = 24 * 60 * 60 * 1000;

export const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});

export const fullDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export const toDate = (day: string) => {
  const date = new Date(`${day}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseDayKey = (day: string) => {
  const [year, month, dayOfMonth] = day.split("-").map(Number);

  if (![year, month, dayOfMonth].every(Number.isInteger)) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, dayOfMonth));
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDayKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;

export const fillDailyRange = <T extends { day: string }>(
  points: T[],
  createMissingPoint: (day: string) => T
) => {
  if (!points.length) {
    return [];
  }

  const sortedPoints = [...points].sort((left, right) => left.day.localeCompare(right.day));
  const firstDay = parseDayKey(sortedPoints[0].day);
  const lastDay = parseDayKey(sortedPoints[sortedPoints.length - 1].day);

  if (!firstDay || !lastDay) {
    return sortedPoints;
  }

  const pointsByDay = new Map(sortedPoints.map((point) => [point.day, point]));
  const filledPoints: T[] = [];

  for (let time = firstDay.getTime(); time <= lastDay.getTime(); time += DAY_MS) {
    const day = formatDayKey(new Date(time));
    filledPoints.push(pointsByDay.get(day) ?? createMissingPoint(day));
  }

  return filledPoints;
};

export const getChartMinWidth = (count: number) => `${Math.max(count * 56, 320)}px`;
