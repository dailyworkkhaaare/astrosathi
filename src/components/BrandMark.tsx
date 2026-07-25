import { APP_NAME } from "@/lib/brand";

export function BrandMark({
  withWordmark = true,
  className = "h-8 w-8",
}: {
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <svg
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={className}
      >
        <rect width="32" height="32" rx="8" fill="var(--color-primary)" />
        <path
          d="M10 23 L16 9 L22 23 M12.5 18 H19.5"
          stroke="var(--color-accent)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {withWordmark && (
        <span className="text-lg font-semibold tracking-tight text-foreground">{APP_NAME}</span>
      )}
    </div>
  );
}
