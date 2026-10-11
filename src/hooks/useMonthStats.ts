import { useMemo } from 'react';
import { Task, TaskAssignment } from '../types';
import { getMonthWeeks, HOURS_PER_DAY } from '../utils/dateUtils';
import { DayStatusEntry } from './useTaskBoard';

/**
 * Агрегированные метрики месяца: сколько часов рабочего времени доступно,
 * сколько уже назначено и сколько остаётся. Учитывает статусы дней
 * (отпуск / выходной / короткий день).
 */
export function useMonthStats(
  assignments: TaskAssignment[],
  dayStatuses: Record<string, DayStatusEntry>,
  year: number,
  month: number,
) {
  // Всего рабочих часов в текущем месяце с учётом отгулов и коротких дней.
  const totalWorkingHours = useMemo(() => {
    const currentMonthWeeks = getMonthWeeks(year, month);
    return currentMonthWeeks.reduce((total, week) => {
      return (
        total +
        week.days.reduce((dayTotal, day) => {
          const dayDate = new Date(day.date);
          const isCurrentMonth = dayDate.getMonth() === month && dayDate.getFullYear() === year;
          if (!isCurrentMonth || !day.isWorkingDay) return dayTotal;
          const dayStatus = dayStatuses[day.id];
          if (dayStatus?.status === 'vacation' || dayStatus?.status === 'holiday') return dayTotal;
          if (dayStatus?.status === 'short' && dayStatus.hours) return dayTotal + dayStatus.hours;
          return dayTotal + HOURS_PER_DAY;
        }, 0)
      );
    }, 0);
  }, [year, month, dayStatuses]);

  // Сумма назначенных часов только за текущий месяц, без отпускных/выходных дней.
  const totalAssignedHours = useMemo(() => {
    return assignments.reduce((sum, a) => {
      const dayDate = new Date(a.dayId.replace('day-', ''));
      const isCurrentMonth = dayDate.getMonth() === month && dayDate.getFullYear() === year;
      const dayStatus = dayStatuses[a.dayId];
      const isVacationOrHoliday = dayStatus?.status === 'vacation' || dayStatus?.status === 'holiday';
      return isCurrentMonth && !isVacationOrHoliday ? sum + a.hours : sum;
    }, 0);
  }, [assignments, year, month, dayStatuses]);

  return { totalWorkingHours, totalAssignedHours, remainingWorkingHours: totalWorkingHours - totalAssignedHours };
}

/** Фильтрация списка задач по строке поиска и фильтру статуса. */
export function useFilteredTasks(
  tasks: Task[],
  searchQuery: string,
  statusFilter: 'all' | 'new' | 'completed',
) {
  return useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter === 'new' && task.status === 'completed') return false;
      if (statusFilter === 'completed' && task.status !== 'completed') return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return task.title.toLowerCase().includes(query);
      }
      return true;
    });
  }, [tasks, statusFilter, searchQuery]);
}
