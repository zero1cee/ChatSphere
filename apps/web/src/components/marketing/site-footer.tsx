import Link from 'next/link';

import { Logo } from '@/components/brand/logo';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <Link href="/" aria-label="ChatSphere home" className="inline-flex rounded-lg">
            <Logo />
          </Link>
          <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
            A real-time messaging platform built as a 2027 SDE portfolio project. Original design,
            real infrastructure, no tutorial shortcuts.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-3 text-xs text-muted-foreground">
          <a href="#features" className="transition-colors hover:text-foreground">
            Product
          </a>
          <a href="#security" className="transition-colors hover:text-foreground">
            Security
          </a>
          <a href="#stack" className="transition-colors hover:text-foreground">
            Stack
          </a>
          <span className="text-muted-foreground/70">© 2026 ChatSphere</span>
        </div>
      </div>
    </footer>
  );
}
