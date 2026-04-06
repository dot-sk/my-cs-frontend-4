import {
  FlatArrayImage,
  ArrayOfArraysImage,
  ArrayOfObjectsImage,
  Uint32Image,
  PixelStream,
  TraverseMode,
} from "./rgba-pixels";

const WARMUP = 5;
const RUNS = 10;
const BAR_WIDTH = 30;

const sizes = [64, 256, 512, 1024, 2048];

const impls = [
  { name: "FlatArray", create: (s: number) => new FlatArrayImage(s, s) },
  {
    name: "ArrayOfArrays",
    create: (s: number) => new ArrayOfArraysImage(s, s),
  },
  {
    name: "ArrayOfObjects",
    create: (s: number) => new ArrayOfObjectsImage(s, s),
  },
  { name: "Uint32", create: (s: number) => new Uint32Image(s, s) },
];

type Stats = { median: number; p95: number };

function bench(stream: PixelStream, mode: TraverseMode): Stats {
  for (let i = 0; i < WARMUP; i++) stream.forEach(mode, () => {});

  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const start = performance.now();
    stream.forEach(mode, (rgba, x, y) => {
      stream.setPixel(x, y, [
        255 - rgba[0],
        255 - rgba[1],
        255 - rgba[2],
        rgba[3],
      ]);
    });
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  return {
    median: times[Math.floor(times.length / 2)],
    p95: times[Math.ceil(times.length * 0.95) - 1],
  };
}

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

const results = new Map<string, { row: Stats; col: Stats }>();
const key = (impl: string, size: number) => `${impl}:${size}`;

console.log("Запуск бенчмарков...\n");

for (const size of sizes) {
  for (const impl of impls) {
    const stream = new PixelStream(impl.create(size));
    results.set(key(impl.name, size), {
      row: bench(stream, TraverseMode.RowMajor),
      col: bench(stream, TraverseMode.ColMajor),
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
