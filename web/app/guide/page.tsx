import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav, SiteFooter } from '@/components/SiteChrome';
import '../landing.css';

export const metadata: Metadata = {
  title: 'Guide',
  description: 'How to read the HookViz player: panels, phases, controls and keyboard shortcuts.',
};

export default function Guide() {
  return (
    <div className="site">
      <SiteNav />
      <main className="wrap guide">
        <h1>How to read the player</h1>
        <p>
          A trace is one recorded run of a React component. The player does not run your code live.
          It replays what happened, so you can stop on any statement and look around.
        </p>

        <h2>Your first trace</h2>
        <ol>
          <li>
            Open <Link href="/usestate-batching">why two setCount calls only increment once</Link>.
          </li>
          <li>
            Press play, or step with the arrow keys, until the source panel reaches the second{' '}
            <strong>setCount(count + 1)</strong>.
          </li>
          <li>
            In the <strong>Hooks</strong> panel the stored value is still 0 while the queue holds 1.
            Both calls read the same snapshot of <strong>count</strong>.
          </li>
          <li>Keep stepping to the commit. The rendered output changes once, to 1, not 2.</li>
        </ol>

        <h2>Panels</h2>
        <p>
          <strong>Source</strong> shows the component and the current statement.{' '}
          <strong>Rendered output</strong> shows the DOM after each commit.{' '}
          <strong>Hooks</strong> lists each hook with its stored value and queued updates.{' '}
          <strong>Effects queue</strong> tracks every effect from scheduled to cleaned up.{' '}
          <strong>Variables</strong> shows local values at the current line. Rows that just changed
          flash briefly.
        </p>

        <h2>Phases</h2>
        <p>
          The bar at the bottom is the whole recording, split by phase: <strong>render</strong>,{' '}
          <strong>commit</strong>, <strong>passive-effect</strong> and <strong>event</strong>. Click
          it to jump to any step.
        </p>

        <h2>Guided and Expert</h2>
        <p>
          Guided shows a short note for each interesting step and marks closures and side effects in
          the gutter. Expert hides them. Your choice is remembered in this browser.
        </p>

        <h2>Controls</h2>
        <div className="keys">
          <span>
            <span className="keycap">←</span> <span className="keycap">→</span>
          </span>
          <span>Previous and next step</span>
          <span>
            <span className="keycap">Space</span>
          </span>
          <span>Play or pause</span>
          <span>
            <span className="keycap">0.5×</span> – <span className="keycap">4×</span>
          </span>
          <span>Playback speed</span>
          <span>
            <span className="keycap">+</span> <span className="keycap">−</span>
          </span>
          <span>Text size in the panels</span>
        </div>

        <h2>Where the traces come from</h2>
        <p>
          Each example is a real React component, executed once at build time under the V8 debugger
          with React’s own renderer. HookViz stores one snapshot per statement. Nothing on this page
          simulates React.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
