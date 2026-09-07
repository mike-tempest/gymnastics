import { BRAND } from '@/lib/brand';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-canvas flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        {children}
        <p className="mt-6 text-center text-xs text-grey-500">
          We use cookies to keep you signed in and to understand how {BRAND.name} is used. No personal member or parent details ever leave the app.
        </p>
      </div>
    </div>
  );
}
