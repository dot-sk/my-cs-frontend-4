import { UnpackrStream } from "msgpackr";
import { createReadStream, statSync } from "node:fs";
import { CsvParser } from "./008-csv-parser";

const DIR = `${import.meta.dir}/fixtures`;
const CSV = `${DIR}/big.csv`;
const JSON_PATH = `${DIR}/big.json`;
const MP = `${DIR}/big.msgpack`;

const parser = new CsvParser();
const csvIter = () => parser.readline(Bun.file(CSV).stream(), ",");
const mpIter = () => {
  const source = createReadStream(MP);
  const unpacker = new UnpackrStream();
  source.pipe(unpacker);
  return { source, unpacker };
};

/**
 * Все про формат – в одном месте. Ниже просто цикл `for (const f of formats)`
 * для каждой метрики
 */
type Format = {
  name: string;
  key: "csv" | "csv-bytes" | "json" | "msgpack";
  path: string;
  /** Прочитать все записи, вернуть их количество */
  parseAll(): Promise<number>;
  /** Прочитать только первую запись */
  first(): Promise<unknown>;
};

const formats: Format[] = [
  {
    name: "CSV",
    key: "csv",
    path: CSV,
    async parseAll() {
      let n = 0;
      for await (const _ of csvIter()) n++;
      return n;
    },
    async first() {
      for await (const row of csvIter()) return row;
    },
  },
  {
    name: "JSON",
    key: "json",
    path: JSON_PATH,
    async parseAll() {
      const text = await Bun.file(JSON_PATH).text();
      return (JSON.parse(text) as unknown[]).length;
    },
    async first() {
      const text = await Bun.file(JSON_PATH).text();
      return (JSON.parse(text) as unknown[])[0];
    },
  },
  {
    name: "MessagePack",
    key: "msgpack",
    path: MP,
    async parseAll() {
      const { unpacker } = mpIter();
      let n = 0;
      for await (const _ of unpacker) n++;
      return n;
    },
    async first() {
      const { source, unpacker } = mpIter();
      try {
        for await (const row of unpacker) return row;
      } finally {
        source.destroy();
      }
    },
  },
];

/** Если скрипт запущен с argv – subprocess-режим для peak rss замера */
const subMode = process.argv[2];
if (subMode) {
  const f = formats.find((f) => f.key === subMode);
  if (!f) throw new Error(`unknown mode: ${subMode}`);
  console.log(await f.parseAll());
  process.exit(0);
}

/** Генерация фикстур вынесена в отдельный скрипт */
Bun.spawnSync(["bun", "run", `${import.meta.dir}/fixtures-generator.ts`], {
  stdout: "inherit",
  stderr: "inherit",
});

/** Выталкивает значение в модульный sink, чтобы JIT не мог выкинуть */
let sink: unknown;
const keep = (v: unknown) => {
  sink = v;
};

/** Прогрев + N замеров, возвращаем медиану и разброс */
async function measure(fn: () => Promise<unknown>) {
  for (let i = 0; i < 5; i++) keep(await fn());
  Bun.gc(true);
  const samples: number[] = [];
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    keep(await fn());
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  return { median: samples[10]!, min: samples[0]!, max: samples[19]! };
}

/** Абсолютный пик rss через `/usr/bin/time -l` в отдельном процессе */
function peakRssMb(key: string) {
  const proc = Bun.spawnSync(
    ["/usr/bin/time", "-l", "bun", "run", import.meta.path, key],
    { stderr: "pipe", stdout: "pipe" },
  );
  const stderr = new TextDecoder().decode(proc.stderr);
  if (!proc.success) throw new Error(`subprocess failed: ${stderr}`);
  // macOS: "N maximum resident set size" (байты или КБ), Linux: "(kbytes): N"
  const mac = stderr.match(/(\d+)\s+maximum resident set size/);
  if (mac) {
    const n = parseInt(mac[1]!, 10);
    return (n > 1_000_000 ? n : n * 1024) / 1024 / 1024;
  }
  const linux = stderr.match(/Maximum resident set size \(kbytes\):\s+(\d+)/);
  if (linux) return (parseInt(linux[1]!, 10) * 1024) / 1024 / 1024;
  throw new Error(`rss не нашелся: ${stderr}`);
}

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);
const pad = (name: string) => name.padEnd(12);

console.log("\nРазмеры:");
console.log("  формат       raw        gzip      ratio");
for (const f of formats) {
  const size = statSync(f.path).size;
  const gz = Bun.gzipSync(await Bun.file(f.path).bytes()).length;
  console.log(
    `  ${pad(f.name)} ${mb(size)} МБ   ${mb(gz)} МБ   ${(gz / size).toFixed(2)}`,
  );
}

console.log("\nПолный парсинг (мс, медиана из 20 + warmup 5):");
for (const f of formats) {
  const r = await measure(f.parseAll);
  console.log(
    `  ${pad(f.name)} ${r.median.toFixed(1).padStart(6)}  (min ${r.min.toFixed(1)}, max ${r.max.toFixed(1)})`,
  );
}

console.log("\nДо первой записи (мс, медиана из 20 + warmup 5):");
for (const f of formats) {
  const r = await measure(f.first);
  console.log(
    `  ${pad(f.name)} ${r.median.toFixed(2).padStart(6)}  (min ${r.min.toFixed(2)}, max ${r.max.toFixed(2)})`,
  );
}

console.log("\nПик rss процесса (/usr/bin/time -l, МБ):");
for (const f of formats) {
  console.log(`  ${pad(f.name)} ${peakRssMb(f.key).toFixed(2)}`);
}
console.log();
