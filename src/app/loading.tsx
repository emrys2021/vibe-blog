import { Prompt } from '@/components/Prompt';
import { Container } from '@/components/Container';

export default function Loading() {
  return (
    <Container>
      <div className="text-sm text-fg-dim">
        <Prompt cursor>loading...</Prompt>
      </div>
    </Container>
  );
}
