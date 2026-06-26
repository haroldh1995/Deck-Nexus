function RuneTicks({ count, radius }: { count: number; radius: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * 360;
        const length = index % 4 === 0 ? 18 : 9;
        return (
          <line
            key={`${radius}-${index}`}
            x1="200"
            x2="200"
            y1={200 - radius}
            y2={200 - radius + length}
            transform={`rotate(${angle} 200 200)`}
          />
        );
      })}
    </>
  );
}

function RuneMarks({ count, radius }: { count: number; radius: number }) {
  const marks = ["I", "V", "X", "A", "O", "N", "K", "S"];
  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const angle = (index / count) * 360;
        const radians = (angle * Math.PI) / 180;
        const x = 200 + Math.sin(radians) * radius;
        const y = 200 - Math.cos(radians) * radius;
        return (
          <text
            dominantBaseline="middle"
            key={`${radius}-mark-${index}`}
            textAnchor="middle"
            transform={`rotate(${angle} ${x} ${y})`}
            x={x}
            y={y}
          >
            {marks[index % marks.length]}
          </text>
        );
      })}
    </>
  );
}

export function UpperProjectionAssembly() {
  return (
    <div className="upper-projection" aria-hidden="true">
      <svg className="upper-ring upper-ring--outer" viewBox="0 0 400 400">
        <circle cx="200" cy="200" r="178" />
        <circle cx="200" cy="200" r="150" />
        <path d="M200 18 L212 58 L200 84 L188 58 Z" />
        <path d="M200 382 L212 342 L200 316 L188 342 Z" />
      </svg>
      <svg className="upper-ring upper-ring--runes" viewBox="0 0 400 400">
        <circle cx="200" cy="200" r="132" />
        <circle cx="200" cy="200" r="114" />
        <RuneMarks count={32} radius={123} />
      </svg>
      <svg className="upper-ring upper-ring--geometry" viewBox="0 0 400 400">
        <circle cx="200" cy="200" r="92" />
        <circle cx="200" cy="200" r="54" />
        <RuneTicks count={64} radius={170} />
        <RuneTicks count={24} radius={94} />
        <path d="M200 110 L278 245 L122 245 Z" />
        <path d="M110 200 L200 110 L290 200 L200 290 Z" />
      </svg>
      <div className="upper-axis upper-axis--top" />
      <div className="upper-axis upper-axis--bottom" />
      <div className="hanging-energy hanging-energy--one" />
      <div className="hanging-energy hanging-energy--two" />
      <div className="hanging-energy hanging-energy--three" />
      <div className="hanging-energy hanging-energy--four" />
    </div>
  );
}

export function LowerProjectionAssembly() {
  return (
    <div className="lower-projection" aria-hidden="true">
      <svg className="floor-ring floor-ring--outer" viewBox="0 0 420 420">
        <circle cx="210" cy="210" r="186" />
        <circle cx="210" cy="210" r="160" />
        <path d="M210 12 L226 70 L210 104 L194 70 Z" />
        <path d="M210 408 L226 350 L210 316 L194 350 Z" />
        <path d="M12 210 L70 194 L104 210 L70 226 Z" />
        <path d="M408 210 L350 194 L316 210 L350 226 Z" />
      </svg>
      <svg className="floor-ring floor-ring--runes" viewBox="0 0 420 420">
        <circle cx="210" cy="210" r="128" />
        <circle cx="210" cy="210" r="92" />
        <g transform="translate(10 10)">
          <RuneMarks count={36} radius={118} />
          <RuneTicks count={72} radius={152} />
        </g>
      </svg>
      <svg className="floor-ring floor-ring--geometry" viewBox="0 0 420 420">
        <circle cx="210" cy="210" r="54" />
        <circle cx="210" cy="210" r="22" />
        <path d="M210 78 L324 210 L210 342 L96 210 Z" />
        <path d="M210 106 L294 294 L126 294 Z" />
      </svg>
      <div className="floor-impact" />
      <div className="floor-uplight" />
    </div>
  );
}
