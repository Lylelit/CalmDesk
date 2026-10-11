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
    height={(size * 324) / 405}
    viewBox="0 0 405 324"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M342.224 3.31363C348.077 -3.1389 360 0.463515 360 8.68473V164H391.5C398.956 164 405 170.044 405 177.5C405 184.956 398.956 191 391.5 191H360V204C360 207.028 359.887 210.029 359.667 213H391.5C398.956 213 405 219.044 405 226.5C405 233.956 398.956 240 391.5 240H354.505C339.214 288.685 293.732 324 240 324H166C112.268 324 66.7864 288.685 51.4951 240H14.5C7.04416 240 1 233.956 1 226.5C1 219.044 7.04416 213 14.5 213H46.333C46.1127 210.029 46 207.028 46 204V191H13.5C6.04416 191 1.27442e-06 184.956 0 177.5C3.14266e-07 170.044 6.04416 164 13.5 164H46V8.68473C46.0004 0.463515 57.9228 -3.1389 63.7764 3.31363L134.246 81.0002H150V66.5002C150 59.0443 156.044 53.0002 163.5 53.0002C170.956 53.0002 177 59.0443 177 66.5002V81.0002H228V66.5002C228 59.0443 234.044 53.0002 241.5 53.0002C248.956 53.0002 255 59.0443 255 66.5002V81.0002H271.754L342.224 3.31363ZM93 160C84.7157 160 78 166.716 78 175V225C78 233.284 84.7157 240 93 240H137C145.284 240 152 233.284 152 225V175C152 166.716 145.284 160 137 160H93ZM180 160C171.716 160 165 166.716 165 175V225C165 233.284 171.716 240 180 240H225C233.284 240 240 233.284 240 225V175C240 166.716 233.284 160 225 160H180ZM268 160C259.716 160 253 166.716 253 175V225C253 233.284 259.716 240 268 240H312C320.284 240 327 233.284 327 225V175C327 166.716 320.284 160 312 160H268ZM95 110C85.6112 110 78 117.611 78 127C78 136.389 85.6112 144 95 144H310C319.389 144 327 136.389 327 127C327 117.611 319.389 110 310 110H95Z"
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
