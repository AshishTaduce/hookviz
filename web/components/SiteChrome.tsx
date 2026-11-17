import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export function Stripe() {
  return (
    <div className="stripe" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

export function SiteNav() {
  return (
    <header className="site-nav">
      <Stripe />
      <div className="wrap">
        <Link className="logo" href="/">
          HookViz
        </Link>
        <Link className="link" href="/#examples">
          Examples
        </Link>
        <Link className="link" href="/guide">
          Guide
        </Link>
        <ThemeToggle />
        <Link className="btn btn-primary" href="/usestate-batching">
          Open the player
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <span>HookViz</span>
        <span>Traces are recorded at build time, so every visit replays the same run.</span>
        <a className="r" href="https://ashishtaduce.co.in">
          Built by Ashish Taduce
        </a>
      </div>
    </footer>
  );
}
