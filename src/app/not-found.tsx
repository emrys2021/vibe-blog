import Link from 'next/link';
import { Prompt } from '@/components/Prompt';
import { Container } from '@/components/Container';

export default function NotFound() {
  return (
    <Container>
      <div className="text-sm">
        <p className="text-fg-dim mb-4">
          <Prompt>cat $REQUEST_URI</Prompt>
        </p>
        <pre className="text-danger mb-4">
          cat: no such file or directory (404)
        </pre>
        <p>
          <Link
            href="/"
            className="text-accent-2 hover:text-accent underline"
          >
            ← cd ~
          </Link>
        </p>
      </div>
    </Container>
  );
}
