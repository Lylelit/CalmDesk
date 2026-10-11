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

/** Фирменная иконка приложения (белая, для шапки на голубом фоне). */
const AppIcon = ({ size }: { size: number }) => (
  <svg
    width={size}
    height={(size * 331) / 400}
    viewBox="0 0 400 331"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M339.151 3.82324C345.029 -3.62129 357 0.534569 357 10.0195V167.215H389.5C395.299 167.215 400 171.916 400 177.715C400 183.514 395.299 188.215 389.5 188.215H357V209.215H389.5C395.299 209.215 400 213.916 400 219.715C400 225.514 395.299 230.215 389.5 230.215H357L356.991 231.508C356.299 286.14 311.797 330.215 257 330.215H143C88.2031 330.215 43.7001 286.14 43.007 231.508L43 230.215H10.5C4.70101 230.215 0 225.514 0 219.715C0 213.916 4.70101 209.215 10.5 209.215H43V188.215H10.5C4.70101 188.215 0 183.514 0 177.715C0 171.916 4.70101 167.215 10.5 167.215H43V10.0195C43.0001 0.534569 54.9712 -3.62129 60.8486 3.82324L126.684 87.2148H151V71.7148C151 65.9159 155.701 61.2148 161.5 61.2148C167.299 61.2148 172 65.9159 172 71.7148V87.2148H236V71.7148C236 65.9159 240.701 61.2148 246.5 61.2148C252.299 61.2148 257 65.9159 257 71.7148V87.2148H273.316L339.151 3.82324ZM88.5 125.215C82.701 125.215 78 129.916 78 135.715C78 141.514 82.701 146.215 88.5 146.215H316.5C322.299 146.215 327 141.514 327 135.715C327 129.916 322.299 125.215 316.5 125.215H88.5Z"
      fill="white"
    />
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
              <AppIcon size={iconSize} />
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
