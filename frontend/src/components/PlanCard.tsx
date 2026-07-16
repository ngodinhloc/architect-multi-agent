'use client';

import Link from 'next/link';
import { ReplyInterface, TicketInterface } from '@/types/chat';
import { CheckCircle, Layers, Ticket } from 'lucide-react';

interface PlanCardProps {
  reply: ReplyInterface;
  onAccept?: () => void;
  onRefine?: (message: string) => void;
  showActions?: boolean;
  showLinks?: boolean;
}

export default function PlanCard({
  reply,
  onAccept,
  showActions = false,
  showLinks = false,
}: PlanCardProps) {
  const { epic, tickets } = reply;

  return (
    <div className="space-y-6">
      {/* Solution Architecture */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-800 dark:bg-indigo-950/40">
        <div className="mb-3 flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
          <Layers size={16} />
          <span className="text-sm font-semibold uppercase tracking-wide">
            Solution Architecture
          </span>
        </div>
        {showLinks ? (
          <Link
            href={`/epic/${epic.id}`}
            className="mb-1 block text-base font-semibold text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            {epic.name}
          </Link>
        ) : (
          <p className="mb-1 text-base font-semibold text-zinc-800 dark:text-zinc-200">
            {epic.name}
          </p>
        )}
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          {epic.solution.architecture}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {epic.solution.components.map((comp, i) => (
            <div
              key={i}
              className="rounded-lg border border-indigo-100 bg-white p-3 dark:border-indigo-900 dark:bg-zinc-900"
            >
              <p className="mb-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                {comp.tech}
              </p>
              <ul className="space-y-0.5">
                {comp.features.map((f, j) => (
                  <li
                    key={j}
                    className="flex items-start gap-1.5 text-sm text-zinc-600 dark:text-zinc-400"
                  >
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
          <span className="text-sm font-semibold uppercase tracking-wide">
            {tickets.length} Development Tickets
          </span>
        </div>
        <div className="space-y-3">
          {tickets.map((ticket: TicketInterface, i: number) => (
            <div
              key={ticket.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <p className="mb-2 text-base font-semibold text-zinc-800 dark:text-zinc-200">
                <span className="mr-2 text-sm font-normal text-zinc-400">
                  #{i + 1}
                </span>
                {showLinks ? (
                  <Link
                    href={`/ticket/${ticket.id}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {ticket.name}
                  </Link>
                ) : (
                  ticket.name
                )}
              </p>
              {ticket.requirements.length > 0 && (
                <div className="mb-2">
                  <p className="mb-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Requirements
                  </p>
                  <ul className="space-y-0.5">
                    {ticket.requirements.map((r, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-1.5 text-sm text-zinc-600 dark:text-zinc-400"
                      >
                        <span className="mt-0.5 shrink-0 text-zinc-400">•</span>
                        {r.requirement}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {ticket.acceptance_criteria.length > 0 && (
                <div>
                  <p className="mb-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    Acceptance Criteria
                  </p>
                  <ul className="space-y-0.5">
                    {ticket.acceptance_criteria.map((a, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-1.5 text-sm text-zinc-600 dark:text-zinc-400"
                      >
                        <CheckCircle
                          size={12}
                          className="mt-0.5 shrink-0 text-green-500"
                        />
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

      {/* Actions */}
      {showActions && onAccept && (
        <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/40">
          <p className="flex-1 text-sm text-zinc-600 dark:text-zinc-400">
            Happy with this plan? Create the epic and tickets now.
          </p>
          <button
            onClick={onAccept}
            className="flex items-center gap-2 rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-500"
          >
            <CheckCircle size={15} />
            Looks good
          </button>
        </div>
      )}
    </div>
  );
}
