import type { Metadata } from 'next';
import catalog from '@/lib/catalog';
import type { Trace } from '@/types/trace';
import PlayerShell from '@/components/PlayerShell';

interface Props {
  params: Promise<{ traceId: string }>;
}

// generateStaticParams: enumerate every trace id so next export produces one
// HTML per trace.
export async function generateStaticParams() {
  return catalog.map((entry) => ({ traceId: entry.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { traceId } = await params;
  const entry = catalog.find((e) => e.id === traceId);
  return {
    title: entry ? `${entry.title} — HookViz` : 'HookViz',
  };
}

export default async function TracePage({ params }: Props) {
  const { traceId } = await params;

  // Static import at build time per doc 01 — no fetch, no loading state.
  // Next.js code-splits per route so only this trace's JSON ships with this page.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await import(`@/../recorder/out/${traceId}.trace.json`) as any;
  const trace: Trace = mod.default;

  return <PlayerShell trace={trace} />;
}
