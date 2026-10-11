import { describe, it, expect } from 'vitest';
import { formatDateKey, getMonthWeeks } from './dateUtils';
import { getWeekDominantMonth, useWeeksFeed } from '../hooks/useFeedScroll';

describe('formatDateKey', () => {
  it(' форматирует в YYYY-MM-DD с дополнением', () => {
    expect(formatDateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('getMonthWeeks', () => {
  it('возвращает только рабочие дни (Пн-Пт)', () => {
    const weeks = getMonthWeeks(2026, 9); // октябрь 2026
    for (const w of weeks) for (const d of w.days) expect(d.isWorkingDay).toBe(true);
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

  it('getWeekDominantMonth определяет месяц по большинству дней', () => {
    const week = getMonthWeeks(2026, 9)[0];
    const dm = getWeekDominantMonth(week);
    expect(dm.month).toBe(9);
    expect(dm.year).toBe(2026);
  });
});
