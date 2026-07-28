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
      <img
        src="/pwa-512x512.png"
        alt=""
        aria-hidden="true"
        className={`shrink-0 rounded-lg object-contain ${className}`}
      />
      {withWordmark && (
        <span className="text-lg font-semibold tracking-tight text-foreground">{APP_NAME}</span>
      )}
    </div>
  );
}
