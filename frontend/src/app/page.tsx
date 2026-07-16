import { Suspense } from 'react';
import ArchitectChat from '@/components/ArchitectChat';

export default function ChatPage() {
  return (
    <Suspense>
      <ArchitectChat />
    </Suspense>
  );
}
