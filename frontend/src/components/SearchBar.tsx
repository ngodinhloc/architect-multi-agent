'use client';

import { useState, FormEvent } from 'react';
import { Send } from 'lucide-react';

interface SearchBarProps {
  onSearch: (message: string) => void;
  loading: boolean;
  placeholder?: string;
}

export default function SearchBar({
  onSearch,
  loading,
  placeholder = 'Describe a software requirement…',
}: SearchBarProps) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (value.trim()) {
      onSearch(value.trim());
      setValue('');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        disabled={loading}
        className="flex-1 rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm shadow-sm outline-none placeholder:text-zinc-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 disabled:opacity-50"
      >
        <Send size={15} />
        {loading ? 'Thinking…' : 'Send'}
      </button>
    </form>
  );
}
