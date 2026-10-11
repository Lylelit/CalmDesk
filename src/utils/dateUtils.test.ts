import { describe, it, expect } from 'vitest';
import { formatDateKey, getIsoWeekId, getMonthWeeks } from './dateUtils';
import { findCurrentWeekId, getWeekDominantMonth, useWeeksFeed } from '../hooks/useFeedScroll';

// эмуляция useWeeksFeed без React:
const buildYearFeed = (year: number) => {
  const all = [];
  for (let m = 0; m < 12; m++) all.push(...getMonthWeeks(year, m));
  const seen = new Set();
  return all.filter((w) => {
    const k = formatDateKey(new Date(w.days[0].date));
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

describe('formatDateKey', () => {
  it(' форматирует в YYYY-MM-DD с дополнением', () => {
    expect(formatDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('getMonthWeeks', () => {
  it('возвращает только рабочие дни (Пн-Пт), флаг isWorkingDay = день в целевом месяце', () => {
    const weeks = getMonthWeeks(2026, 9); // октябрь 2026
    for (const w of weeks) {
      for (const d of w.days) {
        expect(d.dayOfWeek).toBeGreaterThanOrEqual(1);
        expect(d.dayOfWeek).toBeLessThanOrEqual(5);
        const inOctober = new Date(d.date).getMonth() === 9 && new Date(d.date).getFullYear() === 2026;
        expect(d.isWorkingDay).toBe(inOctober);
      }
    }
  });
});

// useWeeksFeed вне React вызываем через упрощённую проверку дедупликации:
describe('лента недель', () => {
  it('не содержит дублей физических недель и отсортирована', () => {
    // эмуляция useMemo-логики хука напрямую через getMonthWeeks
    const all = [];
    for (let m = 0; m < 12; m++) all.push(...getMonthWeeks(2026, m));
    const seen = new Set();
    const uniq = all.filter((w) => {
      const k = formatDateKey(new Date(w.days[0].date));
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    expect(uniq.length).toBeLessThan(all.length); // дубли были и отсеялись
    expect(new Set(uniq.map((w) => w.id)).size).toBe(uniq.length); // id уникальны
    for (let i = 1; i < uniq.length; i++) {
      expect(new Date(uniq[i].days[0].date).getTime()).toBeGreaterThan(new Date(uniq[i - 1].days[0].date).getTime());
    }
  });

  it('getWeekDominantMonth определяет месяц по большинству карточек Пн–Пт', () => {
    // Первая «неделя октября» = 28.09–02.10: 3 карточки сентября против 2 октября,
    // поэтому доминирует сентябрь — правило большинства видимых карточек.
    const week = getMonthWeeks(2026, 9)[0];
    const dm = getWeekDominantMonth(week);
    expect(dm.month).toBe(8);
    expect(dm.year).toBe(2026);
    // Полностью октябрьская неделя (W41, 05–09.10) даёт октябрь.
    const w41 = getMonthWeeks(2026, 9).find((w) => w.id === '2026-W41')!;
    expect(getWeekDominantMonth(w41)).toEqual({ month: 9, year: 2026 });
  });
});

describe('getIsoWeekId', () => {
  it('для понедельника и воскресенья одной недели возвращает один и тот же id', () => {
    expect(getIsoWeekId(new Date(2026, 9, 5))).toBe('2026-W41'); // пн
    expect(getIsoWeekId(new Date(2026, 9, 9))).toBe('2026-W41'); // пт
    expect(getIsoWeekId(new Date(2026, 9, 10))).toBe('2026-W41'); // сб
    expect(getIsoWeekId(new Date(2026, 9, 11))).toBe('2026-W41'); // вс
  });
});

describe('findCurrentWeekId', () => {
  const feed = buildYearFeed(2026);

  it('в будний день находит неделю, содержащую этот день', () => {
    expect(findCurrentWeekId(feed, new Date(2026, 9, 7))).toBe('2026-W41'); // ср
  });

  it('в воскресенье находит следующую рабочую неделю (её дни скрыты, но ISO-неделя та же)', () => {
    expect(findCurrentWeekId(feed, new Date(2026, 9, 11))).toBe('2026-W42'); // вс → W42 (пн 12.10)
  });

  it('в субботу находит текущую рабочую неделю', () => {
    expect(findCurrentWeekId(feed, new Date(2026, 9, 10))).toBe('2026-W41'); // сб → W41
  });

  it('возвращает null, если неделя вне ленты', () => {
    expect(findCurrentWeekId(feed, new Date(2025, 11, 21))).toBeNull(); // вс ISO-недели 2025-W53 — до начала ленты 2026
  });
});
