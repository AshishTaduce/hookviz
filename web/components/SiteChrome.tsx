import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import Logo from '@/components/Logo';

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
        <Link className="logo" href="/" aria-label="HookViz home">
          <Logo />
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
        <Logo size={20} />
        <span>Traces are recorded at build time, so every visit replays the same run.</span>
        <a href="https://github.com/AshishTaduce/hookviz/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer">
          Want to contribute? Add an example
        </a>
        <a className="r" href="https://ashishtaduce.co.in">
          Built by Ashish Taduce
        </a>
      </div>
    </footer>
  );
}
