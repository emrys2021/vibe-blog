import type { Metadata } from 'next';
import { Prompt } from '@/components/Prompt';
import { Container } from '@/components/Container';
import { siteConfig } from '../../../blog.config';

export const metadata: Metadata = {
  title: 'about',
};

export default function AboutPage() {
  const { author, social } = siteConfig;

  return (
    <Container>
      <h1 className="text-sm text-fg-dim mb-6">
        <Prompt>cat /etc/passwd | grep {author.handle.replace('@', '')}</Prompt>
      </h1>

      <div className="border border-rule rounded p-5 bg-bg-elev text-sm font-mono">
        <Field label="name" value={author.name} accent />
        <Field label="handle" value={author.handle} />
        <Field label="email" value={author.email} />
        <Field label="bio" value={author.bio} />
        <Field
          label="links"
          value={
            <span className="flex flex-wrap gap-3">
              {social.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target={s.href.startsWith('http') ? '_blank' : undefined}
                  rel="noreferrer"
                  className="text-accent-2 hover:text-accent underline underline-offset-2"
                >
                  {s.label}
                </a>
              ))}
            </span>
          }
        />
      </div>

      <section className="mt-8 text-sm text-fg-dim leading-relaxed">
        <p>
          edit <code>blog.config.ts</code> at the repo root to update this page.
        </p>
      </section>
    </Container>
  );
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-3 py-1">
      <span className="text-fg-dim">{label}</span>
      <span className={accent ? 'text-accent' : 'text-fg'}>
        {value}
      </span>
    </div>
  );
}
