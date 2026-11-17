// Small line-icon set (16px, 1.5 stroke) so the player has no glyph characters.
const PATHS: Record<string, React.ReactNode> = {
  prev: <path d="M10.5 3.5 5.5 8l5 4.5M4 3.5v9" />,
  next: <path d="M5.5 3.5 10.5 8l-5 4.5M12 3.5v9" />,
  play: <path d="M5 3.5v9l7.5-4.5z" />,
  pause: <path d="M5.5 3.5v9M10.5 3.5v9" />,
  info: (
    <>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 7.25V11M8 5.25v.01" />
    </>
  ),
  guided: (
    <>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M8 2.25a5.75 5.75 0 0 1 0 11.5z" fill="currentColor" />
    </>
  ),
  expert: <circle cx="8" cy="8" r="5.75" />,
  sun: (
    <>
      <circle cx="8" cy="8" r="2.75" />
      <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.05 1.05M11.55 11.55l1.05 1.05M3.4 12.6l1.05-1.05M11.55 4.45l1.05-1.05" />
    </>
  ),
  moon: <path d="M13.25 9.4A5.5 5.5 0 0 1 6.6 2.75a5.5 5.5 0 1 0 6.65 6.65z" />,
  arrow: <path d="M3.5 8h9M9 4.5 12.5 8 9 11.5" />,
  github: (
    <path d="M6.5 13c-3 .9-3-1.5-4-1.8m8 2.8v-2.1c0-.6 0-1 .3-1.4 2-.2 4-1 4-4.4 0-.9-.3-1.7-.9-2.4.2-.7.2-1.600-.1-2.3 0 0-.7-.2-2.300.9a8 8 0 0 0-4 0C5.900 1.200 5.200 1.400 5.200 1.400c-.3.700-.3 1.600-.1 2.300A3.600 3.600 0 0 0 4.200 6c0 3.400 2 4.200 4 4.400-.3.300-.3.700-.3 1.100V14" />
  ),
};

export default function Icon({ name, size = 16 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {PATHS[name]}
    </svg>
  );
}
