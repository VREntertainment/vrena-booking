type BrandLoaderProps = {
  label?: string
  compact?: boolean
}

export default function BrandLoader({ label = 'Loading VRena', compact = false }: BrandLoaderProps) {
  return (
    <div className={compact ? 'brand-loader brand-loader-compact' : 'brand-loader'} aria-busy="true" aria-live="polite">
      <video
        className="brand-loader-video"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
      >
        <source src="/vrena-loader-bottom-fill-transparent.webm" type="video/webm" />
      </video>
      <picture className="brand-loader-still" aria-hidden="true">
        <source media="(prefers-color-scheme: dark)" srcSet="/brand/vrena-mark-dark.svg" />
        <img src="/brand/vrena-mark-light.svg" alt="" />
      </picture>
      <span>{label}</span>
    </div>
  )
}
