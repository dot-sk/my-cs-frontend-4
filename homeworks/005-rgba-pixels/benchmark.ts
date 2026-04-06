import {
  FlatArrayImage,
  ArrayOfArraysImage,
  ArrayOfObjectsImage,
  Uint32Image,
  Uint8ClampedImage,
  PixelStream,
  TraverseMode,
} from "./rgba-pixels";

type RGBA = [number, number, number, number];

const WARMUP = 5;
const RUNS = 10;
const BAR_WIDTH = 30;

const sizes = [64, 256, 512, 1024, 2048];

interface Impl {
  name: string;
  create: (s: number) => PixelStream<any>;
  run: (stream: PixelStream<any>, mode: TraverseMode) => void;
}

/**
 * Инверсия цвета – минимальная, но реальная нагрузка на пиксель
 * Без трансформации движок может заметить, что результат не используется,
 * и выкинуть цикл целиком (dead code elimination)
 */
const rgbaRun = (stream: PixelStream<RGBA>, mode: TraverseMode) =>
  stream.forEach(mode, (rgba, x, y) => {
    stream.setPixel(x, y, [
      255 - rgba[0],
      255 - rgba[1],
      255 - rgba[2],
      rgba[3],
    ]);
  });

const impls: Impl[] = [
  {
    name: "FlatArray",
    create: (s) => new PixelStream(new FlatArrayImage(s, s)),
    run: rgbaRun,
  },
  {
    name: "ArrayOfArrays",
    create: (s) => new PixelStream(new ArrayOfArraysImage(s, s)),
    run: rgbaRun,
  },
  {
    name: "ArrayOfObjects",
    create: (s) => new PixelStream(new ArrayOfObjectsImage(s, s)),
    run: rgbaRun,
  },
  {
    name: "Uint32",
    create: (s) => new PixelStream(new Uint32Image(s, s)),
    run: (stream: PixelStream<Uint32Array, number>, mode) => {
      stream.forEach(mode, (v, x, y) => {
        const packed = v[0];
        const r = 255 - ((packed >> 24) & 0xff);
        const g = 255 - ((packed >> 16) & 0xff);
        const b = 255 - ((packed >> 8) & 0xff);
        const a = packed & 0xff;
        stream.setPixel(x, y, Uint32Image.pack(r, g, b, a));
      });
    },
  },
  {
    name: "Uint8Clamped",
    create: (s) => new PixelStream(new Uint8ClampedImage(s, s)),
    run: rgbaRun,
  },
];

function fmt(ms: number) {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} us`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function bar(value: number, max: number) {
  const filled = Math.round((value / max) * BAR_WIDTH);
  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
}

function mdTable(title: string, headers: string[], rows: string[][]) {
  console.log(`### ${title}\n`);
  console.log("| " + headers.join(" | ") + " |");
  console.log("| " + headers.map(() => "---").join(" | ") + " |");
  for (const row of rows) console.log("| " + row.join(" | ") + " |");
  console.log();
}

type Stats = { median: number; p95: number };

function bench(impl: Impl, size: number, mode: TraverseMode): Stats {
  const stream = impl.create(size);

  for (let i = 0; i < WARMUP; i++) impl.run(stream, mode);

  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    impl.run(stream, mode);
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  return {
    median: times[Math.floor(times.length / 2)],
    p95: times[Math.ceil(times.length * 0.95) - 1],
  };
}

const results = new Map<string, { row: Stats; col: Stats }>();
const key = (impl: string, size: number) => `${impl}:${size}`;

console.log("Запуск бенчмарков...\n");

for (const size of sizes) {
  for (const impl of impls) {
    results.set(key(impl.name, size), {
      row: bench(impl, size, TraverseMode.RowMajor),
      col: bench(impl, size, TraverseMode.ColMajor),
    });
  }
  console.log(`  ${size}x${size} done`);
}

console.log();

const sizeHeaders = ["Реализация", ...sizes.map((s) => `${s}x${s}`)];

for (const [mode, pick] of [
  ["Row-Major", "row"],
  ["Col-Major", "col"],
] as const) {
  mdTable(
    `${mode} Traversal (forEach + setPixel)`,
    sizeHeaders,
    impls.map((impl) => [
      impl.name,
      ...sizes.map((s) => {
        const st = results.get(key(impl.name, s))![pick];
        return `${fmt(st.median)} (p95: ${fmt(st.p95)})`;
      }),
    ]),
  );
}

mdTable(
  "Разница col-major vs row-major — median (замедление)",
  sizeHeaders,
  impls.map((impl) => [
    impl.name,
    ...sizes.map((s) => {
      const r = results.get(key(impl.name, s))!;
      return `x${(r.col.median / r.row.median).toFixed(2)}`;
    }),
  ]),
);

/** ASCII-барчарты для крупных разрешений */
const nameWidth = Math.max(...impls.map((i) => i.name.length));
const modes = [
  ["Row-Major", "row"],
  ["Col-Major", "col"],
] as const;

for (const size of sizes.slice(-2)) {
  const allMedians = modes.flatMap(([, pick]) =>
    impls.map((impl) => results.get(key(impl.name, size))![pick].median),
  );
  const max = Math.max(...allMedians);

  console.log(`\n## ${size}x${size} — сравнение реализаций\n`);

  for (const [mode, pick] of modes) {
    console.log(`  ${mode}:`);
    for (const impl of impls) {
      const median = results.get(key(impl.name, size))![pick].median;
      console.log(
        `    ${impl.name.padStart(nameWidth)}  ${bar(median, max)}  ${fmt(median)}`,
      );
    }
    console.log();
  }
}
