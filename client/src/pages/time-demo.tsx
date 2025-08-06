import { useState } from "react";
import QuarterHourField from "@/components/QuarterHourField";
import { QuarterHourSelector } from "@/components/QuarterHourSelector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, Clock } from "lucide-react";

export default function TimeDemo() {
  const [value1, setValue1] = useState<number | undefined>(0.5);
  const [value2, setValue2] = useState<number | undefined>(1.25);
  const [testResults, setTestResults] = useState<string[]>([]);

  const runTests = () => {
    const results: string[] = [];
    
    // Test quarter-hour snapping
    const testCases = [
      { input: 0.1, expected: 0 },
      { input: 0.2, expected: 0.25 },
      { input: 1.3, expected: 1.25 },
      { input: 1.7, expected: 1.75 },
      { input: 25, expected: 24 }, // Max clamp
      { input: -1, expected: 0 }, // Min clamp
    ];
    
    testCases.forEach(({ input, expected }) => {
      const result = Math.round(Math.max(0, Math.min(24, input)) * 4) / 4;
      const passed = result === expected;
      results.push(`${input} → ${result} (expected ${expected}) ${passed ? '✓' : '✗'}`);
    });
    
    setTestResults(results);
  };

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Clock className="h-8 w-8" />
          Quarter-Hour Time Entry Demo
        </h1>
        <p className="text-muted-foreground">
          Enhanced NPT reporting with precise 15-minute interval time tracking
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Compact field - for table use */}
        <Card>
          <CardHeader>
            <CardTitle>Compact Field (Excel Table)</CardTitle>
            <CardDescription>
              Optimized for table cells in NPT forms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuarterHourField
              value={value1}
              onChange={setValue1}
              label="Hours"
            />
            <div className="mt-4 text-sm">
              <strong>Current value:</strong> {value1 ?? "undefined"} hours
            </div>
          </CardContent>
        </Card>

        {/* Full selector - for standalone use */}
        <Card>
          <CardHeader>
            <CardTitle>Full Selector (Standalone)</CardTitle>
            <CardDescription>
              Complete interface for dedicated time entry
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuarterHourSelector
              value={value2}
              onChange={setValue2}
              label="Meeting Duration"
            />
            <div className="mt-4 text-sm">
              <strong>Current value:</strong> {value2 ?? "undefined"} hours
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Validation testing */}
      <Card>
        <CardHeader>
          <CardTitle>Quarter-Hour Validation Testing</CardTitle>
          <CardDescription>
            Test the snapping behavior and validation rules
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runTests} className="w-full">
            Run Validation Tests
          </Button>
          
          {testResults.length > 0 && (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1 font-mono text-sm">
                  {testResults.map((result, index) => (
                    <div key={index}>{result}</div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-muted-foreground space-y-2">
            <h4 className="font-medium">How it works:</h4>
            <ul className="space-y-1 pl-4 list-disc">
              <li>Values automatically snap to the nearest 0.25 (15-minute intervals)</li>
              <li>Range is enforced: 0 to 24 hours</li>
              <li>Backend API validates quarter-hour compliance</li>
              <li>Both input and dropdown update the same value</li>
              <li>Type any decimal - it rounds to the nearest quarter</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}