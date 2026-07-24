import { useEffect, useMemo, useState } from 'react';
import { createTask, deleteTask, listTasks, updateTask } from './api';
import { TaskForm } from './components/TaskForm';
import { TaskList } from './components/TaskList';
import type { Task } from './types';
import './App.css';

type Filter = 'all' | 'pending' | 'completed';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    let cancelled = false;

    listTasks()
      .then((data) => {
        if (!cancelled) setTasks(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(title: string) {
    setError(null);
    try {
      const task = await createTask(title);
      setTasks((prev) => [...prev, task]);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleToggle(id: string, completed: boolean) {
    setError(null);
    const previous = tasks;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed } : t)));
    try {
      await updateTask(id, { completed });
    } catch (err) {
      setTasks(previous);
      setError((err as Error).message);
    }
  }

  async function handleRename(id: string, title: string) {
    setError(null);
    const previous = tasks;
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, title } : t)));
    try {
      await updateTask(id, { title });
    } catch (err) {
      setTasks(previous);
      setError((err as Error).message);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    const previous = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await deleteTask(id);
    } catch (err) {
      setTasks(previous);
      setError((err as Error).message);
    }
  }

  const filteredTasks = useMemo(() => {
    if (filter === 'pending') return tasks.filter((t) => !t.completed);
    if (filter === 'completed') return tasks.filter((t) => t.completed);
    return tasks;
  }, [tasks, filter]);

  const pendingCount = tasks.filter((t) => !t.completed).length;

  return (
    <div className="page">
      <main className="card">
        <header className="card__header">
          <h1>Lista de tareas</h1>
          <p className="subtitle">
            {loading
              ? 'Cargando...'
              : `${pendingCount} pendiente${pendingCount === 1 ? '' : 's'} de ${tasks.length}`}
          </p>
        </header>

        <TaskForm onCreate={handleCreate} />

        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}

        <nav className="filters">
          {(['all', 'pending', 'completed'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              className={`filter-button${filter === f ? ' filter-button--active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {{ all: 'Todas', pending: 'Pendientes', completed: 'Completadas' }[f]}
            </button>
          ))}
        </nav>

        {loading ? (
          <p className="empty-state">Cargando tareas...</p>
        ) : (
          <TaskList
            tasks={filteredTasks}
            onToggle={handleToggle}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        )}
      </main>
    </div>
  );
}

export default App;
