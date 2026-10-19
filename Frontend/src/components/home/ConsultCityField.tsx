"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

type CityOption = {
  id: string;
  label: string;
};

type ConsultCityFieldProps = {
  labelId: string;
  value: string;
  options: CityOption[];
  onChange: (value: string) => void;
};

export default function ConsultCityField({
  labelId,
  value,
  options,
  onChange,
}: ConsultCityFieldProps) {
  const listId = useId();
  const valueId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.id === value),
  );
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(selectedIndex);
  const current = options.find((option) => option.id === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();

    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
  }

  function onListKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((index) => Math.min(options.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((index) => Math.max(0, index - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setCursor(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setCursor(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[cursor];
      if (option) choose(option.id);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div
      className="consult-city"
      ref={rootRef}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node) || !rootRef.current?.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="consult-input consult-city-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-labelledby={`${labelId} ${valueId}`}
        onClick={() => {
          setCursor(selectedIndex);
          setOpen((isOpen) => !isOpen);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setCursor(selectedIndex);
            setOpen(true);
          }
        }}
      >
        <span id={valueId}>{current?.label}</span>
        <svg viewBox="0 0 16 16" className={open ? "is-open" : ""} aria-hidden="true">
          <path
            d="M4 6.2 8 10.2 12 6.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open ? (
        <div
          id={listId}
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          className="consult-city-panel"
          onKeyDown={onListKey}
        >
          {options.map((option, index) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === value}
              className={[
                "consult-city-option",
                option.id === value ? "is-selected" : "",
                index === cursor ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onMouseEnter={() => setCursor(index)}
              onClick={() => choose(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
