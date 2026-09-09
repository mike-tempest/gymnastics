'use client';

interface BillingStatsCardProps {
  label: string;
  value: string;
  valueColour: string;
  iconBg: string;
  iconColour: string;
  icon: React.ReactNode;
}

export default function BillingStatsCard({
  label,
  value,
  valueColour,
  iconBg,
  iconColour,
  icon,
}: BillingStatsCardProps) {
  return (
    <div className="bg-dark-primary rounded-3xl p-4 sm:p-6 shadow-lg border border-white/10 hover:border-white/20 hover:shadow-card-hover transition-all">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <span className="text-grey-300 text-sm font-medium">{label}</span>
        <div
          className={`w-9 h-9 sm:w-10 sm:h-10 ${iconBg} rounded-lg flex items-center justify-center transition-transform group-hover:scale-110`}
        >
          <span className={iconColour}>{icon}</span>
        </div>
      </div>
      <p className={`text-2xl sm:text-3xl font-bold ${valueColour}`}>{value}</p>
    </div>
  );
}
