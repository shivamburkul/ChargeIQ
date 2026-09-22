
export default function AuroraBackground({ variant = 'default' }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-surface-light dark:bg-surface-dark transition-colors duration-500">
      {/* Base grid texture */}
      <div
        className="absolute inset-0 opacity-[0.035] dark:opacity-[0.07]"
        style={{
          backgroundImage: 'linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Animated gradient blobs - light theme: soft green/lime aurora.
          Dark theme: richer, more saturated multi-hue glow (emerald, lime,
          and a cool violet accent) so the dark theme feels designed rather
          than just "light theme colors dimmed down". */}
      <div className="absolute -top-32 -left-24 w-[520px] h-[520px] rounded-full blur-3xl opacity-40 dark:opacity-35 bg-gradient-to-br from-brand-300 via-brand-400 to-volt-400 dark:from-brand-500 dark:via-emerald-400 dark:to-volt-400 animate-drift-bg" />
      <div className="absolute top-1/3 -right-32 w-[480px] h-[480px] rounded-full blur-3xl opacity-30 dark:opacity-30 bg-gradient-to-br from-volt-400 via-brand-500 to-brand-700 dark:from-violet-500 dark:via-brand-600 dark:to-volt-500 animate-drift-bg" style={{ animationDelay: '3s' }} />
      <div className="hidden dark:block absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-3xl opacity-20 bg-gradient-to-br from-sky-500 via-brand-500 to-transparent animate-drift-bg" style={{ animationDelay: '5s' }} />
      {variant === 'auth' && (
        <div className="absolute bottom-0 left-1/3 w-[420px] h-[420px] rounded-full blur-3xl opacity-25 dark:opacity-20 bg-gradient-to-br from-brand-400 to-volt-500 animate-drift-bg" style={{ animationDelay: '6s' }} />
      )}

      {/* Faint starfield accent for dark mode only, echoing the hero
          illustration's night sky for a cohesive feel across pages. */}
      <div className="hidden dark:block absolute inset-0 opacity-40">
        {[...Array(30)].map((_, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: i % 5 === 0 ? 2 : 1,
              height: i % 5 === 0 ? 2 : 1,
              top: `${(i * 37) % 100}%`,
              left: `${(i * 53) % 100}%`,
              opacity: 0.3 + (i % 4) * 0.15,
            }}
          />
        ))}
      </div>

      {/* Soft vignette so content stays readable */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface-light dark:to-surface-dark" />
    </div>
  );
}


