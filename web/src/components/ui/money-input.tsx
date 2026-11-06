'use client';

import { useState } from 'react';
import { formatThousands } from '@/lib/format';

interface MoneyInputProps {
  id?: string;
  name: string;
  defaultValue?: number | string;
  value?: number | string;
  onChangeValue?: (valMinor: number) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  presets?: number[];
  autoFocus?: boolean;
}

export function MoneyInput({
  id,
  name,
  defaultValue,
  value: controlledValue,
  onChangeValue,
  placeholder = '0',
  required = false,
  disabled = false,
  className = '',
  presets,
  autoFocus = false,
}: MoneyInputProps) {
  const initialNumeric = defaultValue
    ? typeof defaultValue === 'number'
      ? defaultValue
      : parseInt(String(defaultValue).replace(/[^0-9]/g, ''), 10) || 0
    : 0;

  const [displayValue, setDisplayValue] = useState(
    initialNumeric > 0 ? formatThousands(initialNumeric) : '',
  );

  function handleChange(rawStr: string) {
    const digits = rawStr.replace(/[^0-9]/g, '');
    if (!digits) {
      setDisplayValue('');
      if (onChangeValue) onChangeValue(0);
      return;
    }
    const num = parseInt(digits, 10);
    setDisplayValue(formatThousands(num));
    if (onChangeValue) onChangeValue(num * 100);
  }

  function handlePreset(amountPesos: number) {
    const currentNum = parseInt(displayValue.replace(/[^0-9]/g, ''), 10) || 0;
    const nextNum = currentNum + amountPesos;
    setDisplayValue(formatThousands(nextNum));
    if (onChangeValue) onChangeValue(nextNum * 100);
  }

  // Si es controlado externamente
  const activeDisplay =
    controlledValue !== undefined
      ? controlledValue
        ? formatThousands(
            typeof controlledValue === 'number'
              ? controlledValue
              : parseInt(String(controlledValue).replace(/[^0-9]/g, ''), 10) || 0,
          )
        : ''
      : displayValue;

  return (
    <div className="space-y-1.5">
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-display text-[17px] font-bold text-ink-muted">
          $
        </span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={activeDisplay}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          className={`field tnum pl-8 font-display text-[18px] font-bold tracking-tight ${className}`}
        />
        {/* Input oculto con el valor limpio para que los formularios de server actions sigan funcionando intactos */}
        <input type="hidden" name={name} value={activeDisplay.replace(/,/g, '')} />
      </div>

      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePreset(p)}
              className="rounded-lg border border-line bg-paper px-2.5 py-1 text-[11.5px] font-semibold text-ink-muted transition hover:border-ink hover:bg-white hover:text-ink active:scale-95"
            >
              +${formatThousands(p)}
            </button>
          ))}
          {displayValue && (
            <button
              type="button"
              onClick={() => {
                setDisplayValue('');
                if (onChangeValue) onChangeValue(0);
              }}
              className="rounded-lg px-2 py-1 text-[11.5px] font-medium text-ink-faint hover:text-neg"
            >
              Borrar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
