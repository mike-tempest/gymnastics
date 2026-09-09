'use client';

export type PaymentMethodType = 'gocardless' | 'stripe';

interface PaymentMethodIconProps {
  method: PaymentMethodType;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export default function PaymentMethodIcon({
  method,
  showLabel = true,
  size = 'sm',
}: PaymentMethodIconProps) {
  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const containerSize = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';

  if (method === 'gocardless') {
    return (
      <span className="inline-flex items-center gap-2">
        <span
          className={`${containerSize} bg-brand/10 rounded-lg flex items-center justify-center flex-shrink-0`}
        >
          {/* Bank icon for GoCardless bank debit */}
          <svg
            className={`${iconSize} text-brand`}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
          </svg>
        </span>
        {showLabel && <span className="text-brand text-xs font-medium">GoCardless</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`${containerSize} bg-dark-primary/10 rounded-lg flex items-center justify-center flex-shrink-0`}
      >
        {/* Card icon for Stripe */}
        <svg
          className={`${iconSize} text-brand`}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      </span>
      {showLabel && <span className="text-brand text-xs font-medium">Stripe Card</span>}
    </span>
  );
}
