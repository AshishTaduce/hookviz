import Link from 'next/link';

export function SiteNav() {
  return (
    <header className="site-nav">
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
        <Link className="btn" href="/usestate-batching">
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
