
export default function HeroIllustration({ className = '' }) {
  return (
    <svg viewBox="0 0 800 560" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="skyDay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="55%" stopColor="#ecfdf5" />
          <stop offset="100%" stopColor="#f8fafc" />
        </linearGradient>
        <linearGradient id="skyNight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#050912" />
          <stop offset="50%" stopColor="#0b1220" />
          <stop offset="100%" stopColor="#0f1a2e" />
        </linearGradient>
        <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#a7f3d0" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#84cc16" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#84cc16" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="roadDay" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="roadNight" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="carBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient id="carBodyDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="pedestal" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
        <linearGradient id="cableGlow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#84cc16" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>

      {/* ---------------- Sky ---------------- */}
      <rect width="800" height="560" fill="url(#skyDay)" className="dark:opacity-0 transition-opacity duration-500" />
      <rect width="800" height="560" fill="url(#skyNight)" className="opacity-0 dark:opacity-100 transition-opacity duration-500" />

      {/* Sun (day) / Moon glow (night) */}
      <circle cx="640" cy="110" r="140" fill="url(#sunGlow)" className="dark:opacity-0 transition-opacity duration-500" />
      <circle cx="640" cy="100" r="34" fill="#fef9c3" className="dark:opacity-0 transition-opacity duration-500" />
      <circle cx="640" cy="110" r="120" fill="url(#moonGlow)" className="opacity-0 dark:opacity-100 transition-opacity duration-500" />
      <circle cx="640" cy="100" r="26" fill="#f8fafc" className="opacity-0 dark:opacity-100 transition-opacity duration-500" />

      {/* Stars (night only) */}
      <g className="opacity-0 dark:opacity-100 transition-opacity duration-700">
        {[[80,60],[150,120],[230,50],[320,90],[410,40],[500,70],[60,160],[380,150],[220,150],[130,40]].map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.6 : 1} fill="#e2e8f0" opacity={0.8} />
        ))}
      </g>

      {/* ---------------- Skyline ---------------- */}
      <g className="fill-brand-900/10 dark:fill-black/40 transition-colors duration-500">
        <rect x="20" y="260" width="60" height="180" rx="4" />
        <rect x="90" y="220" width="46" height="220" rx="4" />
        <rect x="150" y="290" width="50" height="150" rx="4" />
        <rect x="620" y="240" width="55" height="200" rx="4" />
        <rect x="690" y="200" width="45" height="240" rx="4" />
        <rect x="740" y="270" width="50" height="170" rx="4" />
      </g>
      {/* lit windows, night only */}
      <g className="opacity-0 dark:opacity-100 transition-opacity duration-700">
        {Array.from({ length: 18 }).map((_, i) => {
          const bx = [30, 100, 160, 630, 700, 750][i % 6];
          const by = 280 + (i % 6) * 22;
          return <rect key={i} x={bx} y={by} width="6" height="8" fill="#fde68a" opacity={0.6 + (i % 3) * 0.1} />;
        })}
      </g>

      {/* Distant hills / greenery band */}
      <path d="M0,420 Q200,380 400,410 T800,400 V560 H0 Z" className="fill-brand-200/50 dark:fill-brand-900/30 transition-colors duration-500" />

      {/* ---------------- Ground / road ---------------- */}
      <rect x="0" y="430" width="800" height="130" fill="url(#roadDay)" className="dark:opacity-0 transition-opacity duration-500" />
      <rect x="0" y="430" width="800" height="130" fill="url(#roadNight)" className="opacity-0 dark:opacity-100 transition-opacity duration-500" />

      {/* Charging bay markings */}
      <rect x="230" y="450" width="340" height="100" rx="6" fill="none" stroke="#10b981" strokeWidth="4" strokeDasharray="14 10" opacity="0.55" />
      <g opacity="0.9">
        <rect x="270" y="530" width="26" height="10" rx="2" fill="#84cc16" />
        <rect x="310" y="530" width="26" height="10" rx="2" fill="#0f172a" className="dark:fill-slate-700" />
        <rect x="350" y="530" width="26" height="10" rx="2" fill="#84cc16" />
        <rect x="390" y="530" width="26" height="10" rx="2" fill="#0f172a" className="dark:fill-slate-700" />
      </g>
      {/* EV floor icon */}
      <g transform="translate(300,470)" opacity="0.5">
        <rect width="70" height="44" rx="8" fill="none" stroke="#10b981" strokeWidth="3" />
        <text x="35" y="28" textAnchor="middle" fontSize="20" fill="#10b981" fontFamily="sans-serif">⚡</text>
      </g>

      {/* ---------------- Charging pedestal ---------------- */}
      <g transform="translate(560,330)">
        <rect x="-6" y="120" width="60" height="14" rx="4" fill="#0f172a" opacity="0.15" />
        <rect x="0" y="0" width="48" height="130" rx="10" fill="url(#pedestal)" />
        <rect x="8" y="14" width="32" height="40" rx="6" fill="#052e27" opacity="0.85" />
        <text x="24" y="40" textAnchor="middle" fontSize="18" fill="#a3e635" fontFamily="sans-serif" fontWeight="700">EV</text>
        <circle cx="24" cy="70" r="10" fill="#a3e635" className="animate-pulse-slow" />
        <text x="24" y="75" textAnchor="middle" fontSize="12" fill="#052e27" fontFamily="sans-serif">⚡</text>
        <rect x="10" y="92" width="28" height="6" rx="3" fill="#052e27" opacity="0.5" />
        <rect x="10" y="102" width="18" height="6" rx="3" fill="#052e27" opacity="0.5" />
        {/* pulse rings at connector */}
        <circle cx="0" cy="76" r="10" fill="none" stroke="#a3e635" strokeWidth="2" className="animate-ring-pulse" style={{ transformOrigin: '0px 76px' }} />
      </g>

      {/* Charging cable, pedestal -> car */}
      <path d="M556,406 C 500,420 470,400 420,410" stroke="url(#cableGlow)" strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="420" cy="410" r="5" fill="#a3e635" className="animate-pulse-slow" />

      {/* ---------------- EV Car ---------------- */}
      <g transform="translate(240,350)">
        <ellipse cx="140" cy="128" rx="150" ry="14" fill="#0f172a" opacity="0.12" />
        {/* body */}
        <path
          d="M20,90 Q30,45 90,40 L190,40 Q235,42 260,75 L275,90 Q280,100 270,108 L20,108 Q10,100 20,90 Z"
          fill="url(#carBody)"
          className="dark:hidden"
        />
        <path
          d="M20,90 Q30,45 90,40 L190,40 Q235,42 260,75 L275,90 Q280,100 270,108 L20,108 Q10,100 20,90 Z"
          fill="url(#carBodyDark)"
          className="hidden dark:block"
        />
        {/* cabin glass */}
        <path d="M78,44 Q95,52 118,52 L188,52 Q205,54 222,72 L92,72 Z" fill="#0f766e" opacity="0.35" />
        {/* accent stripe */}
        <rect x="20" y="92" width="255" height="6" fill="#10b981" opacity="0.85" />
        {/* headlight */}
        <rect x="262" y="80" width="14" height="8" rx="3" fill="#a3e635" />
        {/* wheels */}
        <circle cx="75" cy="110" r="22" fill="#0f172a" />
        <circle cx="75" cy="110" r="10" fill="#64748b" />
        <circle cx="225" cy="110" r="22" fill="#0f172a" />
        <circle cx="225" cy="110" r="10" fill="#64748b" />
        {/* charging port glow */}
        <circle cx="278" cy="94" r="6" fill="#a3e635" className="animate-pulse-slow" />
      </g>

      {/* Floating energy particles */}
      <g className="text-brand-500 dark:text-volt-400">
        <circle cx="470" cy="300" r="3" fill="currentColor" className="animate-float" style={{ animationDuration: '5s' }} />
        <circle cx="500" cy="340" r="2.5" fill="currentColor" className="animate-float" style={{ animationDuration: '6.5s', animationDelay: '0.5s' }} />
        <circle cx="440" cy="330" r="2" fill="currentColor" className="animate-float" style={{ animationDuration: '4.5s', animationDelay: '1s' }} />
      </g>

      {/* Foreground fade to blend into page background */}
      <rect x="0" y="500" width="800" height="60" fill="url(#fadeMask)" />
      <defs>
        <linearGradient id="fadeMask" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}


