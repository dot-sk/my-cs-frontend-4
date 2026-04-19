import { PackrStream } from "msgpackr";
import { createWriteStream } from "node:fs";
import { once } from "node:events";

const DIR = `${import.meta.dir}/fixtures`;
const CSV = `${DIR}/big.csv`;
const JSON_PATH = `${DIR}/big.json`;
const MP = `${DIR}/big.msgpack`;
const ROWS = 1_500_000;
const BASE_TS = 1_700_000_000_000;
const CITIES = [
  "Москва",
  "Санкт-Петербург",
  "Казань",
  "Новосибирск",
  "Екатеринбург",
  "Сочи",
  "Владивосток",
  "Краснодар",
];

type Row = [
  id: number,
  timestamp: number,
  score: number,
  active: boolean,
  name: string,
  city: string,
];

function* rows(): Generator<Row> {
  for (let i = 0; i < ROWS; i++) {
    yield [
      i,
      BASE_TS + i * 1000,
      ((i * 37) % 10_000) / 10_000,
      i % 2 === 0,
      `user_${i}_${"x".repeat(10)}`,
      CITIES[i % CITIES.length]!,
    ];
  }
}

async function writeCsv() {
  const w = Bun.file(CSV).writer();
  w.write("id,timestamp,score,active,name,city\n");
  for (const r of rows()) {
    w.write(`${r[0]},${r[1]},${r[2]},${r[3]},${r[4]},${r[5]}\n`);
  }
  await w.end();
}

async function writeJson() {
  const w = Bun.file(JSON_PATH).writer();
  w.write("[");
  let first = true;
  for (const r of rows()) {
    if (!first) w.write(",");
    first = false;
    w.write(JSON.stringify(r));
  }
  w.write("]");
  await w.end();
}

async function writeMsgpack() {
  const out = createWriteStream(MP);
  const packer = new PackrStream();
  packer.pipe(out);
  for (const r of rows()) packer.write(r);
  packer.end();
  await once(out, "close");
}

const targets = [
  { name: "big.csv", path: CSV, write: writeCsv },
  { name: "big.json", path: JSON_PATH, write: writeJson },
  { name: "big.msgpack", path: MP, write: writeMsgpack },
];

for (const t of targets) {
  if (await Bun.file(t.path).exists()) continue;
  console.log(`Генерирую ${t.name}...`);
  await t.write();
}
