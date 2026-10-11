import { IconButton } from './ui';
import { useTheme } from '../ThemeContext';
import { formatHours } from '../utils/timeFormat';

interface HeaderProps {
  isMobile: boolean;
  visibleMonth: { month: number; year: number };
  monthName: string;
  displayName: string;
  showHint: boolean;
  mode: 'light' | 'dark';
  /** Суммарные счётчики для шапки: новые задачи (шт/часы) и рабочее время. */
  newTasksCount: number;
  newTasksHours: number;
  remainingWorkingHours: number;
  totalWorkingHours: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToggleHint: () => void;
  onOpenExport: () => void;
  onToggleTheme: () => void;
  onSignOut: () => void;
}

const CalendarIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} fill="none" stroke="white" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

/** Липкая шапка приложения: навигация по месяцам, подсказка, экспорт, тема, профиль. */
export default function Header({
  isMobile,
  visibleMonth,
  monthName,
  displayName,
  showHint,
  mode,
  newTasksCount,
  newTasksHours,
  remainingWorkingHours,
  totalWorkingHours,
  onPrevMonth,
  onNextMonth,
  onToggleHint,
  onOpenExport,
  onToggleTheme,
  onSignOut,
}: HeaderProps) {
  const { theme } = useTheme();
  const iconSize = isMobile ? 16 : 20;

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 30,
        background: `${theme.bgCard}ee`,
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${theme.borderPrimary}`,
      }}
    >
      <div
        style={{
          maxWidth: 1800,
          margin: '0 auto',
          padding: isMobile ? '8px 12px' : '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: isMobile ? 8 : 16,
        }}
      >
        {/* Логотип и название */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: isMobile ? 28 : 32,
                height: isMobile ? 28 : 32,
                borderRadius: 8,
                background: theme.accent1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CalendarIcon size={iconSize} />
            </div>
            {!isMobile && (
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: theme.textPrimary, margin: 0, lineHeight: 1.2 }}>
                  CalmDesk
                </h1>
                <div style={{ fontSize: 12, color: theme.textTertiary, marginTop: 2 }}>
                  Будь в балансе. Переработки - фу
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Навигация по месяцам */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
          <IconButton onClick={onPrevMonth} bordered={false}>
            <svg width={iconSize} height={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </IconButton>
          <h2
            style={{
              fontSize: isMobile ? 14 : 16,
              fontWeight: 600,
              color: theme.textPrimary,
              minWidth: isMobile ? 120 : 160,
              textAlign: 'center',
              margin: 0,
            }}
          >
            {monthName} {visibleMonth.year}
          </h2>
          <IconButton onClick={onNextMonth} bordered={false}>
            <svg width={iconSize} height={iconSize} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </IconButton>
        </div>

        {/* Правая группа: подсказка, экспорт, тема, профиль, сводки */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {!showHint && (
            <IconButton onClick={onToggleHint} title="Показать подсказку">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </IconButton>
          )}
          <IconButton onClick={onOpenExport} title="Экспорт в Excel">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </IconButton>

          {/* Переключатель темы */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" fill="none" stroke={theme.textTertiary} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="5" />
              <path strokeLinecap="round" d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
            <button
              onClick={onToggleTheme}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                border: 'none',
                background: mode === 'dark' ? theme.accent1 : theme.bgTertiary,
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.3s ease',
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: '#fff',
                  position: 'absolute',
                  top: 3,
                  left: mode === 'dark' ? 23 : 3,
                  transition: 'left 0.3s ease',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              />
            </button>
            <svg width="16" height="16" fill="none" stroke={theme.textTertiary} viewBox="0 0 24 24">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </div>

          {/* Профиль */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8 }}>
            {!isMobile && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: theme.textTertiary }}>Профиль</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>{displayName}</div>
              </div>
            )}
            <IconButton onClick={onSignOut} title="Выйти">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </IconButton>
          </div>

          {!isMobile && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: theme.textTertiary }}>Новые задачи</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: theme.textPrimary }}>
                {newTasksCount} шт / {formatHours(newTasksHours)}
              </div>
            </div>
          )}
          {!isMobile && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: theme.textTertiary }}>Рабочее время</div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: remainingWorkingHours > 0 ? theme.accent4 : theme.accent2,
                }}
              >
                {formatHours(remainingWorkingHours)} / {formatHours(totalWorkingHours)}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
