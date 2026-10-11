/**
 * Панель руководителя (видна только role === 'manager' в supabase-режиме):
 *  - список команды, добавление/удаление сотрудника по email;
 *  - переключатель «моя доска / доска сотрудника»;
 *  - назначение задач сотруднику с явным owner_id (обход RLS разрешён политикой);
 *  - скачивание статистики выполненных задач сотрудника (Excel).
 */
import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../ThemeContext';
import { fetchMyTeam, addTeamMemberByEmail, removeTeamMember, isTeamFeatureEnabled, type TeamMember } from '../services/teamService';
import { loadTasks, loadAssignments } from '../services/storageService';
import { exportToExcel } from '../utils/excelExport';
import type { Task } from '../types';

interface TeamPanelProps {
  viewingEmployeeId: string | null;
  onSwitchBoard: (employeeId: string | null) => void;
}

const TASK_COLORS = ['#3996D2', '#E56B6F', '#6BAF6B', '#D4A017', '#8B5CF6'];

export default function TeamPanel({ viewingEmployeeId, onSwitchBoard }: TeamPanelProps) {
  const { theme } = useTheme();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Быстрое назначение задачи сотруднику
  const [assignTarget, setAssignTarget] = useState<TeamMember | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskHours, setTaskHours] = useState('8');

  const refreshTeam = useCallback(async () => {
    try {
      setTeam(await fetchMyTeam());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    if (isTeamFeatureEnabled) void refreshTeam();
  }, [refreshTeam]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await addTeamMemberByEmail(email);
      setEmail('');
      await refreshTeam();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (member: TeamMember) => {
    if (!confirm(`Убрать ${member.display_name} из команды?`)) return;
    try {
      await removeTeamMember(member.id);
      if (viewingEmployeeId === member.id) onSwitchBoard(null);
      await refreshTeam();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  /** Руководитель создаёт задачу на доске сотрудника. */
  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTarget || !taskTitle.trim()) return;
    setError('');
    setBusy(true);
    try {
      const existing = await loadTasks({ userId: assignTarget.id });
      const task: Task = {
        id: crypto.randomUUID(),
        title: taskTitle.trim(),
        totalHours: Number(taskHours) || 0,
        color: TASK_COLORS[existing.length % TASK_COLORS.length],
        status: 'new',
        createdAt: new Date().toISOString(),
      };
      // saveTasks принимает ownerId — RLS разрешает менеджеру вставлять задачи сотрудников.
      const { saveTasks } = await import('../services/storageService');
      await saveTasks([...existing, task], assignTarget.id);
      setAssignTarget(null);
      setTaskTitle('');
      setTaskHours('8');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** Excel-отчёт по выполненным задачам сотрудника за год. */
  const handleDownloadStats = async (member: TeamMember) => {
    try {
      const tasks = await loadTasks({ userId: member.id });
      const assignments = await loadAssignments({ userId: member.id });
      const now = new Date();
      await exportToExcel(
        tasks,
        assignments,
        `${now.getFullYear()}-01-01`,
        `${now.getFullYear()}-12-31`,
      );
    } catch (err) {
      setError('Ошибка выгрузки: ' + (err as Error).message);
    }
  };

  if (!isTeamFeatureEnabled) return null;

  const btn = (primary?: boolean): React.CSSProperties => ({
    padding: '8px 12px',
    borderRadius: 8,
    border: primary ? 'none' : `1px solid ${theme.borderPrimary}`,
    background: primary ? theme.accent1 : theme.bgSecondary,
    color: primary ? '#fff' : theme.textPrimary,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  });

  return (
    <div
      style={{
        background: theme.bgCard,
        borderRadius: 16,
        border: `1px solid ${theme.borderPrimary}`,
        padding: 16,
        boxShadow: theme.shadow,
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary, margin: '0 0 12px' }}>
        👥 Команда (руководитель)
      </h3>

      {/* Переключатель доски */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button onClick={() => onSwitchBoard(null)} style={btn(viewingEmployeeId === null)}>
          Моя доска
        </button>
        {team.map((m) => (
          <button key={m.id} onClick={() => onSwitchBoard(m.id)} style={btn(viewingEmployeeId === m.id)} title={m.email}>
            {m.display_name}
          </button>
        ))}
      </div>

      {/* Список сотрудников */}
      {team.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {team.map((m) => (
            <div
              key={m.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                padding: '8px 10px', background: theme.bgSecondary, borderRadius: 8, fontSize: 13,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: theme.textPrimary }}>{m.display_name}</div>
                <div style={{ color: theme.textTertiary, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button style={btn()} onClick={() => void handleDownloadStats(m)} title="Скачать статистику выполненных задач (Excel)">
                  📊 Статистика
                </button>
                <button style={btn(true)} onClick={() => setAssignTarget(m)} title="Назначить задачу сотруднику">
                  + Задача
                </button>
                <button style={{ ...btn(), color: theme.danger }} onClick={() => void handleRemove(m)} title="Убрать из команды">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Форма назначения задачи сотруднику */}
      {assignTarget && (
        <form onSubmit={handleAssignTask} style={{ marginBottom: 12, padding: 12, border: `1px dashed ${theme.borderPrimary}`, borderRadius: 8 }}>
          <div style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 8 }}>
            Новая задача для <b>{assignTarget.display_name}</b>
          </div>
          <input
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Название задачи"
            style={{ width: '100%', padding: 8, borderRadius: 6, border: `1px solid ${theme.borderPrimary}`, background: theme.bgSecondary, color: theme.textPrimary, marginBottom: 8, boxSizing: 'border-box' }}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              value={taskHours}
              onChange={(e) => setTaskHours(e.target.value)}
              min={0}
              style={{ width: 80, padding: 8, borderRadius: 6, border: `1px solid ${theme.borderPrimary}`, background: theme.bgSecondary, color: theme.textPrimary }}
              title="Трудоёмкость, ч"
            />
            <button type="submit" style={btn(true)} disabled={busy}>Добавить</button>
            <button type="button" style={btn()} onClick={() => setAssignTarget(null)}>Отмена</button>
          </div>
        </form>
      )}

      {/* Добавление сотрудника */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email сотрудника"
          style={{ flex: 1, minWidth: 0, padding: 8, borderRadius: 6, border: `1px solid ${theme.borderPrimary}`, background: theme.bgSecondary, color: theme.textPrimary }}
        />
        <button type="submit" style={btn(true)} disabled={busy}>В команду</button>
      </form>

      {error && <div style={{ marginTop: 8, fontSize: 13, color: theme.danger }}>{error}</div>}
    </div>
  );
}
