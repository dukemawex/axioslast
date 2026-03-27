export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-navy">Axios Pay</h1>
          <p className="text-text-muted text-sm mt-1">Cross-Border FX, Unlocked.</p>
          <p className="text-text-muted text-xs mt-2">
            Complaints or support: <a href="mailto:axiosbuild@gmail.com" className="text-brand-amber hover:underline">axiosbuild@gmail.com</a>
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
