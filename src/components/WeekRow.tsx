import { memo } from 'react';
import { Day, Task, TaskAssignment } from '../types';
import DayColumn from './DayColumn';
import { useTheme } from '../ThemeContext';
import { DayStatusEntry } from '../hooks/useTaskBoard';

interface WeekRowProps {
  week: { id: string; days: Day[] };
  tasks: Task[];
  assignments: TaskAssignment[];
  dayStatuses: Record<string, DayStatusEntry>;
  onDropTask: (taskId: string, dayId: string, hours: number) => void;
  onRemoveAssignment: (assignmentId: string) => void;
  onSplitAssignment: (assignmentId: string, hoursToSplit: number) => void;
  onMoveAssignment: (assignmentId: string, newDayId: string) => void;
  onSetDayStatus: (dayId: string, status: 'vacation' | 'holiday' | 'short' | 'working', hours?: number) => void;
  onReorderAssignment?: (sourceId: string, targetId: string) => void;
  onMergeAssignments?: (sourceId: string, targetId: string) => void;
  isMobile: boolean;
  isCurrentWeek?: boolean;
  visibleMonth: { month: number; year: number };
  currentWeekId: string | null;
}

/**
 * Строка недели: Пн–Пт. memo-компонент — пере рендере App перерисовываются
 * только те недели, чьи пропсы реально изменились.
 */
function WeekRow({
  week,
  tasks,
  assignments,
  dayStatuses,
  onDropTask,
  onRemoveAssignment,
  onSplitAssignment,
  onMoveAssignment,
  onSetDayStatus,
  onReorderAssignment,
  onMergeAssignments,
  isMobile,
  isCurrentWeek,
  visibleMonth,
  currentWeekId,
}: WeekRowProps) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        padding: isCurrentWeek ? 8 : 0,
        background: isCurrentWeek ? `${theme.accent1}08` : 'transparent',
        borderRadius: 12,
        border: isCurrentWeek ? `2px solid ${theme.accent1}30` : 'none',
        transition: 'all 0.3s ease',
      }}
    >
      <div
        style={{
          display: isMobile ? 'flex' : 'grid',
          gridTemplateColumns: isMobile ? undefined : 'repeat(5, minmax(0, 1fr))',
          alignItems: 'stretch',
          flexDirection: isMobile ? 'column' : undefined,
          gap: isMobile ? 8 : 12,
        }}
      >
        {week.days.map((day) => {
          const dayDate = new Date(day.date);
          const isCurrentWeekDay = week.id === currentWeekId;
          const isDayInActiveMonth =
            dayDate.getMonth() === visibleMonth.month && dayDate.getFullYear() === visibleMonth.year;
          const isActiveDay = isCurrentWeekDay || isDayInActiveMonth;
          return (
            <div key={day.id} className="day-column-wrapper">
              <DayColumn
                day={{ ...day, status: dayStatuses[day.id]?.status || 'working', shortHours: dayStatuses[day.id]?.hours }}
                tasks={tasks}
                assignments={assignments}
                onDropTask={onDropTask}
                onRemoveAssignment={onRemoveAssignment}
                onSplitAssignment={onSplitAssignment}
                onMoveAssignment={onMoveAssignment}
                onSetDayStatus={onSetDayStatus}
                onReorderAssignment={onReorderAssignment}
                onMergeAssignments={onMergeAssignments}
                isMobile={isMobile}
                isActiveMonth={isActiveDay}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(WeekRow);
