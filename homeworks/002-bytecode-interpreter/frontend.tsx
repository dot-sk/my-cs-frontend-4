import React, { forwardRef, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { Button } from "homeworks/002-bytecode-interpreter/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "homeworks/002-bytecode-interpreter/components/ui/card";
import { Label } from "homeworks/002-bytecode-interpreter/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "homeworks/002-bytecode-interpreter/components/ui/table";
import { Textarea } from "homeworks/002-bytecode-interpreter/components/ui/textarea";
import { cn } from "homeworks/002-bytecode-interpreter/lib/utils";
import {
  INSTRUCTIONS,
  allSounds,
  opcodeNames,
  type Pattern,
} from "./bytecode-vm";
import { useDrumMachine, type DrumStatus } from "./useDrumMachine";

import "./globals.built.css";

/** Свинг-бит */
const I = INSTRUCTIONS;
const DEFAULT_PROGRAM = [
  I.KICK,
  I.HIHAT,
  I.REST,
  I.REST,
  I.HIHAT,
  I.REST,
  I.ACCENT,
  I.SNARE,
  I.HIHAT,
  I.REST,
  I.REST,
  I.HIHAT,
  I.REST,
  I.KICK,
  I.HIHAT,
  I.REST,
  I.REST,
  I.HIHAT,
  I.REST,
  I.ACCENT,
  I.SNARE,
  I.CLAP,
  I.HIHAT,
  I.REST,
  I.REST,
  I.HIHAT,
  I.BPM,
  100,
  I.LOOP,
  999,
  I.PRINT,
  I.PLAY,
] as const;

const STEPS_PER_BAR = 16;

function splitProgramParts(program: readonly number[]) {
  let i = 0;
  const linesBeforeGroove: string[] = [];
  if (i < program.length && program[i] === I.BPM) {
    linesBeforeGroove.push(`BPM ${program[i + 1]}`);
    i += 2;
  }
  const steps: number[][] = [];
  const stepClosedByRest: boolean[] = [];
  let cur: number[] = [];
  while (i < program.length) {
    const n = program[i]!;
    if (n === I.LOOP || n === I.PRINT || n === I.PLAY) {
      if (cur.length > 0) {
        steps.push(cur);
        stepClosedByRest.push(false);
        cur = [];
      }
      break;
    }
    if (n === I.REST) {
      steps.push(cur);
      stepClosedByRest.push(true);
      cur = [];
      i++;
    } else {
      cur.push(n);
      i++;
    }
  }
  const afterGroove: string[] = [];
  if (i < program.length && program[i] === I.LOOP) {
    afterGroove.push(`LOOP ${program[i + 1]}`);
    i += 2;
  }
  while (i < program.length) {
    const n = program[i]!;
    afterGroove.push(opcodeNames[n] ?? String(n));
    i++;
  }
  return { linesBeforeGroove, steps, stepClosedByRest, afterGroove };
}

function formatGrooveStep(step: number[], closedByRest: boolean): string {
  if (step.length === 0) return "REST";
  const body = step.map((n) => opcodeNames[n] ?? String(n)).join(" ");
  return closedByRest ? `${body} REST` : body;
}

function formatProgramText(program: readonly number[]): string {
  const { linesBeforeGroove, steps, stepClosedByRest, afterGroove } =
    splitProgramParts(program);
  const lines: string[] = [...linesBeforeGroove];
  for (let b = 0; b < steps.length; b += STEPS_PER_BAR) {
    const bar = steps.slice(b, b + STEPS_PER_BAR);
    const closed = stepClosedByRest.slice(b, b + STEPS_PER_BAR);
    lines.push(bar.map((s, j) => formatGrooveStep(s, closed[j]!)).join(" | "));
  }
  lines.push(...afterGroove);
  return lines.join("\n");
}

const OPCODE_BY_NAME = new Map<string, number>(
  Object.entries(INSTRUCTIONS).map(([name, code]) => [
    name.toUpperCase(),
    code,
  ]),
);

function parseProgramText(
  text: string,
): { ok: true; program: number[] } | { ok: false; error: string } {
  const tokens = text
    .replace(/\|/g, " ")
    .trim()
    .split(/[\s,\n]+/)
    .filter(Boolean);
  const program: number[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    const asOpcode = OPCODE_BY_NAME.get(t.toUpperCase());
    if (asOpcode !== undefined) {
      program.push(asOpcode);
      continue;
    }
    let n: number;
    if (/^0x[0-9a-f]+$/i.test(t)) {
      n = parseInt(t.slice(2), 16);
    } else if (/^-?\d+$/.test(t)) {
      n = parseInt(t, 10);
    } else {
      return {
        ok: false,
        error: `Неизвестное слово или число (позиция ${i + 1}): "${t}"`,
      };
    }
    if (!Number.isFinite(n)) {
      return {
        ok: false,
        error: `Некорректное число (позиция ${i + 1}): "${t}"`,
      };
    }
    program.push(n);
  }
  return { ok: true, program };
}

const EDITOR_HINT =
  "Первая строка: BPM 120. Дальше по строке на такт: 16 шагов через « | ». Затем LOOP 999, PRINT, PLAY. Разделитель «|» можно опускать (достаточно пробелов).";

function formatBytecodeHex(words: readonly number[]): string {
  return words.map((n) => `0x${n.toString(16).padStart(2, "0")}`).join(", ");
}

function BytecodePanel({ program }: { program: readonly number[] }) {
  const hex = formatBytecodeHex(program);
  const dec = program.join(", ");
  return (
    <Card className="border-border/80 lg:sticky lg:top-4 lg:w-80 lg:shrink-0">
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-sm">Байткод VM</CardTitle>
        <CardDescription className="font-mono text-xs">
          Реальный массив program: {program.length} слов
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            hex
          </p>
          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/30 p-2 font-mono text-xs leading-relaxed text-foreground">
            {hex}
          </pre>
        </div>
        <div>
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            decimal
          </p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-muted/30 p-2 font-mono text-xs leading-relaxed text-muted-foreground">
            {dec}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

function App() {
  const [program, setProgram] = useState<number[]>(() => [...DEFAULT_PROGRAM]);
  const [programText, setProgramText] = useState(() =>
    formatProgramText(DEFAULT_PROGRAM),
  );
  const [parseError, setParseError] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const { status, pattern, currentStep, programError, togglePlayPause } =
    useDrumMachine(program);

  const applyProgram = () => {
    const result = parseProgramText(programText);
    if (!result.ok) {
      setParseError(result.error);
      return;
    }
    setParseError(null);
    setProgram(result.program);
  };

  return (
    <>
      <div id="app-content" className="mx-auto max-w-7xl p-4">
        <h1 className="mb-6 text-3xl font-bold tracking-tight text-primary">
          TR-808
        </h1>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="min-w-0 flex-1 space-y-6">
            <Card className="border-border/80 w-full">
              <CardHeader className="pb-3">
                <CardTitle className="font-mono text-base">
                  Текст программы
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  Мнемоники; Apply загружает в VM - см. байткод справа
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="program" className="sr-only">
                    Программа
                  </Label>
                  <Textarea
                    id="program"
                    value={programText}
                    onChange={(e) => setProgramText(e.target.value)}
                    spellCheck={false}
                    rows={14}
                    className="resize-y overflow-x-auto bg-background/50"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={applyProgram}
                >
                  Apply
                </Button>
                {(parseError || programError) && (
                  <p className="font-mono text-sm text-destructive">
                    {parseError ?? programError}
                  </p>
                )}
              </CardContent>
            </Card>

            <PlayButton
              status={status}
              onClick={() => void togglePlayPause()}
            />

            {pattern && (
              <Grid ref={gridRef} pattern={pattern} currentStep={currentStep} />
            )}
          </div>

          <BytecodePanel program={program} />
        </div>
      </div>

      <div className="mx-auto mt-2 max-w-7xl px-4 font-mono text-xs text-muted-foreground">
        {EDITOR_HINT}
      </div>
    </>
  );
}

function PlayButton({
  status,
  onClick,
}: {
  status: DrumStatus;
  onClick: () => void;
}) {
  const label =
    status === "loading"
      ? "Loading..."
      : status === "playing"
        ? "PAUSE"
        : "PLAY";

  return (
    <Button
      type="button"
      size="lg"
      className="min-w-48 font-mono text-lg"
      disabled={status === "loading"}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

const Grid = forwardRef<
  HTMLDivElement,
  { pattern: Pattern; currentStep: number }
>(function Grid({ pattern, currentStep }, ref) {
  const { bpm, loops, steps } = pattern;

  return (
    <div ref={ref} className="w-max max-w-full font-mono">
      <p className="mb-3 text-sm text-muted-foreground">
        BPM: {bpm} <span className="text-border">|</span> Repeat: x{loops}
      </p>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10" />
            {steps.map((_, i) => (
              <TableHead
                key={i}
                className="h-8 min-w-7 px-1 text-center font-mono text-xs"
              >
                {i + 1}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {allSounds.map((sound) => {
            const hasAny = steps.some((s) => s.sounds.includes(sound));
            if (!hasAny) return null;
            return (
              <TableRow key={sound} className="hover:bg-transparent">
                <TableCell className="pr-2 text-left font-mono text-xs font-medium text-foreground">
                  {opcodeNames[sound] ?? "???"}
                </TableCell>
                {steps.map((step, i) => {
                  const active = i === currentStep;
                  const has = step.sounds.includes(sound);
                  return (
                    <TableCell
                      key={i}
                      className={cn(
                        "min-w-7 px-1 text-center font-mono text-xs transition-colors",
                        active && "bg-primary text-primary-foreground",
                        !active &&
                          has &&
                          (step.accent
                            ? "font-semibold text-primary"
                            : "text-foreground"),
                        !has && "text-muted-foreground/50",
                      )}
                    >
                      {has ? (step.accent ? "X" : "x") : "."}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
});

createRoot(document.getElementById("root")!).render(<App />);
