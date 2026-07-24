import { useState } from 'react';
import type { Task } from '../types';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string, completed: boolean) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({ task, onToggle, onRename, onDelete }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  function commitRename() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== task.title) {
      onRename(task.id, trimmed);
    } else {
      setDraft(task.title);
    }
  }

  return (
    <li className={`task-item${task.completed ? ' task-item--done' : ''}`}>
      <label className="task-item__check">
        <input
          type="checkbox"
          className="visually-hidden"
          checked={task.completed}
          onChange={(e) => onToggle(task.id, e.target.checked)}
          aria-label={`Marcar "${task.title}" como ${task.completed ? 'pendiente' : 'completada'}`}
        />
        <span className="checkbox-box" aria-hidden="true">
          <svg viewBox="0 0 16 16" className="checkbox-tick">
            <path d="M3 8.5L6.5 12L13 4.5" />
          </svg>
        </span>
      </label>

      {editing ? (
        <input
          className="task-item__edit-input"
          type="text"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setDraft(task.title);
              setEditing(false);
            }
          }}
        />
      ) : (
        <span className="task-item__title" onDoubleClick={() => setEditing(true)}>
          {task.title}
        </span>
      )}

      <div className="task-item__actions">
        <button
          type="button"
          className="icon-button"
          onClick={() => setEditing(true)}
          aria-label="Editar tarea"
        >
          Editar
        </button>
        <button
          type="button"
          className="icon-button icon-button--danger"
          onClick={() => onDelete(task.id)}
          aria-label="Eliminar tarea"
        >
          Eliminar
        </button>
      </div>
    </li>
  );
}
