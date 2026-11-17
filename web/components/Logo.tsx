// HookViz mark: a fishing hook (the "hook") drawn as a recording. Its length is
// split into the four phases a trace passes through, in order: render (shaft),
// commit, event, passive effect (the barb). The eyelet on top is the playhead.
const HOOK = 'M10 7 V19 a7 7 0 0 0 14 0 V14';

export function LogoMark({ size = 28 }: { size?: number }) {
  const seg = (stroke: string, len: number, from: number) => (
    <path
      d={HOOK}
      pathLength={100}
      stroke={stroke}
      strokeDasharray={`${len} 100`}
      strokeDashoffset={-from}
    />
  );
  return (
    <svg
      className="logo-mark"
      width={size}
      height={(size * 32) / 28}
      viewBox="0 0 28 32"
      fill="none"
      strokeWidth="3.2"
      aria-hidden="true"
    >
      <g className="logo-hook">
        {seg('var(--phase-render)', 30, 0)}
        {seg('var(--phase-commit)', 28, 30)}
        {seg('var(--phase-event)', 24, 58)}
        {seg('var(--phase-passive-effect)', 18, 82)}
        <path d="M19.8 17.6 24 13 28.2 17.6" stroke="var(--phase-passive-effect)" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="10" cy="3.6" r="2.4" stroke="var(--text-primary)" strokeWidth="2" />
      </g>
    </svg>
  );
}

export default function Logo({ size = 44 }: { size?: number }) {
  return (
    <span className="logo-lockup">
      <LogoMark size={size} />
      <span className="logo-word">
        Hook<b>Viz</b>
      </span>
    </span>
  );
}
