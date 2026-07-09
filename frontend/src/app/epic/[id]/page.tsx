"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, ClipboardList, Layers, Loader2, Ticket } from "lucide-react";
import { EpicInterface, TicketInterface } from "@/types/chat";
import { getEpic, getEpicTickets } from "@/lib/api";

export default function EpicPage() {
  const { id } = useParams<{ id: string }>();
  const [epic, setEpic] = useState<EpicInterface | null>(null);
  const [tickets, setTickets] = useState<TicketInterface[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [e, t] = await Promise.all([getEpic(id), getEpicTickets(id)]);
        setEpic(e);
        setTickets(t);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-zinc-500">
        <Loader2 size={18} className="animate-spin" />
        Loading epic…
      </div>
    );
  }

  if (error || !epic) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-red-500">{error ?? "Epic not found"}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="w-full space-y-6 p-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          <ArrowLeft size={14} />
          Back to chat
        </Link>

        <div>
          <p className="mb-1 font-mono text-xs text-zinc-400">{epic.id}</p>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{epic.name}</h1>
        </div>

        {/* Requirements */}
        {epic.requirements?.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 dark:border-emerald-900 dark:from-emerald-950/40 dark:to-teal-950/40">
            <div className="mb-3 flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <ClipboardList size={18} />
              <span className="text-base font-bold uppercase tracking-wide">Requirements</span>
            </div>
            <ul className="space-y-2">
              {epic.requirements.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                  <CheckCircle size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                  {r.requirement}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Solution Architecture */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-800 dark:bg-indigo-950/40">
          <div className="mb-3 flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
            <Layers size={16} />
            <span className="text-sm font-semibold uppercase tracking-wide">Solution Architecture</span>
          </div>
          <p className="mb-4 text-sm text-zinc-700 dark:text-zinc-300">{epic.solution.architecture}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {epic.solution.components.map((comp, i) => (
              <div key={i} className="rounded-lg border border-indigo-100 bg-white p-3 dark:border-indigo-900 dark:bg-zinc-900">
                <p className="mb-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400">{comp.tech}</p>
                <ul className="space-y-0.5">
                  {comp.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                      <span className="mt-0.5 shrink-0 text-indigo-400">•</span>
                      {f.feature}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Tickets */}
        <div>
          <div className="mb-3 flex items-center gap-2 text-zinc-600 dark:text-zinc-400">
            <Ticket size={16} />
            <span className="text-sm font-semibold uppercase tracking-wide">{tickets.length} Development Tickets</span>
          </div>
          <div className="space-y-3">
            {tickets.map((ticket, i) => (
              <div key={ticket.id} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <p className="mb-3 text-base font-semibold">
                  <span className="mr-2 font-normal text-zinc-400">#{i + 1}</span>
                  <Link href={`/ticket/${ticket.id}`} className="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300">
                    {ticket.name}
                  </Link>
                </p>

                {ticket.requirements.length > 0 && (
                  <div className="mb-3">
                    <p className="mb-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">Requirements</p>
                    <ul className="space-y-1">
                      {ticket.requirements.map((r, j) => (
                        <li key={j} className="flex items-start gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                          <span className="mt-0.5 shrink-0 text-zinc-400">•</span>
                          {r.requirement}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {ticket.acceptance_criteria.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">Acceptance Criteria</p>
                    <ul className="space-y-1">
                      {ticket.acceptance_criteria.map((a, j) => (
                        <li key={j} className="flex items-start gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                          <CheckCircle size={12} className="mt-0.5 shrink-0 text-green-500" />
                          {a.criterion}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
