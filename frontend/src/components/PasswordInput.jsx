import { useState } from 'react';

export default function PasswordInput({ value, onChange, placeholder, required = false, name }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        required={required}
        value={value}
        onChange={onChange}
        className="input-field pr-11"
        placeholder={placeholder}
        name={name}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg text-slate-500 hover:text-brand-600 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors"
      >
        {visible ? '🙈' : '👁️'}
      </button>
    </div>
  );
}
