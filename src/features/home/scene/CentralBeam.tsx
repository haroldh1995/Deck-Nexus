export function CentralBeamAssembly() {
  return (
    <div className="central-beam" aria-hidden="true">
      <span className="central-beam__haze" />
      <span className="central-beam__glow" />
      <span className="central-beam__core" />
      <span className="central-beam__filament central-beam__filament--one" />
      <span className="central-beam__filament central-beam__filament--two" />
      <span className="central-beam__filament central-beam__filament--three" />
      <span className="central-beam__distortion" />
    </div>
  );
}
