import {
  FlatArrayImage,
  ArrayOfArraysImage,
  ArrayOfObjectsImage,
  Uint32Image,
  PixelStream,
  TraverseMode,
} from "./rgba-pixels";

const resolutions = [
  { name: "64x64", width: 64, height: 64 },
  { name: "256x256", width: 256, height: 256 },
  { name: "512x512", width: 512, height: 512 },
  { name: "1024x1024", width: 1024, height: 1024 },
  { name: "2048x2048", width: 2048, height: 2048 },
];

const implementations = [
  {
    name: "FlatArray",
    create: (w: number, h: number) => new FlatArrayImage(w, h),
  },
  {
    name: "ArrayOfArrays",
    create: (w: number, h: number) => new ArrayOfArraysImage(w, h),
  },
  {
    name: "ArrayOfObjects",
    create: (w: number, h: number) => new ArrayOfObjectsImage(w, h),
  },
  { name: "Uint32", create: (w: number, h: number) => new Uint32Image(w, h) },
];

const WARMUP_RUNS = 3;
const BENCH_RUNS = 10;

type Result = {
  impl: string;
  resolution: string;
  rowMajorMs: number;
  colMajorMs: number;
};

function benchTraversal(
  stream: PixelStream,
  mode: TraverseMode,
  runs: number,
): number {
  for (let i = 0; i < WARMUP_RUNS; i++) {
    stream.forEach(mode, () => {});
  }

  const times: number[] = [];
  for (let i = 0; i < runs; i++) {
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
  return times[Math.floor(times.length / 2)];
}

function formatMs(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)} us`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function mdTable(title: string, headers: string[], rows: string[][]) {
  console.log(`### ${title}\n`);
  console.log("| " + headers.join(" | ") + " |");
  console.log("| " + headers.map(() => "---").join(" | ") + " |");
  for (const row of rows) {
    console.log("| " + row.join(" | ") + " |");
  }
  console.log();
}

console.log("Запуск бенчмарков...\n");

const results: Result[] = [];

for (const res of resolutions) {
  for (const impl of implementations) {
    const image = impl.create(res.width, res.height);
    const stream = new PixelStream(image);

    const rowMajorMs = benchTraversal(
      stream,
      TraverseMode.RowMajor,
      BENCH_RUNS,
    );
    const colMajorMs = benchTraversal(
      stream,
      TraverseMode.ColMajor,
      BENCH_RUNS,
    );

    results.push({
      impl: impl.name,
      resolution: res.name,
      rowMajorMs,
      colMajorMs,
    });
  }
  console.log(`  ${res.name} done`);
}

const resHeaders = ["Реализация", ...resolutions.map((r) => r.name)];

function findResult(implName: string, resName: string) {
  return results.find((r) => r.impl === implName && r.resolution === resName)!;
}

console.log();

mdTable(
  "Row-Major Traversal (forEach + setPixel)",
  resHeaders,
  implementations.map((impl) => [
    impl.name,
    ...resolutions.map((res) =>
      formatMs(findResult(impl.name, res.name).rowMajorMs),
    ),
  ]),
);

mdTable(
  "Col-Major Traversal (forEach + setPixel)",
  resHeaders,
  implementations.map((impl) => [
    impl.name,
    ...resolutions.map((res) =>
      formatMs(findResult(impl.name, res.name).colMajorMs),
    ),
  ]),
);

mdTable(
  "Разница col-major vs row-major (замедление)",
  resHeaders,
  implementations.map((impl) => [
    impl.name,
    ...resolutions.map((res) => {
      const r = findResult(impl.name, res.name);
      return `x${(r.colMajorMs / r.rowMajorMs).toFixed(2)}`;
    }),
  ]),
);
