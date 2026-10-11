import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Week } from '../types';
import { formatDateKey, getMonthWeeks } from '../utils/dateUtils';

/** Месяц, которому принадлежит неделя (большинство из 5 рабочих дней недели). */
export function getWeekDominantMonth(week: Week): { month: number; year: number } {
  const monthCounts: Record<string, number> = {};
  week.days.forEach((day) => {
    const dayDate = new Date(day.date);
    const key = `${dayDate.getFullYear()}-${dayDate.getMonth()}`;
    monthCounts[key] = (monthCounts[key] || 0) + 1;
  });
  let maxMonth = '';
  let maxCount = 0;
  Object.entries(monthCounts).forEach(([key, count]) => {
    if (count > maxCount) {
      maxCount = count;
      maxMonth = key;
    }
  });
  const [yearStr, monthStr] = maxMonth.split('-');
  return { month: parseInt(monthStr), year: parseInt(yearStr) };
}

/**
 * Лента недель: генерация, дедупликация и сортировка.
 * Содержит ТОЛЬКО указанный год — одна физическая неделя не должна
 * встречаться в списке дважды (из-за этого ломались id и скролл).
 */
export function useWeeksFeed(year: number): Week[] {
  return useMemo(() => {
    const allWeeks: Week[] = [];
    for (let month = 0; month < 12; month++) {
      allWeeks.push(...getMonthWeeks(year, month));
    }
    const seen = new Set<string>();
    const uniqueWeeks = allWeeks.filter((week) => {
      const key = formatDateKey(new Date(week.days[0].date));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // Гарантируем строго хронологический порядок — независим от порядка генерации.
    uniqueWeeks.sort((a, b) => new Date(a.days[0].date).getTime() - new Date(b.days[0].date).getTime());
    return uniqueWeeks;
  }, [year]);
}

/**
 * Управление прокруткой ленты недель:
 * 1. Автопрокрутка к текущей неделе при первом открытии (одна попытка за сессию).
 *    Ключевое исправление: подписка на ResizeObserver контейнера — данные задач
 *    подгружаются асинхронно, лента «растёт» после первоначального скролла и
 *    позиция съезжала обратно к январю. RO ловит каждый такой рост и заново
 *    прокручивает к текущей неделе, пока пользователь сам не тронет прокрутку.
 * 2. Обновление заголовка видимого месяца при ручной прокрутке.
 * 3. Переход к предыдущему/следующему месяцу.
 *
 * Позиция считается из getBoundingClientRect (абсолютные координаты элемента
 * внутри контейнера) — offsetTop мог давать неверное значение, если у какого-то
 * из общих родителей был position !== static.
 */
export interface FeedScrollHandlers {
  /** Прокрутка контейнера ленты к неделе с компенсацией sticky-шапки. */
  scrollToWeek: (container: HTMLElement, weekElement: HTMLElement) => void;
  /** Прокрутка к первой неделе целевого месяца (direction: -1 назад, +1 вперёд). */
  scrollToMonth: (direction: -1 | 1) => void;
}

export function useFeedScroll(
  containerRef: RefObject<HTMLDivElement>,
  weeks: Week[],
  currentWeekId: string | null,
  visibleMonth: { month: number; year: number },
  setVisibleMonth: (vm: { month: number; year: number }) => void,
): FeedScrollHandlers {
  const [shouldScrollToCurrentWeek, setShouldScrollToCurrentWeek] = useState(true);

  const weeksRef = useRef(weeks);
  const visibleMonthRef = useRef(visibleMonth);
  // Пока при первом открытии не выполнилась автопрокрутка к текущей неделе,
  // обработчик скролла не должен менять заголовок месяца.
  const autoScrollPendingRef = useRef(true);

  useEffect(() => {
    weeksRef.current = weeks;
    visibleMonthRef.current = visibleMonth;
  }, [weeks, visibleMonth]);
  useEffect(() => {
    autoScrollPendingRef.current = shouldScrollToCurrentWeek;
  }, [shouldScrollToCurrentWeek]);

  // Прокрутка контейнера ленты к неделе.
  const scrollToWeek = useCallback((container: HTMLElement, weekElement: HTMLElement) => {
    const contRect = container.getBoundingClientRect();
    const elRect = weekElement.getBoundingClientRect();
    // Компенсация sticky-шапки: неделя встаёт на 90px ниже верха контейнера.
    const targetTop = Math.max(0, container.scrollTop + (elRect.top - contRect.top) - 90);
    container.scrollTop = targetTop;
  }, []);

  // Одна попытка автоскролла за сессию к текущей неделе.
  useEffect(() => {
    if (!shouldScrollToCurrentWeek) return;

    let cancelled = false;
    let ro: ResizeObserver | null = null;
    let userScrolled = false;
    let finished = false;
    const startTs = performance.now();

    const finish = () => {
      if (finished || cancelled) return;
      finished = true;
      const week = weeksRef.current.find((w) => w.id === currentWeekId);
      if (week) setVisibleMonth(getWeekDominantMonth(week));
      setShouldScrollToCurrentWeek(false);
    };

    const doScroll = (): boolean => {
      const container = containerRef.current;
      const weekElement = currentWeekId ? document.getElementById(`week-${currentWeekId}`) : null;
      if (!container || !weekElement || weekElement.offsetHeight <= 0) return false;
      scrollToWeek(container, weekElement);
      return true;
    };

    const attach = () => {
      if (cancelled) return;
      const container = containerRef.current;
      if (!container) {
        if (performance.now() - startTs < 5000) requestAnimationFrame(attach);
        return;
      }

      // Первый скролл — сразу, как только контейнер в DOM.
      doScroll();

      // Повторяем скролл при каждом изменении размеров ленты (загрузка данных,
      // ре-рендеры карточек) — это и чинит «откат» к январю.
      ro = new ResizeObserver(() => {
        if (userScrolled || cancelled) return;
        doScroll();
      });
      ro.observe(container);

      // Если пользователь сам начал крутить — перестаём навязывать позицию.
      const onWheelOrTouch = () => {
        userScrolled = true;
      };
      container.addEventListener('wheel', onWheelOrTouch, { passive: true });
      container.addEventListener('touchmove', onWheelOrTouch, { passive: true });

      // Страховка: держим позицию ещё пару секунд кадрами, затем завершаем.
      const holdUntil = performance.now() + 2000;
      const hold = () => {
        if (cancelled || userScrolled) {
          finish();
          return;
        }
        doScroll();
        if (performance.now() < holdUntil) requestAnimationFrame(hold);
        else finish();
      };
      requestAnimationFrame(hold);
    };
    attach();

    return () => {
      cancelled = true;
      ro?.disconnect();
    };
  }, [shouldScrollToCurrentWeek, currentWeekId, containerRef, scrollToWeek, setVisibleMonth]);

  // Обновление заголовка месяца при ручной прокрутке.
  useEffect(() => {
    const attachScrollHandler = () => {
      const container = containerRef.current;
      if (!container) {
        requestAnimationFrame(attachScrollHandler);
        return;
      }
      const handleScroll = () => {
        // Пока не выполнилась автопрокрутка при первом открытии, заголовок
        // не трогаем — иначе он «прыгнет» на январь до скролла к текущей неделе.
        if (autoScrollPendingRef.current) return;
        const containerRect = container.getBoundingClientRect();
        const probeY = containerRect.top + Math.min(100, containerRect.height / 2);
        let activeWeek: Week | undefined;
        for (const week of weeksRef.current) {
          const weekElement = document.getElementById(`week-${week.id}`);
          if (!weekElement) continue;
          const rect = weekElement.getBoundingClientRect();
          if (rect.top <= probeY && rect.bottom > probeY) {
            activeWeek = week;
            break;
          }
        }
        if (activeWeek) {
          const visible = getWeekDominantMonth(activeWeek);
          const currentVisibleMonth = visibleMonthRef.current;
          if (visible.month !== currentVisibleMonth.month || visible.year !== currentVisibleMonth.year) {
            setVisibleMonth(visible);
          }
        }
      };
      container.addEventListener('scroll', handleScroll, { passive: true });
      (container as any)._scrollHandler = handleScroll;
    };
    attachScrollHandler();
    return () => {
      const container = containerRef.current;
      if (container && (container as any)._scrollHandler) {
        container.removeEventListener('scroll', (container as any)._scrollHandler);
        delete (container as any)._scrollHandler;
      }
    };
  }, [containerRef, setVisibleMonth]);

  // Переход к предыдущему/следующему месяцу.
  const scrollToMonth = useCallback(
    (direction: -1 | 1) => {
      const container = containerRef.current;
      if (!container) return;
      let targetMonth = visibleMonth.month + direction;
      let targetYear = visibleMonth.year;
      if (targetMonth < 0) {
        targetMonth = 11;
        targetYear--;
      } else if (targetMonth > 11) {
        targetMonth = 0;
        targetYear++;
      }
      // Ищем первую неделю, у которой БОЛЬШИНСТВО дней относится к целевому месяцу —
      // иначе переход мог приземляться на «хвост» соседнего месяца.
      const targetWeek = weeks.find((week) => {
        const inMonth = week.days.filter((d) => {
          const dayDate = new Date(d.date);
          return dayDate.getMonth() === targetMonth && dayDate.getFullYear() === targetYear;
        }).length;
        return inMonth >= 3;
      });
      if (targetWeek) {
        const weekElement = document.getElementById(`week-${targetWeek.id}`);
        if (weekElement) {
          scrollToWeek(container, weekElement);
          setVisibleMonth({ month: targetMonth, year: targetYear });
        }
      }
    },
    [containerRef, weeks, visibleMonth, scrollToWeek, setVisibleMonth],
  );

  return { scrollToWeek, scrollToMonth };
}
