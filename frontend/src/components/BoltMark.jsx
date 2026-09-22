
export default function BoltMark({ className = 'w-8 h-8', animated = false }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="9" className="fill-brand-600" />
      <path
        d="M17.5 6L9 18h6l-1 8L23 14h-6l0.5-8z"
        className={`fill-volt-400 ${animated ? 'animate-pulse-slow' : ''}`}
      />
    </svg>
  );
}


