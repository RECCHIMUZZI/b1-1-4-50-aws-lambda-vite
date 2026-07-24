import { useState } from 'react';
import type { FormEvent } from 'react';

interface TaskFormProps {
  onCreate: (title: string) => Promise<void>;
}

export function TaskForm({ onCreate }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      await onCreate(trimmed);
      setTitle('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="¿Qué hay que hacer?"
        aria-label="Nueva tarea"
        disabled={submitting}
      />
      <button type="submit" disabled={submitting || !title.trim()}>
        Agregar
      </button>
    </form>
  );
}
