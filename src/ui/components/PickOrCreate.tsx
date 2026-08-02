import { useState } from 'react';

export type PickOrCreateValue =
  | { type: 'none' }
  | { type: 'existing'; id: string }
  | { type: 'create'; name: string };

export interface PickOrCreateOption {
  id: string;
  name: string;
}

export function normalizeName(s: string): string {
  return s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

interface PickOrCreateProps {
  label: string;
  items: PickOrCreateOption[];
  placeholder: string;
  allowNone?: boolean;
  noneLabel?: string;
  onChange: (value: PickOrCreateValue) => void;
}

export function PickOrCreate({ label, items, placeholder, allowNone = false, noneLabel, onChange }: PickOrCreateProps) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);

  const normalized = normalizeName(text);
  const exact = items.find((i) => normalizeName(i.name) === normalized);
  const matches = items.filter((i) => normalizeName(i.name).includes(normalized));
  const showCreate = normalized !== '' && !exact;
  const showOptions = focused && normalized !== '';

  const commit = (t: string) => {
    const n = normalizeName(t);
    const match = items.find((i) => normalizeName(i.name) === n);
    if (n === '') onChange({ type: 'none' });
    else if (match) onChange({ type: 'existing', id: match.id });
    else onChange({ type: 'create', name: t.trim() });
  };

  const selectItem = (opt: PickOrCreateOption) => {
    setText(opt.name);
    setFocused(false);
    onChange({ type: 'existing', id: opt.id });
  };

  const selectCreate = () => {
    setFocused(false);
    onChange({ type: 'create', name: text.trim() });
  };

  const selectNone = () => {
    setText('');
    setFocused(false);
    onChange({ type: 'none' });
  };

  return (
    <div
      className="pickorcreate"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
      }}
    >
      <input
        className="control pickorcreate-input"
        aria-label={label}
        autoComplete="off"
        value={text}
        placeholder={placeholder}
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
        onFocus={() => setFocused(true)}
      />
      {showOptions && (
        <ul className="pickorcreate-options" role="listbox" aria-label={label}>
          {matches.map((opt) => (
            <li key={opt.id} role="option">
              <button
                type="button"
                className="pickorcreate-option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectItem(opt)}
              >
                {opt.name}
              </button>
            </li>
          ))}
          {showCreate && (
            <li role="option">
              <button
                type="button"
                className="pickorcreate-option is-create"
                onMouseDown={(e) => e.preventDefault()}
                onClick={selectCreate}
              >
                Crear «{text.trim()}»
              </button>
            </li>
          )}
          {allowNone && (
            <li role="option">
              <button
                type="button"
                className="pickorcreate-option"
                onMouseDown={(e) => e.preventDefault()}
                onClick={selectNone}
              >
                {noneLabel}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
