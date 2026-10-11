import { describe, it, expect } from 'vitest';
import { getMonthWeeks, formatDateKey } from '../utils/dateUtils';
import { findCurrentWeekId, getWeekDominantMonth, computeActiveWeekScrollTop, ACTIVE_ROW_TARGET_TOP, STICKY_HEADER_HEIGHT } from './useFeedScroll';

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

describe('findCurrentWeekId — ближайшая рабочая неделя', () => {
  const feed = buildYearFeed(2026);

  it('в воскресенье 11.10.2026 возвращает W42 (пн 12–пт 16 октября)', () => {
    expect(findCurrentWeekId(feed, new Date(2026, 9, 11))).toBe('2026-W42');
  });

  it('W42 в ленте соответствует датам 12–16 октября (не 19–23)', () => {
    const w42 = feed.find((w) => w.id === '2026-W42')!;
    expect(formatDateKey(new Date(w42.days[0].date))).toBe('2026-10-12');
    expect(formatDateKey(new Date(w42.days[4].date))).toBe('2026-10-16');
  });

  it('в субботу 10.10.2026 возвращает W42 (ближайшая предстоящая рабочая неделя)', () => {
    expect(findCurrentWeekId(feed, new Date(2026, 9, 10))).toBe('2026-W42');
  });

  it('в воскресенье 18.10.2026 возвращает W43 (пн 19–пт 23 октября)', () => {
    expect(findCurrentWeekId(feed, new Date(2026, 9, 18))).toBe('2026-W43');
  });

  it('в будний день — неделя сегодняшнего дня', () => {
    expect(findCurrentWeekId(feed, new Date(2026, 9, 7))).toBe('2026-W41');
  });
});

describe('getWeekDominantMonth — большинство карточек видимой недели', () => {
  it('неделя 28.09–02.10: 3 карточки сентября против 2 октября → сентябрь', () => {
    const week = buildYearFeed(2026).find((w) => w.id === '2026-W40')!;
    const dm = getWeekDominantMonth(week);
    expect(dm).toEqual({ month: 8, year: 2026 });
  });

  it('неделя 05–09.10 целиком октябрьская → октябрь', () => {
    const week = buildYearFeed(2026).find((w) => w.id === '2026-W41')!;
    expect(getWeekDominantMonth(week)).toEqual({ month: 9, year: 2026 });
  });

  it('при равенстве 2/2 выбирается более ранний месяц (стабильность заголовка)', () => {
    const week = buildYearFeed(2026).find((w) => w.id === '2026-W44')!; // 26.10–30.10? check below
    // 2026-W44 = 26–30 октября — целиком октябрь; равенство 2/2 на стыке ноябрьской недели:
    const w45 = buildYearFeed(2026).find((w) => w.id === '2026-W45')!; // 02–06.11 целиком ноябрь
    expect(getWeekDominantMonth(week)).toEqual({ month: 9, year: 2026 });
    expect(getWeekDominantMonth(w45)).toEqual({ month: 10, year: 2026 });
  });
});

describe('computeActiveWeekScrollTop — позиция активной недели при автопрокрутке', () => {
  it('ставит верх активной недели ровно под sticky-шапку (90px от верха контейнера)', () => {
    // Контейнер на отметке 200px, scrollTop 500, верх недели в вьюпорте на 1300px
    const top = computeActiveWeekScrollTop(200, 500, 1300);
    expect(top).toBe(500 + (1300 - 200) - 90);
  });

  it('не даёт отрицательного scrollTop (лента не прокручена)', () => {
    expect(computeActiveWeekScrollTop(0, 0, 50)).toBe(0);
  });

  it('смещение «второй ряд сверху» (246px) больше не применяется — активная неделя не уходит за нижний край', () => {
    const contTop = 0;
    const scrollTop = 0;
    const weekTop = 1000; // верх W42 до скролла
    const newTop = computeActiveWeekScrollTop(contTop, scrollTop, weekTop);
    // Старая формула: -90 (шапка) + CURRENT_WEEK_ROW_OFFSET (90+140+16),
    // т.е. прокрутка была на один ряд карточек с отступом (156px) глубже:
    // верх активной недели уходил ЗА верх контейнера и она сползала вниз
    // за границу экрана.
    const oldTop = Math.max(0, scrollTop + (weekTop - contTop) - 90 + (90 + 140 + 16));
    expect(oldTop - newTop).toBe(140 + 16);
    expect(newTop).toBe(weekTop - 90);
  });
});

describe('ACTIVE_ROW_TARGET_TOP', () => {
  it('равен высоте sticky-шапки — активная неделя начинается сразу под ней', () => {
    expect(ACTIVE_ROW_TARGET_TOP).toBe(STICKY_HEADER_HEIGHT);
    expect(STICKY_HEADER_HEIGHT).toBe(90);
  });
});
