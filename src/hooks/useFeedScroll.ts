import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Week } from '../types';
import { formatDateKey, getMonthWeeks } from '../utils/dateUtils';

/**
 * Идентификатор «текущей» недели для ленты Пн–Пт.
 * В будни — неделя, содержащая сегодняшний день. В выходные (сб/вс), которых
 * в ленте нет, — ближайшая наступающая рабочая неделя: и суббота, и
 * воскресенье относятся к ещё не начавшейся неделе (впереди понедельник).
 * Неделя ищется по дате её понедельника (первого дня), а не по ISO-id:
 * ISO-id, вычисленный от выходного дня (его четверг относится к следующей
 * неделе), не совпадает с id лент (вычисляемыми от понедельника) и давал
 * смещение подсветки на +1 неделю.
 * Возвращает id из weeks или null.
 */
export function findCurrentWeekId(weeks: Week[], today: Date = new Date()): string | null {
  const todayKey = formatDateKey(today);
  const byDay = weeks.find((w) => w.days.some((day) => formatDateKey(new Date(day.date)) === todayKey));
  if (byDay) return byDay.id;

  const dow = today.getDay(); // 0 = Вс, 6 = Сб
  const anchor = new Date(today);
  // сб → +2 дня, вс → +1 день: в обоих случаях попадаем на понедельник
  // ближайшей наступающей рабочей недели.
  if (dow === 6) anchor.setDate(today.getDate() + 2);
  else if (dow === 0) anchor.setDate(today.getDate() + 1);
  else return null; // на всякий случай: другие дни уже покрыты поиском byDay

  const mondayKey = formatDateKey(anchor);
  const byMonday = weeks.find((w) => formatDateKey(new Date(w.days[0].date)) === mondayKey);
  return byMonday?.id || null;
}

/**
 * Месяц, которому «принадлежит» неделя — по правилу большинства карточек
 * в видимой области пользователя. Карточки в ленте показаны только для
 * рабочих дней Пн–Пт, поэтому доминирует месяц с наибольшим числом таких
 * карточек (например, 28.09–02.10 → сентябрь: 3 против 2). При равенстве
 * выбирается более ранний месяц.
 */
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

/** Высота sticky-шапки календаря в пикселях. */
export const STICKY_HEADER_HEIGHT = 90;

/**
 * Целевая позиция верхней грани текущего ряда карточек относительно ВЕРХА
 * КОНТЕЙНЕРА ленты при автопрокрутке: сразу под sticky-шапкой. Тогда
 * активная неделя видна целиком первым рядом, а над ней — предыдущие
 * недели (2026-W41, W40, …), до прокрутки уже бывшие в обозримой области.
 * Раньше использовался offset 90+140+16 px («текущая неделя — вторым
 * рядом»), из-за чего первый видимый ряд урезался до ~34 px, а активная
 * неделя уходила за нижнюю границу экрана.
 */
export const ACTIVE_ROW_TARGET_TOP = STICKY_HEADER_HEIGHT;

/**
 * Вычисляет scrollTop контейнера для автопрокрутки к активной неделе так,
 * чтобы её верхняя грань оказалась на ACTIVE_ROW_TARGET_TOP относительно
 * верха контейнера (под sticky-шапкой). Чистая функция — легко тестируется.
 */
export function computeActiveWeekScrollTop(
  containerRectTop: number,
  containerScrollTop: number,
  weekElementRectTop: number,
): number {
  return Math.max(0, containerScrollTop + (weekElementRectTop - containerRectTop) - ACTIVE_ROW_TARGET_TOP);
}

/**
 * Возвращает id недели, верхний край которой расположен НЕ ВЫШЕ указанной
 * позиции (по умолчанию — сразу под sticky-шапкой, т.е. первый видимый
 * ряд). Используется для обновления заголовка месяца при ручной прокрутке.
 */
export function findWeekIdAtFirstVisibleRow(container: HTMLElement, weeks: Week[], targetTop: number = ACTIVE_ROW_TARGET_TOP): string | null {
  const contRect = container.getBoundingClientRect();
  // Верх первого видимого ряда — чуть ниже целевой границы, чтобы не
  // цеплять неделю, которая только что ушла за шапку.
  const probeY = contRect.top + targetTop + 1;
  for (const w of weeks) {
    const el = document.getElementById(`week-${w.id}`);
    if (!el) continue;
    if (el.getBoundingClientRect().top >= probeY) return w.id;
  }
  return null;
}

/**
 * @deprecated Оставлено как алиас старой функции поиска активной недели
 * для обратной совместимости тестов/вызовов. Теперь корректное поведение —
 * искать ПЕРВЫЙ видимый ряд (неделя целиком под шапкой).
 */
export const findWeekIdAtSecondRowFromTop = findWeekIdAtFirstVisibleRow;

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

  // Прокрутка к ТЕКУЩЕЙ неделе: верхняя грань активной недели ставится ровно
  // под sticky-шапку (ACTIVE_ROW_TARGET_TOP = 90px от верха контейнера),
  // поэтому активная неделя видна ЦЕЛИКОМ первым рядом, а над ней остаются
  // предыдущие недели ленты (2026-W41, W40, …). Прежде использовался offset
  // «второй ряд сверху» (90+140+16 px), из-за чего первый видимый ряд
  // урезался до ~34 px, а активная неделя уходила за нижнюю границу экрана.
  const scrollToCurrentWeek = useCallback(
    (container: HTMLElement, weekElement: HTMLElement) => {
      const contRect = container.getBoundingClientRect();
      const elRect = weekElement.getBoundingClientRect();
      container.scrollTop = computeActiveWeekScrollTop(contRect.top, container.scrollTop, elRect.top);
    },
    [],
  );

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
      if (!container) return false;
      const weekElement = currentWeekId ? document.getElementById(`week-${currentWeekId}`) : null;
      if (!weekElement || weekElement.offsetHeight <= 0) return false;
      scrollToCurrentWeek(container, weekElement);
      return true;
    };

    // Диагностическое предупреждение: если через 3 секунды после монтирования
    // элемент текущей недели так и не найден в DOM — автоскролл невозможен.
    // (Причины: пустой currentWeekId, дубли id в ленте, ошибка генерации недель.)
    const warnTimer = window.setTimeout(() => {
      if (cancelled || finished) return;
      if (!currentWeekId) {
        console.warn('[CalmDesk] Автоскролл пропущен: currentWeekId = null (текущая неделя не найдена в ленте).');
      } else if (!document.getElementById(`week-${currentWeekId}`)) {
        console.warn(
          `[CalmDesk] Автоскролл пропущен: элемент #week-${currentWeekId} отсутствует в DOM ` +
            `(проверьте id недель и генерацию ленты).`,
        );
      }
    }, 3000);

    const attach = () => {
      if (cancelled) return;
      const container = containerRef.current;
      if (!container) {
        if (performance.now() - startTs < 5000) requestAnimationFrame(attach);
        return;
      }

      // Первый скролл — сразу, как только контейнер в DOM.
      const scrolled = doScroll();
      if (!scrolled && performance.now() - startTs > 1500) {
        // Долго не дождались элемента недели — завершаем попытку (сработает warn выше).
        finish();
        return;
      }

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
      window.clearTimeout(warnTimer);
      ro?.disconnect();
    };
  }, [shouldScrollToCurrentWeek, currentWeekId, containerRef, scrollToCurrentWeek, setVisibleMonth]);

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
        // Активной для заголовка считается неделя, чей верхний край находится
        // сразу под sticky-шапкой (первый полностью видимый ряд ленты).
        const activeWeekId = findWeekIdAtFirstVisibleRow(container, weeksRef.current);
        if (!activeWeekId) return;
        const activeWeek = weeksRef.current.find((w) => w.id === activeWeekId);
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
