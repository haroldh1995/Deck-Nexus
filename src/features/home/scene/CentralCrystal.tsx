export function CentralCrystalAssembly({
  active,
}: {
  active: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`central-crystal${active ? " central-crystal--active" : ""}`}
    >
      <span className="central-crystal__glow" aria-hidden="true" />
      <svg className="central-crystal__body" viewBox="0 0 120 168">
        <defs>
          <linearGradient id="crystalFaceA" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#effcff" stopOpacity="0.95" />
            <stop offset="42%" stopColor="#54ecff" stopOpacity="0.78" />
            <stop offset="100%" stopColor="#6a4dff" stopOpacity="0.36" />
          </linearGradient>
          <linearGradient id="crystalFaceB" x1="100%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#b7fbff" stopOpacity="0.72" />
            <stop offset="52%" stopColor="#1dc7ff" stopOpacity="0.44" />
            <stop offset="100%" stopColor="#190f6e" stopOpacity="0.18" />
          </linearGradient>
        </defs>
        <path className="central-crystal__facet" d="M60 4 L108 58 L60 164 L12 58 Z" />
        <path className="central-crystal__facet central-crystal__facet--left" d="M60 4 L60 164 L12 58 Z" />
        <path className="central-crystal__facet central-crystal__facet--right" d="M60 4 L108 58 L60 164 Z" />
        <path className="central-crystal__facet central-crystal__facet--core" d="M60 24 L82 62 L60 136 L38 62 Z" />
        <path className="central-crystal__edge" d="M60 4 L108 58 L60 164 L12 58 Z" />
        <path className="central-crystal__edge" d="M12 58 L60 58 L108 58" />
        <path className="central-crystal__edge" d="M60 4 L60 164" />
      </svg>
      <span className="central-crystal__refraction" aria-hidden="true" />
    </div>
  );
}
