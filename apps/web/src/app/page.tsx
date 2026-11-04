import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { AppPreview } from '@/components/marketing/app-preview';
import { FeatureGrid } from '@/components/marketing/feature-grid';
import { SecuritySection } from '@/components/marketing/security-section';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { StackStrip } from '@/components/marketing/stack-strip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const proofPoints = [
  { label: 'Transport', value: 'WebSocket + REST' },
  { label: 'Source of truth', value: 'PostgreSQL' },
  { label: 'Designed for', value: 'Desktop & mobile' },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <SiteHeader />

      <main id="main" className="flex-1">
        <section className="relative overflow-hidden">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
            <div className="hero-grid absolute inset-0 opacity-80" />
            <div className="absolute left-1/2 top-[-16rem] h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute right-[-12rem] top-32 h-[28rem] w-[28rem] rounded-full bg-accent/40 blur-3xl" />
          </div>

          <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.03fr_0.97fr] lg:gap-10 lg:pb-28">
            <div>
              <Badge
                variant="outline"
                className="h-7 gap-2 rounded-full border-primary/20 bg-primary/5 px-3 text-[0.7rem] text-foreground"
              >
                <span className="size-1.5 rounded-full bg-presence-online" aria-hidden="true" />
                Real-time messaging, considered
              </Badge>

              <h1 className="mt-6 font-display text-[3.4rem] leading-[0.94] tracking-[-0.03em] text-balance sm:text-7xl lg:text-[4.8rem]">
                Every conversation
                <span className="block text-primary">has a place.</span>
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                ChatSphere brings direct messages, focused groups, and the quiet signals that make
                conversation feel human — presence, typing, receipts — into one considered
                workspace.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild className="h-11 rounded-full px-5">
                  <Link href="/register">
                    Create your account
                    <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-11 rounded-full border-border/90 px-5"
                >
                  <a href="#features">See what&apos;s inside</a>
                </Button>
              </div>

              <p className="mt-5 text-xs text-muted-foreground">
                A 2027 SDE portfolio project · Next.js, Express, PostgreSQL, Socket.IO
              </p>

              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-border/80 pt-6">
                {proofPoints.map((point) => (
                  <div key={point.label}>
                    <dt className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      {point.label}
                    </dt>
                    <dd className="mt-1.5 text-xs font-semibold sm:text-sm">{point.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <AppPreview />
          </div>
        </section>

        <FeatureGrid />
        <SecuritySection />
        <StackStrip />

        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0e14] px-6 py-14 text-white sm:px-12">
            <div
              aria-hidden="true"
              className="absolute -right-24 -top-24 size-80 rounded-full bg-primary/40 blur-3xl"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-32 left-1/3 size-72 rounded-full bg-accent/20 blur-3xl"
            />
            <div className="relative max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/65">
                Built for the conversations that matter
              </p>
              <h2 className="mt-3 font-display text-4xl tracking-[-0.02em] text-balance sm:text-5xl">
                Less noise. More signal.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/65">
                Create an account, verify your email, and your workspace is ready. The conversation
                layer is the next milestone.
              </p>
              <Link
                href="/register"
                className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Create your account
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
