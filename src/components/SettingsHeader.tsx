export function SettingsHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="bg-beige px-6 py-8 sm:px-10">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-beige-2 text-[#8a6a52]">{icon}</span>
      <h1 className="mt-4 font-display text-[19px] font-semibold text-ink">{title}</h1>
      <p className="text-[15px] text-ink-2">{subtitle}</p>
    </div>
  );
}
