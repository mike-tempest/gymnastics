import { Check, type LucideIcon } from 'lucide-react';
import Link from 'next/link';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string | null;
  actionHref?: string;
  actionOnClick?: () => void;
  hint?: string;
  /** Optional list of features to display as a mini feature preview */
  features?: string[];
}

export default function EmptyState({ icon: Icon, title, description, actionLabel, actionHref, actionOnClick, hint, features }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center mb-6">
        <Icon className="w-8 h-8 text-brand" />
      </div>
      <h3 className="font-serif text-2xl sm:text-3xl text-white mb-3">{title}</h3>
      <p className="text-text-secondary text-base mb-2 max-w-md">{description}</p>
      {hint && (
        <p className="text-text-tertiary text-sm mb-4 max-w-sm">{hint}</p>
      )}
      {features && features.length > 0 && (
        <ul className="mt-4 mb-6 space-y-2 text-left max-w-sm">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3 text-text-secondary text-sm">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand/20 flex items-center justify-center mt-0.5">
                <Check className="w-3 h-3 text-brand" />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      )}
      {!hint && !features && <div className="mb-6" />}
      {(hint || features) && !actionLabel && <div className="mb-2" />}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="px-8 py-4 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm text-lg"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && actionOnClick && !actionHref && (
        <button
          onClick={actionOnClick}
          className="px-8 py-4 min-h-[44px] bg-brand text-dark-primary rounded-button font-bold hover:bg-brand-light transition-all shadow-sm text-lg"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
