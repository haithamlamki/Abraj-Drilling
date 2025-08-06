import { useEffect, useRef, useState } from "react";

type Props = { 
  value?: number; 
  onCommit: (v: number) => void; 
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export default function QuarterHoursInput({ 
  value, 
  onCommit, 
  placeholder = "0.00",
  className = "h-8 w-full border-0 bg-white px-2 text-xs",
  disabled = false
}: Props) {
  const [buf, setBuf] = useState<string>(value?.toString() ?? "");
  const last = useRef(value);
  
  useEffect(() => {
    if (value !== last.current) { 
      setBuf(value?.toString() ?? ""); 
      last.current = value; 
    }
  }, [value]);

  function commit() {
    const n = Number(buf.replace(",", "."));
    if (Number.isFinite(n)) {
      const clamped = Math.min(24, Math.max(0, n));
      const snapped = Math.round(clamped / 0.25) * 0.25;
      onCommit(Number(snapped.toFixed(2)));
    } else {
      onCommit(0);
    }
  }

  return (
    <input
      className={`${className} ${disabled ? 'bg-gray-100 opacity-50' : ''}`}
      value={buf}
      onChange={(e) => setBuf(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
      inputMode="decimal"
      placeholder={placeholder}
      disabled={disabled}
    />
  );
}