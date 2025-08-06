import { useEffect, useRef, useState } from "react";
import { format, parse, isValid } from "date-fns";

type Props = {
  value?: string;                   // canonical ISO or "dd/MM/yyyy"
  onCommit: (iso: string | "") => void; // commit ISO ("" means unset)
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export default function DateCellInput({ 
  value, 
  onCommit, 
  placeholder = "dd/mm/yyyy",
  className = "h-8 w-full border-0 bg-white px-2 text-xs",
  disabled = false
}: Props) {
  // Show what's typed; do not parse until blur/Enter
  const [buf, setBuf] = useState<string>(formatForInput(value));
  const lastPropsValue = useRef(value);
  
  useEffect(() => {
    if (value !== lastPropsValue.current) {
      setBuf(formatForInput(value));
      lastPropsValue.current = value;
    }
  }, [value]);

  function formatForInput(v?: string) {
    if (!v) return "";
    try {
      // Try parsing as ISO date first
      const isoDate = parse(v, "yyyy-MM-dd", new Date());
      if (isValid(isoDate)) {
        return format(isoDate, "dd/MM/yyyy");
      }
      // Try parsing as dd/MM/yyyy
      const ddmmDate = parse(v, "dd/MM/yyyy", new Date());
      if (isValid(ddmmDate)) {
        return v;
      }
    } catch {
      // Fall back to original value
    }
    return v;
  }

  function commit() {
    try {
      const parsedDate = parse(buf, "dd/MM/yyyy", new Date());
      if (isValid(parsedDate)) {
        onCommit(format(parsedDate, "yyyy-MM-dd")); // commit ISO
      } else {
        onCommit(""); // invalid date
      }
    } catch {
      onCommit(""); // parsing error
    }
  }

  return (
    <input
      className={`${className} ${disabled ? 'bg-gray-100 opacity-50' : ''}`}
      value={buf}
      onChange={(e) => setBuf(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.currentTarget.blur(); } }}
      placeholder={placeholder}
      inputMode="numeric"
      disabled={disabled}
    />
  );
}