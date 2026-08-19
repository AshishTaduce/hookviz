import { redirect } from 'next/navigation';
import { DEFAULT_TRACE_ID } from '@/lib/catalog';

// Root page: redirect to the default trace
export default function RootPage() {
  redirect(`/${DEFAULT_TRACE_ID}`);
}
