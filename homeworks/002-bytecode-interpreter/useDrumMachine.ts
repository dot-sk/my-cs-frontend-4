import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { VM, soundFiles, type Pattern, type Runtime } from "./bytecode-vm";

export type DrumStatus = "loading" | "playing" | "stopped";

type UiState = {
  status: DrumStatus;
  pattern: Pattern | null;
  currentStep: number;
};

export function useDrumMachine(program: number[]) {
  const [state, setState] = useState<UiState>({
    status: "stopped",
    pattern: null,
    currentStep: -1,
  });
  const [programError, setProgramError] = useState<string | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const samplesRef = useRef<Record<number, AudioBuffer>>({});
  const samplesReadyRef = useRef(false);
  const stepIndexRef = useRef(0);
  const timerIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playingRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const clearSchedule = useCallback(() => {
    if (timerIdRef.current !== null) {
      clearTimeout(timerIdRef.current);
      timerIdRef.current = null;
    }
  }, []);

  const playStep = useCallback((sounds: number[], accent: boolean) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const samples = samplesRef.current;
    for (const sound of sounds) {
      const buf = samples[sound];
      if (!buf) continue;
      const source = ctx.createBufferSource();
      source.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = accent ? 1.5 : 1.0;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    }
  }, []);

  const resumeAudio = useCallback(() => {
    const ctx = ctxRef.current;
    if (ctx?.state === "suspended") void ctx.resume();
  }, []);

  const suspendAudio = useCallback(() => {
    const ctx = ctxRef.current;
    if (ctx?.state === "running") void ctx.suspend();
  }, []);

  const runtime: Runtime = useMemo(
    () => ({
      print: (pattern: Pattern) => {
        setState((s) => ({ ...s, pattern }));
      },
      play: (pattern: Pattern) => {
        setState((s) => ({ ...s, pattern }));
        resumeAudio();
      },
    }),
    [resumeAudio],
  );

  const vm = useMemo(() => new VM(runtime), [runtime]);

  useEffect(() => {
    vm.load(program);
    playingRef.current = false;
    clearSchedule();
    stepIndexRef.current = 0;
    try {
      vm.run();
      setProgramError(null);
      setState((s) => ({ ...s, status: "stopped", currentStep: -1 }));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setProgramError(msg);
      setState((s) => ({
        ...s,
        pattern: null,
        status: "stopped",
        currentStep: -1,
      }));
    }
    return () => {
      playingRef.current = false;
      clearSchedule();
    };
  }, [program, vm, clearSchedule]);

  const stopPlayback = useCallback(() => {
    playingRef.current = false;
    clearSchedule();
    stepIndexRef.current = 0;
    setState((s) => ({ ...s, status: "stopped", currentStep: -1 }));
  }, [clearSchedule]);

  const pausePlayback = useCallback(() => {
    playingRef.current = false;
    clearSchedule();
    suspendAudio();
    setState((s) => ({ ...s, status: "stopped" }));
  }, [clearSchedule, suspendAudio]);

  const startPlayback = useCallback(() => {
    const pattern = stateRef.current.pattern;
    if (!pattern) return;

    playingRef.current = true;
    setState((s) => ({ ...s, status: "playing" }));
    resumeAudio();

    const { bpm, loops, steps } = pattern;
    const beatsPerBar = 4;
    const stepsPerBeat = steps.length / beatsPerBar;
    const stepMs = (60 / bpm / stepsPerBeat) * 1000;
    const totalSteps = steps.length * loops;

    const tick = () => {
      if (!playingRef.current) return;
      const stepIdx = stepIndexRef.current % steps.length;
      const step = steps[stepIdx]!;
      playStep(step.sounds, step.accent);
      setState((s) => ({ ...s, currentStep: stepIdx }));

      stepIndexRef.current++;
      if (stepIndexRef.current >= totalSteps) {
        stopPlayback();
        return;
      }

      timerIdRef.current = setTimeout(tick, stepMs);
    };

    tick();
  }, [playStep, resumeAudio, stopPlayback]);

  const togglePlayPause = useCallback(async () => {
    if (stateRef.current.status === "playing") {
      pausePlayback();
      return;
    }

    if (!samplesReadyRef.current) {
      setState((s) => ({ ...s, status: "loading" }));
      ctxRef.current ??= new AudioContext();
      const ctx = ctxRef.current;
      for (const [opcode, filename] of Object.entries(soundFiles)) {
        const response = await fetch(`/samples/${filename}`);
        const buffer = await response.arrayBuffer();
        samplesRef.current[Number(opcode)] = await ctx.decodeAudioData(buffer);
      }
      samplesReadyRef.current = true;
      setState((s) => ({ ...s, status: "stopped" }));
    }

    startPlayback();
  }, [pausePlayback, startPlayback]);

  return {
    status: state.status,
    pattern: state.pattern,
    currentStep: state.currentStep,
    programError,
    togglePlayPause,
  };
}
