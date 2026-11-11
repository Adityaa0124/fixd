import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  kbd,
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; kbd?: string; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      className={clsx(
        'inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-150 ease-fx disabled:cursor-not-allowed disabled:opacity-45',
        variant === 'primary' && 'bg-pine-600 text-on-pine shadow-ink hover:bg-pine-700',
        variant === 'secondary' && 'border border-line-strong bg-surface text-tx hover:bg-sunken',
        variant === 'ghost' && 'text-tx-2 hover:bg-sunken hover:text-tx',
        variant === 'danger' && 'border border-bad-600/30 bg-bad-50 text-bad-600 hover:bg-bad-100',
        className
      )}
    >
      {icon}
      {children}
      {kbd && (
        <kbd
          className={clsx(
            'ml-0.5 rounded px-1.5 font-sans text-2xs',
            variant === 'primary' ? 'bg-on-pine/20 text-on-pine' : 'bg-sunken text-tx-3'
          )}
        >
          {kbd}
        </kbd>
      )}
    </button>
  );
}
