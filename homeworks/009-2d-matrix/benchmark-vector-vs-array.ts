import { bench, group, run } from "mitata";
import { Vector } from "./009-vector";
import { RGBA } from "./shared/rgba";

type RGBAObj = { red: number; green: number; blue: number; alpha: number };

const N = 100_000;
const SHIFT_N = 10_000;
const HEAP_N = 1_000_000;

group("перезапись N элементов", () => {
  const vec = new Vector(N, RGBA);
  const arr: RGBAObj[] = new Array(N);
  for (let i = 0; i < N; i++) {
    vec.push([0, 0, 0, 0]);
    arr[i] = { red: 0, green: 0, blue: 0, alpha: 0 };
  }

  bench("Vector.set", () => {
    for (let i = 0; i < N; i++) vec.set(i, [i & 255, 0, 0, 255]);
  });

  bench("Array<object>", () => {
    for (let i = 0; i < N; i++) {
      arr[i] = { red: i & 255, green: 0, blue: 0, alpha: 255 };
    }
  });
});

group("push N + pop N (GC pressure)", () => {
  bench("Vector", () => {
    const v = new Vector(16, RGBA);
    for (let i = 0; i < N; i++) v.push([i & 255, 0, 0, 255]);
    for (let i = 0; i < N; i++) v.pop();
  });

  bench("Array<object>", () => {
    const arr: RGBAObj[] = [];
    for (let i = 0; i < N; i++) {
      arr.push({ red: i & 255, green: 0, blue: 0, alpha: 255 });
    }
    for (let i = 0; i < N; i++) arr.pop();
  });
});

group("unshift N в начало", () => {
  bench("Vector.unshift", () => {
    const v = new Vector(16, RGBA);
    for (let i = 0; i < SHIFT_N; i++) v.unshift([i & 255, 0, 0, 255]);
  });

  bench("Array.unshift", () => {
    const arr: RGBAObj[] = [];
    for (let i = 0; i < SHIFT_N; i++) {
      arr.unshift({ red: i & 255, green: 0, blue: 0, alpha: 255 });
    }
  });
});

await run();

/**
 * heapUsed и arrayBuffers – два разных пула, контейнеры платят в разные
 * Несколько gc() подряд гасят остатки от прошлых бенчей
 */
const mb = (b: number) => (b / 1024 / 1024).toFixed(2).padStart(7);

const flushGc = () => {
  Bun.gc(true);
  Bun.gc(true);
  Bun.gc(true);
};

const measure = (label: string, work: () => unknown) => {
  flushGc();
  const before = process.memoryUsage();
  const ref = work();
  flushGc();
  const after = process.memoryUsage();
  const heap = Math.max(0, after.heapUsed - before.heapUsed);
  const ab = Math.max(0, after.arrayBuffers - before.arrayBuffers);
  console.log(`  ${label.padEnd(16)} ${mb(heap)} МБ   ${mb(ab)} МБ`);
  return ref;
};

console.log(`\nПамять после ${HEAP_N.toLocaleString()} push:`);
console.log(`  контейнер           heap       arrayBuffers`);

const refV = measure("Vector", () => {
  const v = new Vector(16, RGBA);
  for (let i = 0; i < HEAP_N; i++) v.push([i & 255, 0, 0, 255]);
  return v;
});

const refA = measure("Array<object>", () => {
  const arr: RGBAObj[] = [];
  for (let i = 0; i < HEAP_N; i++) {
    arr.push({ red: i & 255, green: 0, blue: 0, alpha: 255 });
  }
  return arr;
});

void refV;
void refA;
