import Link from 'next/link';
import catalog from '@/lib/catalog';
import type { Trace } from '@/types/trace';
import { getPhaseSegments, PHASE_COLORS } from '@/lib/phase-segments';
import { SiteNav, SiteFooter } from '@/components/SiteChrome';
import Icon from '@/components/Icon';
import Reveal from '@/components/Reveal';
import './landing.css';
import batching from '@/../recorder/out/usestate-batching.trace.json';

const HERO_ID = 'usestate-batching';
const HERO_STEP = 11; // second setCount call: reads 0, queues 1

const PHASES = [
  { key: 'render', label: 'render', text: 'React calls your component. Hooks read their stored state and return it.' },
  { key: 'commit', label: 'commit', text: 'React applies the result to the DOM. The rendered output changes here.' },
  { key: 'passive-effect', label: 'passive-effect', text: 'useEffect callbacks and cleanups run after the browser has painted.' },
  { key: 'event', label: 'event', text: 'A click or timer fires your handler. State updates are queued, not applied.' },
] as const;

const PANELS = [
  ['Source', 'The component code. The current statement is highlighted, and the gutter marks closures and side effects.'],
  ['Rendered output', 'The DOM as React committed it, one snapshot per commit. Changed output flashes once.'],
  ['Hooks', 'React’s hook list for this component: type, index, stored value, and any updates waiting in the queue.'],
  ['Effects queue', 'Each effect moves from scheduled to fired, then cleanup pending and cleaned up.'],
  ['Variables', 'Local values at the current statement. Anything that just changed is marked.'],
  ['Timeline', 'Every recorded step, coloured by phase. Click anywhere to jump there.'],
];

export default function Landing() {
  const trace = batching as unknown as Trace;
  const step = trace.steps[HERO_STEP];
  const segments = getPhaseSegments(trace);
  const total = trace.steps.length;
  const lines = trace.meta.source.split('\n');
  // Excerpt: component head and the handler, skipping recorder directive comments
  const pick = [6, 7, 0, 13, 14, 15, 16];
  const shown = pick.map((n) => ({ n, text: n === 0 ? '' : lines[n - 1] }));
  const vars = step.variables.filter((v) => v.kind !== 'function');
  const hook = step.hooks[0];

  const byHook = new Map<string, typeof catalog>();
  for (const e of catalog) byHook.set(e.hook, [...(byHook.get(e.hook) ?? []), e]);

  return (
    <div className="site">
      <SiteNav />

      <main>
        <section className="hero wrap">
          <h1 className="rise" style={{ ['--i' as string]: 0 }}>
            Watch React hooks run, <em>
              one line at a time
              <svg className="scribble" viewBox="0 0 300 26" aria-hidden="true">
                <defs>
                  <filter id="rough" x="-5%" y="-40%" width="110%" height="180%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="7" result="n" />
                    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" />
                  </filter>
                </defs>
                <g filter="url(#rough)">
                  <path className="marker" pathLength="1" d="M5 15 C 42 8, 78 19, 128 12 S 214 9, 262 14 S 288 13, 295 11" />
                  <path className="pen" pathLength="1" d="M9 19 C 58 11, 104 23, 160 16 S 244 12, 289 18" />
                  <path className="flick" pathLength="1" d="M276 8 L 297 15 L 281 22" />
                </g>
              </svg>
            </em>
          </h1>
          <p className="sub rise" style={{ ['--i' as string]: 1 }}>
            HookViz replays real React executions statement by statement. See the source line, the
            hook list, the effects queue and the DOM change together, so a stale closure or a
            missing dependency shows up as a step you can point at.
          </p>
          <div className="actions rise" style={{ ['--i' as string]: 2 }}>
            <Link className="btn btn-primary btn-lg" href={`/${HERO_ID}`}>
              Open the player <Icon name="arrow" />
            </Link>
            <Link className="btn btn-lg" href="/guide">
              Read the guide
            </Link>
          </div>
          <p className="meta rise" style={{ ['--i' as string]: 3 }}>
            {catalog.length} examples · React {trace.meta.reactVersion} · recorded, not simulated
          </p>

          <div className="view rise" style={{ ['--i' as string]: 4 }} aria-label="Preview of the player at one step of a recorded trace">
            <div className="view-bar">
              <span>{trace.meta.title.replace(/^[^—]+—\s*/, '')}</span>
              <span className="step">
                step {HERO_STEP + 1} / {total}
              </span>
            </div>
            <div className="view-grid">
              <div className="code" aria-hidden="true">
                {shown.map((l) => (
                  <div key={l.n} className={`ln${l.n === step.line ? ' on' : ''}`}>
                    <span>{l.n === 0 ? '⋯' : l.n}</span>
                    <span>{l.text}</span>
                  </div>
                ))}
              </div>
              <div className="inspect">
                <div>
                  <h3>Variables</h3>
                  {vars.map((v) => (
                    <div className="row" key={v.name}>
                      <span>{v.name}</span>
                      <b>{v.value}</b>
                    </div>
                  ))}
                </div>
                <div>
                  <h3>Hooks</h3>
                  <div className="row">
                    <span>
                      {hook.index} {hook.type}
                    </span>
                    <b>
                      {hook.memoized}
                      {hook.queue.length ? ` → queued ${hook.queue.join(', ')}` : ''}
                    </b>
                  </div>
                </div>
                <p className="note">
                  Both calls read <code>count</code> as 0 from this render’s closure, so the queue
                  holds 1, not 2.
                </p>
              </div>
            </div>
            <div className="timeline">
              <div className="bar">
                {segments.map((seg, i) => (
                  <i
                    key={i}
                    style={{
                      ['--k' as string]: i,
                      flexGrow: seg.end - seg.start + 1,
                      background: PHASE_COLORS[seg.phase],
                    }}
                  />
                ))}
              </div>
              <div className="cursor" style={{ ['--at' as string]: `${(HERO_STEP / (total - 1)) * 100}%` }} />
              <div className="legend">
                {PHASES.filter((p) => segments.some((s) => s.phase === p.key)).map((p) => (
                  <span key={p.key}>
                    <i style={{ background: PHASE_COLORS[p.key] }} />
                    {p.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section wrap reveal" id="panels">
          <h2>Six views of the same step</h2>
          <p className="lead">
            Every panel shows the same moment in the recording. Move the timeline and they all move
            together.
          </p>
          <dl className="panels">
            {PANELS.map(([name, text]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="section wrap reveal">
          <h2>Four phases, four colours</h2>
          <p className="lead">
            Colour appears in HookViz only where it names a phase. If you can tell the phase, you
            can tell why the step ran.
          </p>
          <div className="phases">
            {PHASES.map((p) => (
              <div className="phase" key={p.key} style={{ ['--c' as string]: PHASE_COLORS[p.key] }}>
                <span className="tag">
                  <i style={{ background: PHASE_COLORS[p.key] }} />
                  {p.label}
                </span>
                <p>{p.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section wrap reveal" id="examples">
          <h2>{catalog.length} examples, grouped by hook</h2>
          <p className="lead">
            Each one is a real component recorded under a debugger. Start with the gotchas: batching,
            stale closures and fetch races.
          </p>
          <div className="examples">
            {[...byHook.entries()].map(([hookName, entries]) => (
              <div key={hookName}>
                <h3>
                  {hookName} <span>{entries.length}</span>
                </h3>
                {entries.map((e) => (
                  <Link key={e.id} href={`/${e.id}`}>
                    {e.title.replace(/^[^—]+—\s*/, '')}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
      <Reveal />
    </div>
  );
}
