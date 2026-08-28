import { useLocale } from "../i18n/LocaleContext";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className={`inline-flex rounded-lg border border-border bg-subtle p-0.5 text-xs font-semibold ${className}`}
      role="group"
      aria-label={t("language")}
      dir="ltr"
    >
      {(["en", "fa"] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLocale(item)}
          aria-pressed={locale === item}
          className={`rounded-md px-2.5 py-1.5 uppercase transition-colors ${
            locale === item ? "bg-surface text-primary shadow-sm" : "text-inkDim hover:text-ink"
          }`}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
