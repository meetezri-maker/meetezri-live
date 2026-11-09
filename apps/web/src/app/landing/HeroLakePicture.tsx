import {
  LANDING_HERO_AVIF_SRC_SET,
  LANDING_HERO_BG,
  LANDING_HERO_WEBP_SRC_SET,
} from "./landingImagery";

interface HeroLakePictureProps {
  className: string;
  highPriority?: boolean;
}

/** Responsive public hero artwork. The JPEG fallback remains the metadata-compatible source. */
export function HeroLakePicture({ className, highPriority = false }: HeroLakePictureProps) {
  return (
    <picture>
      <source type="image/avif" srcSet={LANDING_HERO_AVIF_SRC_SET} sizes="100vw" />
      <source type="image/webp" srcSet={LANDING_HERO_WEBP_SRC_SET} sizes="100vw" />
      <img
        src={LANDING_HERO_BG}
        alt=""
        className={className}
        width={1600}
        height={1067}
        loading="eager"
        fetchPriority={highPriority ? "high" : undefined}
      />
    </picture>
  );
}
