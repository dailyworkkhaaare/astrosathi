import { astroArtSrc, type GrahaArt, type SignArt } from "@/lib/astro-art";
import { cn } from "@/lib/utils";

type AstroArtProps = {
  /** Rendered size in CSS px; picks the 256 or 512 source for sharp 2x/3x output. */
  size: number;
  className?: string;
  /** Empty (default) keeps the art decorative and out of the accessibility tree. */
  alt?: string;
  /** Above-the-fold heroes load eagerly; everything else stays lazy. */
  priority?: boolean;
} & ({ kind: "sign"; name: SignArt } | { kind: "graha"; name: GrahaArt });

export function AstroArt({
  kind,
  name,
  size,
  className,
  alt = "",
  priority = false,
}: AstroArtProps) {
  return (
    <img
      src={astroArtSrc(kind, name, 512)}
      srcSet={`${astroArtSrc(kind, name, 256)} 256w, ${astroArtSrc(kind, name, 512)} 512w`}
      sizes={`${size}px`}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      className={cn("pointer-events-none shrink-0 select-none object-contain", className)}
      style={{ width: size, height: size }}
    />
  );
}
