import React, { useMemo } from "react";
import { clamp, snapQuarter, quarters } from "@/lib/time";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  id?: string;
  name?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  label?: string;
  className?: string;
};

export default function QuarterHourField({
  value,
  onChange,
  id = "hours",
  name = "hours",
  min = 0,
  max = 24,
  disabled,
  label = "Hours",
  className = ""
}: Props) {

  const opts = useMemo(() => quarters(min, max), [min, max]);

  const onNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value === "" ? NaN : Number(e.target.value);
    if (Number.isNaN(raw)) return onChange(undefined);
    onChange(clamp(raw, min, max));
  };

  const onNumberBlur = () => {
    if (typeof value === "number") onChange(snapQuarter(clamp(value, min, max)));
  };

  const onSelectChange = (selectedValue: string) => {
    const v = Number(selectedValue);
    onChange(clamp(v, min, max));
  };

  const display = (v: number | undefined) =>
    v === undefined ? "" : (Math.round(v * 100) / 100).toString().replace(/\.00$/, "");

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor={id} className="font-medium">{label}</Label>

      <div className="flex items-start gap-3">
        {/* Number input with step 0.25 + snap on blur */}
        <div className="flex flex-col space-y-1">
          <Input
            id={id}
            name={name}
            type="number"
            min={min}
            max={max}
            step={0.25}
            inputMode="decimal"
            value={display(value)}
            onChange={onNumberChange}
            onBlur={onNumberBlur}
            placeholder="0.25"
            disabled={disabled}
            className="w-32"
            data-testid={`input-${name}-number`}
          />
          <small className="text-xs text-muted-foreground">Type (snaps to 0.25)</small>
        </div>

        {/* Dropdown with every quarter hour */}
        <div className="flex flex-col space-y-1">
          <Select
            value={value === undefined ? "" : value.toString()}
            onValueChange={onSelectChange}
            disabled={disabled}
          >
            <SelectTrigger className="w-40" data-testid={`select-${name}-quarter`}>
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {opts.map(v => (
                <SelectItem key={v} value={v.toString()}>
                  {v % 1 === 0 ? `${v}.00` : v.toString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <small className="text-xs text-muted-foreground">Pick (0–24 by 0.25)</small>
        </div>
      </div>

      <small className="text-xs text-muted-foreground">Accepted range: 0–24 in 0.25 steps.</small>
    </div>
  );
}