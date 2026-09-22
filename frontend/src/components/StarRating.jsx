
export default function StarRating({ value = 0, onChange, readOnly = false, size = 24 }) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="inline-flex items-center gap-1">
      {stars.map((n) => {
        const filled = n <= Math.round(value);
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => onChange && onChange(n)}
            className={`transition-transform ${readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#facc15' : 'none'} stroke={filled ? '#facc15' : '#94a3b8'} strokeWidth="1.5">
              <path
                d="M12 2.5l2.9 6.06 6.6.87-4.86 4.6 1.27 6.6L12 17.5l-5.91 3.13 1.27-6.6-4.86-4.6 6.6-.87L12 2.5z"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}


