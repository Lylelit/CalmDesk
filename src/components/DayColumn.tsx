import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Day, Task, TaskAssignment } from '../types';
import { HOURS_PER_DAY, formatDate, getDayName } from '../utils/dateUtils';
import { formatHours, parseTimeInput } from '../utils/timeFormat';
import { useTheme } from '../ThemeContext';

interface Props {
  day: Day;
  tasks: Task[];
  assignments: TaskAssignment[];
  onDropTask: (taskId: string, dayId: string, hours: number) => void;
  onRemoveAssignment: (assignmentId: string) => void;
  onSplitAssignment: (assignmentId: string, hoursToSplit: number) => void;
  onMoveAssignment: (assignmentId: string, newDayId: string) => void;
  onSetDayStatus: (dayId: string, status: 'vacation' | 'holiday' | 'short' | 'working', hours?: number) => void;
  onReorderAssignment?: (sourceId: string, targetId: string) => void;
  onMergeAssignments?: (sourceId: string, targetId: string) => void;
  isMobile?: boolean;
  isActiveMonth?: boolean;
}

export default function DayColumn({ day, tasks, assignments, onDropTask, onRemoveAssignment, onSplitAssignment, onMoveAssignment, onSetDayStatus, onReorderAssignment, onMergeAssignments, isMobile = false, isActiveMonth = true }: Props) {
  const { theme, mode } = useTheme();
  const [isDragOver, setIsDragOver] = useState(false);
  const [showDropMenu, setShowDropMenu] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [pendingAssignmentId, setPendingAssignmentId] = useState<string | null>(null);
  const [showSplitMenu, setShowSplitMenu] = useState(false);
  const [splittingAssignmentId, setSplittingAssignmentId] = useState<string | null>(null);
  const [showDayMenu, setShowDayMenu] = useState(false);
  const dayMenuButtonRef = useRef<HTMLButtonElement>(null);
  const [dayMenuPos, setDayMenuPos] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const [showShortDayInput, setShowShortDayInput] = useState(false);
  const [shortDayHours, setShortDayHours] = useState('');

  // Позиционируем выпадающее меню типа дня через portal (relative to viewport),
  // чтобы оно не обрезалось overflow: hidden карточки дня.
  useLayoutEffect(() => {
    if (!showDayMenu) { setDayMenuPos(null); return; }
    const update = () => {
      const el = dayMenuButtonRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setDayMenuPos({ top: rect.bottom + 4, left: rect.right, minWidth: Math.max(rect.width, 160) });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [showDayMenu]);

  useEffect(() => {
    if (!showDayMenu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowDayMenu(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showDayMenu]);

  const cardBg = isActiveMonth ? (mode === 'dark' ? '#383838' : '#FFFFFF') : (mode === 'dark' ? '#303030' : '#EBF1F6');

  const dayAssignments = assignments.filter((a) => a.dayId === day.id).sort((a, b) => a.order - b.order);
  const maxHours = day.status === 'short' && day.shortHours ? day.shortHours : HOURS_PER_DAY;
  const usedHours = dayAssignments.reduce((sum, a) => sum + a.hours, 0);
  const freeHours = maxHours - usedHours;
  const fillPercent = (usedHours / maxHours) * 100;

  const isVacation = day.status === 'vacation';
  const isHoliday = day.status === 'holiday';
  const isShort = day.status === 'short';
  const isNonWorking = isVacation || isHoliday;
  const isToday = new Date().toDateString() === day.date.toDateString();

  const freeHoursColor = freeHours === 0 ? theme.danger : freeHours <= 2 ? theme.warning : theme.success;
  const freeHoursBg = freeHours === 0 ? `${theme.danger}15` : freeHours <= 2 ? `${theme.warning}15` : `${theme.success}15`;

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    const assignmentId = e.dataTransfer.getData('assignmentId');
    const sourceDayId = e.dataTransfer.getData('sourceDayId');
    if (!taskId) return;
    if (assignmentId && sourceDayId && sourceDayId !== day.id) {
      const assignment = assignments.find(a => a.id === assignmentId);
      if (assignment && freeHours >= assignment.hours) { onMoveAssignment(assignmentId, day.id); return; }
      if (freeHours > 0) { setPendingTaskId(taskId); setPendingAssignmentId(assignmentId); setShowDropMenu(true); }
      return;
    }
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (freeHours > 0) { setPendingTaskId(taskId); setPendingAssignmentId(null); setShowDropMenu(true); }
  };

  const handleQuickDrop = (hours: number) => {
    if (pendingTaskId) {
      if (pendingAssignmentId) onRemoveAssignment(pendingAssignmentId);
      onDropTask(pendingTaskId, day.id, hours);
      setShowDropMenu(false); setPendingTaskId(null); setPendingAssignmentId(null);
    }
  };

  const getTaskForAssignment = (assignment: TaskAssignment) => tasks.find((t) => t.id === assignment.taskId);

  return (
    <div onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      className="day-column"
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', borderRadius: 12, minHeight: isMobile ? 120 : 180, height: '100%', transition: 'all 0.2s',
        background: !isActiveMonth ? theme.bgTertiary : isVacation ? `${theme.warning}10` : isHoliday ? `${theme.accent2}10` : cardBg,
        border: `${isToday ? '3px' : '1px'} solid ${!isActiveMonth ? theme.borderPrimary : isToday ? theme.accent1 : isDragOver ? theme.accent1 : isVacation ? theme.warning : isHoliday ? theme.accent2 : theme.borderPrimary}`,
        opacity: !isActiveMonth ? 0.4 : isNonWorking ? 0.7 : 1,
        boxShadow: isDragOver ? `0 0 0 2px ${theme.accent1}30` : theme.shadow,
        overflow: 'hidden', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      
      {/* Header */}
      <div style={{ padding: '10px 12px', borderBottom: `1px solid ${theme.borderPrimary}`, background: isToday ? `${theme.accent1}08` : isVacation ? `${theme.warning}15` : isHoliday ? `${theme.accent2}15` : 'transparent', borderRadius: '12px 12px 0 0', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: theme.textTertiary }}>{getDayName(day.dayOfWeek)}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: isToday ? theme.accent1 : theme.textPrimary }}>{formatDate(day.date)}</span>
            {isVacation && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: theme.warning, color: '#fff' }}>Отпуск</span>}
            {isHoliday && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: theme.accent2, color: '#fff' }}>Выходной</span>}
            {isShort && <span title="Короткий день" style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: theme.accent1, color: '#fff' }}>К.д.</span>}

          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {isActiveMonth && !isNonWorking && <div style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 12, background: freeHoursBg, color: freeHoursColor }}>{formatHours(freeHours)}</div>}
            <button ref={dayMenuButtonRef} onClick={() => setShowDayMenu(!showDayMenu)} style={{ padding: 4, borderRadius: 4, border: 'none', cursor: 'pointer', background: 'transparent', color: theme.textTertiary }} title="Отметить день">
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/></svg>
            </button>
          </div>
        </div>
        {isActiveMonth && !isNonWorking && <div style={{ marginTop: 8, height: 4, background: theme.bgTertiary, borderRadius: 2, overflow: 'hidden' }}><div style={{ height: '100%', borderRadius: 2, transition: 'width 0.5s', width: `${Math.min(fillPercent, 100)}%`, background: fillPercent >= 100 ? theme.danger : fillPercent >= 75 ? theme.warning : theme.success }} /></div>}
      </div>

      {/* Day status menu — рендерится через portal в document.body, чтобы не обрезаться overflow: hidden карточки дня */}
      {showDayMenu && dayMenuPos && createPortal(
        <>
          {/* Прозрачный оверлей: клик вне меню закрывает его */}
          <div onClick={() => setShowDayMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 9999 }} />
          <div style={{
            position: 'fixed',
            top: dayMenuPos.top,
            left: dayMenuPos.left,
            transform: 'translateX(-100%)',
            zIndex: 10000,
            background: theme.bgCard,
            border: `1px solid ${theme.borderPrimary}`,
            borderRadius: 8,
            boxShadow: theme.shadowLg,
            padding: 4,
            minWidth: dayMenuPos.minWidth,
          }}>
            <button onClick={() => { onSetDayStatus(day.id, 'working'); setShowDayMenu(false); }} disabled={!isNonWorking && !isShort} style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: !isNonWorking && !isShort ? theme.bgSecondary : 'transparent', color: !isNonWorking && !isShort ? theme.textPrimary : theme.textTertiary, fontSize: 13, textAlign: 'left', cursor: !isNonWorking && !isShort ? 'default' : 'pointer', borderRadius: 4 }}>Рабочий день</button>
            <button onClick={() => { onSetDayStatus(day.id, 'vacation'); setShowDayMenu(false); }} disabled={isVacation} style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: isVacation ? `${theme.warning}20` : 'transparent', color: isVacation ? theme.warning : theme.textPrimary, fontSize: 13, textAlign: 'left', cursor: isVacation ? 'default' : 'pointer', borderRadius: 4 }}>Отпуск</button>
            <button onClick={() => { onSetDayStatus(day.id, 'holiday'); setShowDayMenu(false); }} disabled={isHoliday} style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: isHoliday ? `${theme.accent2}20` : 'transparent', color: isHoliday ? theme.accent2 : theme.textPrimary, fontSize: 13, textAlign: 'left', cursor: isHoliday ? 'default' : 'pointer', borderRadius: 4 }}>Выходной</button>
            <button onClick={() => { setShowDayMenu(false); setShowShortDayInput(true); setShortDayHours(day.shortHours?.toString() || '6'); }} disabled={isShort} style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: isShort ? `${theme.accent1}20` : 'transparent', color: isShort ? theme.accent1 : theme.textPrimary, fontSize: 13, textAlign: 'left', cursor: isShort ? 'default' : 'pointer', borderRadius: 4 }}>Короткий день</button>
          </div>
        </>,
        document.body
      )}

      {/* Task blocks */}
      <div style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {isActiveMonth && dayAssignments.map((assignment) => {
          const task = getTaskForAssignment(assignment);
          if (!task) return null;
          const isCompleted = task.status === 'completed';
          const taskColor = isCompleted ? theme.textTertiary : task.color;
          const taskBg = isCompleted ? `${theme.textTertiary}15` : `${task.color}15`;
          return (
            <div key={assignment.id} draggable onDragStart={(e) => { e.dataTransfer.setData('taskId', task.id); e.dataTransfer.setData('assignmentId', assignment.id); e.dataTransfer.setData('sourceDayId', day.id); e.dataTransfer.effectAllowed = 'move'; }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={(e) => {
                e.preventDefault(); e.stopPropagation();
                const draggedAssignmentId = e.dataTransfer.getData('assignmentId');
                const draggedTaskId = e.dataTransfer.getData('taskId');
                const sourceDayId = e.dataTransfer.getData('sourceDayId');
                if (sourceDayId && sourceDayId !== day.id) return;
                if (draggedAssignmentId && draggedAssignmentId !== assignment.id) {
                  setShowDropMenu(false);
                  if (draggedTaskId === task.id && onMergeAssignments) onMergeAssignments(draggedAssignmentId, assignment.id);
                  else if (onReorderAssignment) onReorderAssignment(draggedAssignmentId, assignment.id);
                }
              }}
              className="day-task-block"
              style={{ position: 'relative', borderRadius: 8, padding: '8px 10px', cursor: 'grab', transition: 'all 0.2s', background: taskBg, borderLeft: `3px solid ${taskColor}`, opacity: isCompleted ? 0.6 : 1 }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = theme.shadowLg; e.currentTarget.style.transform = 'scale(1.02)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'scale(1)'; }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: taskColor }}>{task.title}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6, background: isCompleted ? `${theme.textTertiary}20` : `${task.color}20`, color: taskColor }}>{formatHours(assignment.hours)}</span>
                  <button onClick={(e) => { e.stopPropagation(); setSplittingAssignmentId(assignment.id); setShowSplitMenu(true); }} className="day-task-btn" style={{ padding: 4, borderRadius: 4, border: 'none', cursor: 'pointer', background: 'transparent', color: theme.textTertiary, opacity: 0 }} title="Разделить">
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onRemoveAssignment(assignment.id); }} className="day-task-btn" style={{ padding: 4, borderRadius: 4, border: 'none', cursor: 'pointer', background: 'transparent', color: theme.textTertiary, opacity: 0 }} title="Убрать">
                    <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {isActiveMonth && isDragOver && !showDropMenu && <div style={{ border: `2px dashed ${theme.accent1}50`, borderRadius: 8, padding: 16, background: `${theme.accent1}08`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ fontSize: 12, color: theme.accent1, fontWeight: 500 }}>Отпустите здесь</span></div>}
      </div>

      {/* Drop menu */}
      {showDropMenu && pendingTaskId && (() => {
        const task = tasks.find(t => t.id === pendingTaskId);
        if (!task) return null;
        const alreadyAssigned = assignments.filter(a => a.taskId === pendingTaskId).reduce((sum, a) => sum + a.hours, 0);
        const maxAssignable = Math.min(task.totalHours - alreadyAssigned, freeHours);
        return (
          <div style={{ position: 'absolute', inset: 0, background: `${theme.bgCard}f5`, backdropFilter: 'blur(4px)', borderRadius: 12, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, border: `2px solid ${theme.accent1}50`, boxShadow: theme.shadowLg }}>
            <p style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4, fontWeight: 500 }}>Сколько часов назначить?</p>
            <p style={{ fontSize: 10, color: theme.textTertiary, marginBottom: 12 }}>Свободно: {formatHours(freeHours)} из {maxHours}ч</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12, width: '100%' }}>
              {[0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4].filter(h => h <= maxAssignable).map((h) => (
                <button key={h} onClick={() => handleQuickDrop(h)} style={{ height: 36, borderRadius: 8, background: `${theme.accent1}15`, color: theme.accent1, fontWeight: 700, fontSize: 12, border: `1px solid ${theme.accent1}30`, cursor: 'pointer' }}>{formatHours(h)}</button>
              ))}
            </div>
            <div style={{ width: '100%' }}>
              <input type="text" placeholder="или введите чч:мм" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, border: `1px solid ${theme.borderPrimary}`, background: theme.bgCard, color: theme.textPrimary, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                onKeyDown={e => { if (e.key === 'Enter') { const value = (e.target as HTMLInputElement).value; const parsed = parseTimeInput(value); if (parsed !== null && parsed > 0 && parsed <= freeHours) handleQuickDrop(parsed); } }} />
              <div style={{ fontSize: 10, color: theme.textTertiary, marginTop: 4, textAlign: 'center' }}>порог 15 минут</div>
            </div>
            <button onClick={() => { setShowDropMenu(false); setPendingTaskId(null); setPendingAssignmentId(null); }} style={{ marginTop: 12, fontSize: 12, color: theme.textTertiary, background: 'none', border: 'none', cursor: 'pointer' }}>Отмена</button>
          </div>
        );
      })()}

      {/* Split menu */}
      {showSplitMenu && splittingAssignmentId && (() => {
        const assignment = assignments.find(a => a.id === splittingAssignmentId);
        if (!assignment) return null;
        const handleSplit = (hours: number) => { if (hours > 0 && hours < assignment.hours) { onSplitAssignment(splittingAssignmentId, hours); setShowSplitMenu(false); setSplittingAssignmentId(null); } };
        return (
          <div style={{ position: 'absolute', inset: 0, background: `${theme.bgCard}f5`, backdropFilter: 'blur(4px)', borderRadius: 12, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, border: `2px solid ${theme.accent1}50`, boxShadow: theme.shadowLg }}>
            <p style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4, fontWeight: 500 }}>Сколько времени отделить?</p>
            <p style={{ fontSize: 10, color: theme.textTertiary, marginBottom: 12 }}>Текущее время: {formatHours(assignment.hours)}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12, width: '100%' }}>
              {[0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4].filter(h => h < assignment.hours).map((h) => (
                <button key={h} onClick={() => handleSplit(h)} style={{ height: 36, borderRadius: 8, background: `${theme.accent1}15`, color: theme.accent1, fontWeight: 700, fontSize: 12, border: `1px solid ${theme.accent1}30`, cursor: 'pointer' }}>{formatHours(h)}</button>
              ))}
            </div>
            <div style={{ width: '100%' }}>
              <input type="text" placeholder="или введите чч:мм" style={{ width: '100%', padding: '8px 12px', borderRadius: 8, fontSize: 13, border: `1px solid ${theme.borderPrimary}`, background: theme.bgCard, color: theme.textPrimary, outline: 'none', textAlign: 'center', boxSizing: 'border-box' }}
                onKeyDown={e => { if (e.key === 'Enter') { const value = (e.target as HTMLInputElement).value; const parsed = parseTimeInput(value); if (parsed !== null && parsed > 0 && parsed < assignment.hours) handleSplit(parsed); } }} />
              <div style={{ fontSize: 10, color: theme.textTertiary, marginTop: 4, textAlign: 'center' }}>порог 15 минут</div>
            </div>
            <button onClick={() => { setShowSplitMenu(false); setSplittingAssignmentId(null); }} style={{ marginTop: 12, fontSize: 12, color: theme.textTertiary, background: 'none', border: 'none', cursor: 'pointer' }}>Отмена</button>
          </div>
        );
      })()}

      {/* Short day input modal */}
      {showShortDayInput && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2147483647, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => { setShowShortDayInput(false); setShortDayHours(''); }}>
          <div style={{ background: theme.bgCard, borderRadius: 12, padding: 24, boxShadow: theme.shadowLg, maxWidth: 400, width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <p style={{ fontSize: 14, color: theme.textPrimary, marginBottom: 16, fontWeight: 600 }}>Укажите количество часов</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
              {[4, 5, 6, 7].map((h) => (
                <button key={h} onClick={() => setShortDayHours(h.toString())} style={{ width: 56, height: 44, borderRadius: 8, background: shortDayHours === h.toString() ? theme.accent1 : `${theme.accent1}15`, color: shortDayHours === h.toString() ? '#fff' : theme.accent1, fontWeight: 700, fontSize: 14, border: `1px solid ${shortDayHours === h.toString() ? theme.accent1 : theme.accent1 + '30'}`, cursor: 'pointer' }}>{h}ч</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { const hours = parseFloat(shortDayHours); if (hours > 0 && hours < HOURS_PER_DAY) { onSetDayStatus(day.id, 'short', hours); setShowShortDayInput(false); } }} disabled={!shortDayHours || parseFloat(shortDayHours) <= 0 || parseFloat(shortDayHours) >= HOURS_PER_DAY} style={{ flex: 1, padding: '10px 16px', background: theme.accent1, color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: !shortDayHours || parseFloat(shortDayHours) <= 0 || parseFloat(shortDayHours) >= HOURS_PER_DAY ? 0.5 : 1 }}>Сохранить</button>
              <button onClick={() => { setShowShortDayInput(false); setShortDayHours(''); }} style={{ flex: 1, padding: '10px 16px', background: theme.bgSecondary, color: theme.textSecondary, border: `1px solid ${theme.borderPrimary}`, borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      <style>{`.day-task-block:hover .day-task-btn { opacity: 1 !important; }`}</style>
    </div>
  );
}
