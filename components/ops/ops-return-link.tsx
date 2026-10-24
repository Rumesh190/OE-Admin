"use client";
import Link from './ops-record-link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OpsFeedback } from './ops-feedback';
import { useUrlState } from '@/lib/navigation/use-url-state';
import { validateReturnTo, withActionReturn } from '@/lib/navigation/return-to';
export function ActionLink({ href, ...props }: Omit<React.ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const { path } = useUrlState();
  const id = href.match(/^\/actions\/([^/?#]+)$/)?.[1];
  return <Link {...props} href={id ? withActionReturn(decodeURIComponent(id), path) : href} />;
}
export function BackLink({ href, label = 'Back to Source' }: { href: string; label?: string }) {
  const safe = validateReturnTo(href);
  return safe ? <Button nativeButton={false} render={<Link href={safe} />} variant="outline"><ArrowLeft className="size-4" />{label}</Button> : null;
}
export function ReturnBanner({ message, href, label }: { message: string; href?: string; label?: string }) {
  return <section className="grid gap-2 sm:flex sm:items-center sm:justify-between"><OpsFeedback tone="success" message={message} className="flex-1" />{href && <BackLink href={href} label={label} />}</section>;
}
