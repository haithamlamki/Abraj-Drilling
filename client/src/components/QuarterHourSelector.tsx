import React from "react";
import { clamp, snapQuarter, quarters } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface QuarterHourSelectorProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  label?: string;
  disabled?: boolean;
  showDropdown?: boolean;
}

/**
 * A standalone quarter-hour time selector with input and optional dropdown
 * Designed for use in forms where precise time entry is required
 */
export function QuarterHourSelector({
  value,
  onChange,
  label,
  disabled = false,
  showDropdown = true
}: QuarterHourSelectorProps) {
  const onNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value === "" ? NaN : Number(e.target.value);
    if (Number.isNaN(raw)) return onChange(undefined);
    onChange(clamp(raw, 0, 24));
  };

  const onNumberBlur = () => {
    if (typeof value === "number") {
      onChange(snapQuarter(clamp(value, 0, 24)));
    }
  };

  const onSelectChange = (selectedValue: string) => {
    const v = Number(selectedValue);
    onChange(clamp(v, 0, 24));
  };

  const display = (v: number | undefined) =>
    v === undefined ? "" : (Math.round(v * 100) / 100).toString();

  const quarterOptions = quarters(0, 24);

  return (
    <div className="space-y-3">
      {label && <Label className="text-sm font-medium">{label}</Label>}
      
      <div className="space-y-2">
        {/* Number input */}
        <div>
          <Input
            type="number"
            min={0}
            max={24}
            step={0.25}
            value={display(value)}
            onChange={onNumberChange}
            onBlur={onNumberBlur}
            placeholder="Enter hours (0-24)"
            disabled={disabled}
            className="w-full"
            data-testid="quarter-hour-input"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Type any value - snaps to nearest 0.25 on blur
          </p>
        </div>

        {/* Dropdown selector */}
        {showDropdown && (
          <div>
            <Select
              value={value?.toString() || ""}
              onValueChange={onSelectChange}
              disabled={disabled}
            >
              <SelectTrigger data-testid="quarter-hour-select">
                <SelectValue placeholder="Or select quarter hours" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {quarterOptions.map((v) => (
                  <SelectItem key={v} value={v.toString()}>
                    {v % 1 === 0 ? `${v}.00` : v.toString()} hours
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Quick select from 0 to 24 in 0.25 increments
            </p>
          </div>
        )}
      </div>
      
      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
        <strong>Quarter-hour validation:</strong> Values are automatically rounded to the nearest 0.25 (15-minute intervals)
      </div>
    </div>
  );
}