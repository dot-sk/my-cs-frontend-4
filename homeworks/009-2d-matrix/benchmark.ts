import { bench, group, run } from "mitata";

import { Matrix2D } from "./009-2d-matrix";
import { RGBA } from "./shared/rgba";

const DIR = `${import.meta.dir}/fixtures-bench`;

/**
 * Фикстуры готовятся в браузерном UI (homeworks/009-2d-matrix/web)
 * по фото с миссии Artemis II – там canvas → getImageData → экспорт
 */
const binBytes = await Bun.file(`${DIR}/image.bin`).bytes();
const flatBytes = await Bun.file(`${DIR}/image.flat.json`).bytes();
const nestedBytes = await Bun.file(`${DIR}/image.nested.json`).bytes();

/**
 * Из bin достаем эталонный imageData – им кормим serialize-бенчи и
 * против него сверяем round-trip всех трех форматов
 */
const binDV = new DataView(
  binBytes.buffer,
  binBytes.byteOffset,
  binBytes.byteLength,
);
const WIDTH = binDV.getUint32(0, true);
const HEIGHT = binDV.getUint32(4, true);
const PIXELS = new Uint8ClampedArray(
  binBytes.buffer,
  binBytes.byteOffset + 8,
  binBytes.byteLength - 8,
);
const imageData = { width: WIDTH, height: HEIGHT, data: PIXELS };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const formats = {
  bin: {
    /** u32 width LE + u32 height LE + raw RGBA – ровно matrix.buffer */
    serialize() {
      const out = new Uint8Array(8 + imageData.data.byteLength);
      const dv = new DataView(out.buffer);
      dv.setUint32(0, imageData.width, true);
      dv.setUint32(4, imageData.height, true);
      out.set(imageData.data, 8);
      return out;
    },
    deserialize(bytes: Uint8Array) {
      const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const w = dv.getUint32(0, true);
      const h = dv.getUint32(4, true);
      const data = new Uint8ClampedArray(
        bytes.buffer,
        bytes.byteOffset + 8,
        bytes.byteLength - 8,
      );
      return { width: w, height: h, data };
    },
  },
  flat: {
    /** { width, height, data: [r, g, b, a, r, g, b, a, ...] } */
    serialize() {
      // ручной цикл вместо Array.from – Array.from идет через iterator
      // protocol и на 9.8 млн элементов в ~24 раза медленнее
      const data = new Array<number>(imageData.data.length);
      for (let i = 0; i < imageData.data.length; i++) {
        data[i] = imageData.data[i];
      }
      return encoder.encode(
        JSON.stringify({
          width: imageData.width,
          height: imageData.height,
          data,
        }),
      );
    },
    deserialize(bytes: Uint8Array) {
      const obj = JSON.parse(decoder.decode(bytes)) as {
        width: number;
        height: number;
        data: number[];
      };
      return {
        width: obj.width,
        height: obj.height,
        data: new Uint8ClampedArray(obj.data),
      };
    },
  },
  nested: {
    /** { width, height, pixels: [[r, g, b, a], [r, g, b, a], ...] } */
    serialize() {
      const pixels: number[][] = new Array(imageData.width * imageData.height);
      for (let i = 0; i < pixels.length; i++) {
        const o = i * 4;
        pixels[i] = [
          imageData.data[o],
          imageData.data[o + 1],
          imageData.data[o + 2],
          imageData.data[o + 3],
        ];
      }
      return encoder.encode(
        JSON.stringify({
          width: imageData.width,
          height: imageData.height,
          pixels,
        }),
      );
    },
    deserialize(bytes: Uint8Array) {
      const obj = JSON.parse(decoder.decode(bytes)) as {
        width: number;
        height: number;
        pixels: number[][];
      };
      const data = new Uint8ClampedArray(obj.width * obj.height * 4);
      for (let i = 0; i < obj.pixels.length; i++) {
        const p = obj.pixels[i];
        const o = i * 4;
        data[o] = p[0];
        data[o + 1] = p[1];
        data[o + 2] = p[2];
        data[o + 3] = p[3];
      }
      return { width: obj.width, height: obj.height, data };
    },
  },
} as const;

/** Sanity round-trip – чтобы битый формат не маскировал результаты */
for (const [name, f] of Object.entries(formats)) {
  const round = f.deserialize(f.serialize());
  if (
    round.width !== imageData.width ||
    round.height !== imageData.height ||
    round.data.length !== imageData.data.length
  ) {
    throw new Error(`${name}: round-trip shape mismatch`);
  }
  for (const i of [0, 1, 2, 3, 100, 1234, imageData.data.length - 1]) {
    if (round.data[i] !== imageData.data[i]) {
      throw new Error(`${name}: round-trip data mismatch at ${i}`);
    }
  }
}

/** Smoke-тест Matrix2D поверх декодированного bin – формат и матрица согласованы */
{
  const decoded = formats.bin.deserialize(binBytes);
  const matrix = new Matrix2D(
    decoded.width,
    decoded.height,
    RGBA,
    decoded.data,
  );
  if (matrix.BYTES_PER_ELEMENT !== 4 || matrix.width !== WIDTH) {
    throw new Error("Matrix2D smoke test failed");
  }
}

const mb = (b: number) => (b / 1024 / 1024).toFixed(2);
const pad = (s: string) => s.padEnd(20);

console.log(
  `\nИзображение: ${WIDTH}×${HEIGHT}, ${mb(imageData.data.byteLength)} МБ raw RGBA`,
);

console.log("\nРазмеры на диске:");
console.log("  формат                raw          gzip         ratio");
const sizeRows: Array<[string, string]> = [
  ["Matrix2D (bin)", "image.bin"],
  ["JSON (flat)", "image.flat.json"],
  ["JSON (nested)", "image.nested.json"],
];
for (const [name, file] of sizeRows) {
  const f = Bun.file(`${DIR}/${file}`);
  const size = f.size;
  const gz = Bun.gzipSync(await f.bytes()).length;
  console.log(
    `  ${pad(name)} ${mb(size).padStart(6)} МБ   ${mb(gz).padStart(6)} МБ   ${(gz / size).toFixed(2)}`,
  );
}

console.log();

group("serialize", () => {
  bench("Matrix2D (bin)", () => formats.bin.serialize());
  bench("JSON (flat)", () => formats.flat.serialize());
  bench("JSON (nested)", () => formats.nested.serialize());
});

group("deserialize", () => {
  bench("Matrix2D (bin)", () => formats.bin.deserialize(binBytes));
  bench("JSON (flat)", () => formats.flat.deserialize(flatBytes));
  bench("JSON (nested)", () => formats.nested.deserialize(nestedBytes));
});

await run();
