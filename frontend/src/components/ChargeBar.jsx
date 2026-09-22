
export default function ChargeBar({ percent = 0, startPercent = null, targetPercent = null, showLabel = true, height = 'h-4', animated = true }) {
  const clamped = Math.max(0, Math.min(100, percent));
  const start = startPercent !== null ? Math.max(0, Math.min(100, startPercent)) : null;

  return (
    <div className="w-full">
      <div className={`relative w-full ${height} rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden`}>
        {/* Base fill representing the battery level the vehicle already had
            before this session started, shown as a dimmer static block so
            the animated bar visibly represents only the charging progress
            added during this session. */}
        {start !== null && start > 0 && (
          <div className="absolute inset-y-0 left-0 bg-slate-400/50 dark:bg-slate-600/50 rounded-full" style={{ width: `${start}%` }} />
        )}

        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-500 via-volt-500 to-volt-400 transition-all duration-700 ease-out ${animated ? 'bg-[length:200%_100%] animate-charge-flow' : ''}`}
          style={{ width: `${clamped}%` }}
        />

        {/* Target marker line */}
        {targetPercent !== null && targetPercent < 100 && (
          <div
            className="absolute inset-y-0 w-0.5 bg-slate-900 dark:bg-white/90"
            style={{ left: `${Math.max(0, Math.min(100, targetPercent))}%` }}
            title={`Target: ${targetPercent}%`}
          />
        )}
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-slate-500 dark:text-slate-400">
          <span>{clamped.toFixed(0)}%{start !== null ? ` (started at ${start.toFixed(0)}%)` : ''}</span>
          {targetPercent !== null && (
            <span>{clamped >= targetPercent ? <span className="text-brand-600 font-medium">Target reached</span> : `Target ${targetPercent}%`}</span>
          )}
        </div>
      )}
    </div>
  );
}


