'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import {
  FinalReplyInterface,
  EpicInterface,
  TicketInterface,
} from '@/types/chat';
import { getEpic, getEpicTickets } from '@/lib/api';
import PlanCard from './PlanCard';

interface FinalReplyCardProps {
  reply: FinalReplyInterface;
}

export default function FinalReplyCard({ reply }: FinalReplyCardProps) {
  const [epic, setEpic] = useState<EpicInterface | null>(null);
  const [tickets, setTickets] = useState<TicketInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [epicData, ticketsData] = await Promise.all([
          getEpic(reply.epicId),
          getEpicTickets(reply.epicId),
        ]);
        if (!cancelled) {
          setEpic(epicData);
          setTickets(ticketsData);
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [reply.epicId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Loader2 size={14} className="animate-spin" />
        Loading epic and tickets…
      </div>
    );
  }

  if (error || !epic) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
        {error ?? 'Epic not found'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400">
        <CheckCircle size={16} />
        Epic and {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}{' '}
        created
      </div>
      <PlanCard reply={{ epic, tickets }} showLinks />
    </div>
  );
}
