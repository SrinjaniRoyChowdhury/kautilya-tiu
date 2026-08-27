"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/field";
import { exactNameMatch, filterByTypedName } from "@/lib/suggest";

export type NameSuggestItem = { id: string; name: string };

export function NameSuggestInput({
  id,
  items,
  value,
  onChange,
  disabled,
  placeholder,
  maxLength,
}: {
  id: string;
  items: NameSuggestItem[];
  value: string;
  onChange: (value: string, match: NameSuggestItem | null) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = filterByTypedName(items, value);

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, []);

  function commit(text: string) {
    onChange(text, exactNameMatch(items, text));
  }

  function pick(item: NameSuggestItem) {
    onChange(item.name, item);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <Input
        id={id}
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          commit(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (!open || !matches.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => (index + 1) % matches.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => (index - 1 + matches.length) % matches.length);
          } else if (event.key === "Enter" && matches[active]) {
            event.preventDefault();
            pick(matches[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && matches.length ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-sm border border-gold-700/25 bg-parchment-50 shadow-sm"
        >
          {matches.map((item, index) => (
            <li key={item.id} role="option" aria-selected={index === active}>
              <button
                type="button"
                className={
                  index === active
                    ? "w-full px-3 py-2 text-left text-sm bg-parchment-200"
                    : "w-full px-3 py-2 text-left text-sm hover:bg-parchment-200"
                }
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(item)}
              >
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
