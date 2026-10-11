import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Task } from './types';
import { getMonthName } from './utils/dateUtils';
import TaskForm from './components/TaskForm';
import TaskCard from './components/TaskCard';
import CompletedTasksList from './components/CompletedTasksList';
import EditTaskModal from './components/EditTaskModal';
import SearchFilter from './components/SearchFilter';
import ExportModal from './components/ExportModal';
import AuthScreen, { Profile } from './components/AuthScreen';
import Header from './components/Header';
import WeekRow from './components/WeekRow';
import SidebarCollapsed, { HintBanner } from './components/Sidebar';
import { Spinner } from './components/ui';
// Redmine интеграция - временно скрыта из-за проблем с CORS
// import RedmineSettingsModal from './components/RedmineSettingsModal';
// import RedmineImportModal from './components/RedmineImportModal';
import { exportToExcel } from './utils/excelExport';
import { loadTasks, loadAssignments, saveTasks, saveAssignments, setCurrentProfile } from './services/storageService';
// import { getRedmineSettings, RedmineSettings } from './services/redmineService';
import { useTheme } from './ThemeContext';
import { useTaskBoard, DayStatusEntry } from './hooks/useTaskBoard';
import { useFeedScroll, useWeeksFeed, findCurrentWeekId } from './hooks/useFeedScroll';
import { useFilteredTasks, useMonthStats } from './hooks/useMonthStats';

const MOBILE_BREAKPOINT = 768;

/**
 * Корневой компонент планировщика.
 * Состоит из оркестрируемых хуков:
 * - useTaskBoard — задачи и назначения (вся доменная логика доски);
 * - useWeeksFeed + useFeedScroll — лента недель и её прокрутка;
 * - useMonthStats / useFilteredTasks — метрики месяца и фильтрация списка.
 */
function App() {
  const { theme, mode, toggleTheme } = useTheme();

  // ── Авторизация и профиль ────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // ── Календарная навигация ────────────────────────────────────────────
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const [visibleMonth, setVisibleMonth] = useState({ month: currentMonth, year: currentYear });

  // ── Доска задач ──────────────────────────────────────────────────────
  const board = useTaskBoard();
  const { tasks, assignments } = board;

  // ── Статусы дней (отпуск / выходной / короткий день) ─────────────────
  const [dayStatuses, setDayStatuses] = useState<Record<string, DayStatusEntry>>({});

  // ── UI-состояние ─────────────────────────────────────────────────────
  const [, setDraggedTaskId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showHint, setShowHint] = useState(() => !localStorage.getItem('planner-hint-dismissed'));
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < MOBILE_BREAKPOINT);
  const [showSidebar, setShowSidebar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'completed'>('all');
  const [showExportModal, setShowExportModal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  // const [redmineSettings, setRedmineSettings] = useState<RedmineSettings | null>(null);
  // const [showRedmineSettings, setShowRedmineSettings] = useState(false);
  // const [showRedmineImport, setShowRedmineImport] = useState(false);

  const weeksContainerRef = useRef<HTMLDivElement>(null);

  // ── Лента недель и прокрутка ─────────────────────────────────────────
  const weeks = useWeeksFeed(currentYear);

  const currentWeekId = useMemo(() => findCurrentWeekId(weeks), [weeks]);

  const { scrollToMonth } = useFeedScroll(weeksContainerRef, weeks, currentWeekId, visibleMonth, setVisibleMonth);

  // ── Метрики и фильтрация ─────────────────────────────────────────────
  const { totalWorkingHours, remainingWorkingHours } = useMonthStats(assignments, dayStatuses, currentYear, currentMonth);
  const filteredTasks = useFilteredTasks(tasks, searchQuery, statusFilter);

  const newTasks = useMemo(() => filteredTasks.filter((t) => t.status !== 'completed'), [filteredTasks]);
  const completedCount = useMemo(() => tasks.filter((t) => t.status === 'completed').length, [tasks]);
  const activeTasks = useMemo(() => tasks.filter((t) => t.status !== 'completed'), [tasks]);
  const newTasksTotalHours = useMemo(() => activeTasks.reduce((sum, t) => sum + t.totalHours, 0), [activeTasks]);

  // ── Эффекты: восстановление сессии, данные профиля, сохранение ──────
  useEffect(() => {
    const savedLogin = localStorage.getItem('planner-current-user');
    if (savedLogin) {
      try {
        const profiles = JSON.parse(localStorage.getItem('planner-profiles') || '[]');
        const profile = profiles.find((p: Profile) => p.login === savedLogin);
        if (profile) {
          setCurrentUser(profile);
          setCurrentProfile(profile);
        }
      } catch (e) {
        console.error('Error loading profile:', e);
      }
    }
    setAuthChecked(true);

    // Загрузка настроек Redmine
    // const settings = getRedmineSettings();
    // if (settings) setRedmineSettings(settings);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }
      try {
        const [savedTasks, savedAssignments] = await Promise.all([loadTasks(), loadAssignments()]);
        if (savedTasks.length > 0) board.setTasks(savedTasks);
        if (savedAssignments.length > 0) board.setAssignments(savedAssignments);
        const savedDayStatuses = localStorage.getItem(`planner-day-statuses-${currentUser.login}`);
        if (savedDayStatuses) setDayStatuses(JSON.parse(savedDayStatuses));
      } catch (error) {
        console.error('Error loading ', error);
      } finally {
        setIsLoading(false);
      }
    }
    if (authChecked) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, authChecked]);

  useEffect(() => {
    if (!isLoading && currentUser) saveTasks(tasks);
  }, [tasks, isLoading, currentUser]);
  useEffect(() => {
    if (!isLoading && currentUser) saveAssignments(assignments);
  }, [assignments, isLoading, currentUser]);

  // ── Обработчики ──────────────────────────────────────────────────────
  const toggleHint = () => {
    const newState = !showHint;
    setShowHint(newState);
    if (!newState) localStorage.setItem('planner-hint-dismissed', 'true');
    else localStorage.removeItem('planner-hint-dismissed');
  };

  const handleExport = async (startDate: string, endDate: string) => {
    try {
      await exportToExcel(tasks, assignments, startDate, endDate);
      setShowExportModal(false);
    } catch (error) {
      console.error('Export error:', error);
      alert('Ошибка при экспорте: ' + (error as Error).message);
    }
  };

  const setDayStatus = useCallback(
    (dayId: string, status: 'vacation' | 'holiday' | 'short' | 'working', hours?: number) => {
      setDayStatuses((prev) => {
        const updated = { ...prev };
        if (status === 'working') delete updated[dayId];
        else if (status === 'short') updated[dayId] = { status: 'short', hours };
        else updated[dayId] = { status };
        localStorage.setItem(`planner-day-statuses-${currentUser?.login}`, JSON.stringify(updated));
        return updated;
      });
    },
    [currentUser],
  );

  const handleSaveTask = useCallback(
    (updatedTask: Task) => {
      board.editTask(updatedTask);
      setEditingTask(null);
    },
    [board],
  );

  const handleLogin = (profile: Profile) => {
    setCurrentUser(profile);
    setCurrentProfile(profile);
    localStorage.setItem('planner-current-user', profile.login);
    setIsLoading(true);
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    setCurrentProfile(null);
    localStorage.removeItem('planner-current-user');
    board.resetBoard();
  };

  // ── Экраны загрузки / авторизации ────────────────────────────────────
  if (!authChecked) return <Spinner label="Загрузка..." />;
  if (!currentUser) return <AuthScreen onLogin={handleLogin} />;
  if (isLoading) return <Spinner label="Загрузка данных..." />;

  return (
    <div style={{ minHeight: '100vh', background: theme.bgPrimary, transition: 'background 0.3s ease' }}>
      <Header
        isMobile={isMobile}
        visibleMonth={visibleMonth}
        monthName={getMonthName(visibleMonth.month)}
        displayName={currentUser.displayName}
        showHint={showHint}
        mode={mode}
        newTasksCount={activeTasks.length}
        newTasksHours={newTasksTotalHours}
        remainingWorkingHours={remainingWorkingHours}
        totalWorkingHours={totalWorkingHours}
        onPrevMonth={() => scrollToMonth(-1)}
        onNextMonth={() => scrollToMonth(1)}
        onToggleHint={toggleHint}
        onOpenExport={() => setShowExportModal(true)}
        onToggleTheme={toggleTheme}
        onSignOut={handleSignOut}
      />

      <div
        style={{
          maxWidth: 1800,
          margin: '0 auto',
          display: 'flex',
          gap: isMobile ? 0 : 16,
          padding: isMobile ? 8 : 16,
          flexDirection: isMobile ? 'column' : 'row',
        }}
      >
        {/* Плавающая кнопка открытия сайдбара на мобильных */}
        {isMobile && (
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            style={{
              position: 'fixed',
              bottom: 20,
              right: 20,
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: theme.accent1,
              color: '#fff',
              border: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              cursor: 'pointer',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}

        <aside
          style={{
            width: isMobile ? '100%' : isSidebarCollapsed ? '5%' : 288,
            flexShrink: 0,
            display: isMobile && !showSidebar ? 'none' : 'flex',
            flexDirection: 'column',
            gap: 16,
            position: isMobile ? 'fixed' : 'sticky',
            top: isMobile ? 0 : 72,
            left: isMobile ? 0 : undefined,
            right: isMobile ? 0 : undefined,
            bottom: isMobile ? 0 : undefined,
            background: isMobile ? theme.bgPrimary : 'transparent',
            zIndex: isMobile ? 99 : 1,
            padding: isMobile ? 16 : 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            maxHeight: isMobile ? '100vh' : 'calc(100vh - 88px)',
            transition: 'width 0.3s ease',
          }}
        >
          {isMobile && (
            <button
              onClick={() => setShowSidebar(false)}
              style={{
                alignSelf: 'flex-end',
                padding: 8,
                borderRadius: 8,
                border: 'none',
                background: theme.bgSecondary,
                color: theme.textSecondary,
                cursor: 'pointer',
                marginBottom: 8,
              }}
            >
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {isSidebarCollapsed && !isMobile ? (
            <SidebarCollapsed
              newTaskCount={activeTasks.length}
              completedTaskCount={completedCount}
              onExpand={() => setIsSidebarCollapsed(false)}
            />
          ) : (
            <>
              <div
                style={{
                  background: theme.bgCard,
                  borderRadius: 16,
                  border: `1px solid ${theme.borderPrimary}`,
                  padding: 16,
                  boxShadow: theme.shadow,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary, margin: 0 }}>Мои задачи</h3>
                  <button
                    onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                    style={{
                      padding: 4,
                      borderRadius: 6,
                      border: 'none',
                      background: 'transparent',
                      color: theme.textTertiary,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = theme.bgHover;
                      e.currentTarget.style.color = theme.textPrimary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = theme.textTertiary;
                    }}
                    title="Свернуть панель"
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                  </button>
                </div>
                <TaskForm onAddTask={board.addTask} />
              </div>

              {/* Redmine интеграция - временно скрыта из-за проблем с CORS */}

              <SearchFilter
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />

              {newTasks.length > 0 && (
                <div
                  style={{
                    background: theme.bgCard,
                    borderRadius: 16,
                    border: `1px solid ${theme.borderPrimary}`,
                    padding: 16,
                    boxShadow: theme.shadow,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    width: '100%',
                    boxSizing: 'border-box',
                    overflow: 'hidden',
                  }}
                >
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary, marginBottom: 12, flexShrink: 0 }}>
                    Новые задачи ({newTasks.length})
                  </h3>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      overflowY: 'auto',
                      overflowX: 'hidden',
                      flex: 1,
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    {newTasks.map((task) => (
                      <div key={task.id} className="task-card-wrapper">
                        <TaskCard
                          task={task}
                          assignedHours={board.getTaskAssignedHours(task.id)}
                          totalAssignedHours={board.getTaskAssignedHours(task.id)}
                          onDragStart={setDraggedTaskId}
                          onComplete={board.completeTask}
                          onEdit={setEditingTask}
                          onDelete={board.deleteTask}
                          onReorder={board.reorderTask}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <CompletedTasksList
                tasks={filteredTasks}
                assignments={assignments}
                days={weeks.flatMap((w) => w.days)}
                onReturnToNew={board.returnToNew}
              />

              {newTasks.length === 0 && filteredTasks.filter((t) => t.status === 'completed').length === 0 && (
                <div
                  style={{
                    background: theme.bgSecondary,
                    borderRadius: 16,
                    border: `1px solid ${theme.borderPrimary}`,
                    padding: 24,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                  <p style={{ fontSize: 14, color: theme.textTertiary }}>
                    Создайте первую задачу,
                    <br />
                    чтобы начать планирование
                  </p>
                </div>
              )}
            </>
          )}
        </aside>

        <main style={{ flex: 1, minWidth: 0 }}>
          {showHint && <HintBanner onDismiss={toggleHint} />}
          <div
            ref={weeksContainerRef}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              maxHeight: 'calc(100vh - 200px)',
              overflowY: 'auto',
              paddingRight: 8,
              scrollMarginTop: 90,
            }}
          >
            {weeks.map((week) => (
              <div key={week.id} id={`week-${week.id}`} style={{ scrollMarginTop: 90 }}>
                <WeekRow
                  week={week}
                  tasks={tasks}
                  assignments={assignments}
                  dayStatuses={dayStatuses}
                  onDropTask={board.dropTask}
                  onRemoveAssignment={board.removeAssignment}
                  onSplitAssignment={board.splitAssignment}
                  onMoveAssignment={board.moveAssignment}
                  onSetDayStatus={setDayStatus}
                  onReorderAssignment={board.reorderAssignment}
                  onMergeAssignments={board.mergeAssignments}
                  isMobile={isMobile}
                  isCurrentWeek={week.id === currentWeekId}
                  visibleMonth={visibleMonth}
                  currentWeekId={currentWeekId}
                />
              </div>
            ))}
          </div>
        </main>
      </div>

      {editingTask && <EditTaskModal task={editingTask} onSave={handleSaveTask} onCancel={() => setEditingTask(null)} />}
      {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} onExport={handleExport} />}

      <footer style={{ maxWidth: 1800, margin: '32px auto 0', padding: '24px 16px', borderTop: `1px solid ${theme.borderPrimary}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: theme.textTertiary }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📅</span>
            <span>CalmDesk</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span>Сделано с ❤️</span>
            <a
              href="https://github.com/lylelit/monthly-planner2"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: theme.textTertiary, textDecoration: 'none' }}
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
