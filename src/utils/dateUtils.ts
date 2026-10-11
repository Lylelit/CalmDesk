import { Day, Week } from '../types';

export const HOURS_PER_DAY = 8;

// Возвращает недели месяца. Каждая неделя — Пн–Пт.
// Недели генерируются строго по календарю (шаг = 7 дней), поэтому одна и та же
// физическая неделя в разных месяцах получает одинаковый id (ISO-номер недели),
// что позволяет корректно дедуплицировать их в App и не терять дни на стыках месяцев.
export function getMonthWeeks(year: number, month: number): Week[] {
  const weeks: Week[] = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Понедельник недели, содержащей 1-е число месяца
  let weekStart = new Date(firstDay);
  const dow = weekStart.getDay(); // 0 = Вс … 6 = Сб
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  weekStart.setDate(weekStart.getDate() + diffToMonday);

  while (weekStart <= lastDay) {
    const days: Day[] = [];
    for (let i = 0; i < 5; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const isInMonth = date.getMonth() === month && date.getFullYear() === year;
      days.push({
        id: `day-${formatDateKey(date)}`,
        date,
        dayOfWeek: i + 1,
        isWorkingDay: isInMonth,
      });
    }
    weeks.push({
      // ВАЖНО: id хранится БЕЗ префикса "week-" — префикс добавляется только
      // в DOM (id={`week-${week.id}`}). Раньше id уже содержал "week-", и
      // getElementById("week-" + week.id) искал "week-week-...", из-за чего
      // автоскролл никогда не находил элемент текущей недели.
      id: getIsoWeekId(weekStart),
      days,
    });
    weekStart.setDate(weekStart.getDate() + 7);
  }

  return weeks;
}

// Стабильный ключ даты без зависимости от таймзоны (в отличие от toISOString)
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ISO-идентификатор недели по ЛЮБОМУ дню недели (обычно передаётся понедельник),
// напр. "2026-W41". Алгоритм через четверг корректно работает и для дней
// сб/вс — это используется при поиске текущей недели в выходные дни.
export function getIsoWeekId(date: Date): string {
  const thu = new Date(date);
  const dowFromMonday = date.getDay() === 0 ? 6 : date.getDay() - 1;
  thu.setDate(date.getDate() + (3 - dowFromMonday)); // четверг определяет ISO-год/неделю
  const jan4 = new Date(thu.getFullYear(), 0, 4);
  const mondayOfJan4Week = new Date(jan4);
  const janDow = jan4.getDay();
  mondayOfJan4Week.setDate(jan4.getDate() - (janDow === 0 ? 6 : janDow - 1));
  const weekNo = Math.round((thu.getTime() - mondayOfJan4Week.getTime()) / (7 * 24 * 3600 * 1000)) + 1;
  return `${thu.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export function getDayName(dayOfWeek: number): string {
  const names = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт'];
  return names[dayOfWeek - 1] || '';
}

export function getMonthName(month: number): string {
  const names = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ];
  return names[month];
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}
