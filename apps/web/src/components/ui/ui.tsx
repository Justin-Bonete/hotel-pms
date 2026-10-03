import { AlertCircle, CheckCircle2, Info, Loader2, TriangleAlert } from 'lucide-react';
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------- Button
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:outline-indigo-600',
  secondary: 'bg-white text-slate-800 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400',
  ghost: 'text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading, disabled, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

// ---------------------------------------------------------------- Field / Input
interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, error, id, className, ...rest }, ref) {
  const inputId = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={cn(
          'block w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset placeholder:text-slate-400',
          'focus:ring-2 focus:ring-inset focus:ring-indigo-600',
          error ? 'ring-red-400' : 'ring-slate-300',
          className,
        )}
        {...rest}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
});

// ---------------------------------------------------------------- Card / Badge
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200', className)}>{children}</div>;
}

type BadgeTone = 'neutral' | 'success' | 'warning' | 'info';
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-800',
  info: 'bg-indigo-50 text-indigo-700',
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', TONES[tone])}>{children}</span>;
}

// ---------------------------------------------------------------- Alert
type AlertTone = 'error' | 'success' | 'info' | 'warning';
const ALERTS: Record<AlertTone, { box: string; Icon: typeof Info }> = {
  error: { box: 'bg-red-50 text-red-800 ring-red-200', Icon: AlertCircle },
  success: { box: 'bg-emerald-50 text-emerald-800 ring-emerald-200', Icon: CheckCircle2 },
  info: { box: 'bg-indigo-50 text-indigo-800 ring-indigo-200', Icon: Info },
  warning: { box: 'bg-amber-50 text-amber-900 ring-amber-200', Icon: TriangleAlert },
};

export function Alert({ tone = 'info', children, action }: { tone?: AlertTone; children: ReactNode; action?: ReactNode }) {
  const { box, Icon } = ALERTS[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-lg p-3 text-sm ring-1 ring-inset', box)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------- Spinner / EmptyState
export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-500" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}…
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------- Select / Textarea

const controlClass = (error?: string) =>
  cn(
    'block w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-inset placeholder:text-slate-400',
    'focus:ring-2 focus:ring-inset focus:ring-indigo-600',
    error ? 'ring-red-400' : 'ring-slate-300',
  );

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField({ label, error, id, children, ...rest }, ref) {
  const selectId = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={selectId} className="block text-sm font-medium text-slate-700">{label}</label>
      <select ref={ref} id={selectId} aria-invalid={error ? true : undefined} className={controlClass(error)} {...rest}>
        {children}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
});

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(function TextareaField({ label, error, id, ...rest }, ref) {
  const areaId = id ?? rest.name;
  return (
    <div className="space-y-1.5">
      <label htmlFor={areaId} className="block text-sm font-medium text-slate-700">{label}</label>
      <textarea ref={ref} id={areaId} rows={3} aria-invalid={error ? true : undefined} className={controlClass(error)} {...rest} />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
});
