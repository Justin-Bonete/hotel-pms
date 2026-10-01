import { notFound } from 'next/navigation';
import { ComingSoon } from '@/components/coming-soon';
import { NAV_ITEMS } from '@/components/layout/nav-items';

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: slug } = await params;
  const item = NAV_ITEMS.find((i) => i.href === `/${slug}` && !i.ready);
  if (!item) notFound();
  return <ComingSoon title={item.label} phase={item.phase} />;
}
