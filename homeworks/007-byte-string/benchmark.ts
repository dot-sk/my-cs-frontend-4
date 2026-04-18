import { run, bench, group, summary } from "mitata";
import { StringBuffer } from "./007-byte-string";
import { StringBufferRef } from "./007-byte-string-ref";

/**
 * Сравниваем .at() у двух реализаций.
 * - StringBuffer: схема [count][len1][bytes1][len2][bytes2]...,
 *   офсеты строк хранятся во внешнем Uint32Array.
 *   at(i) делает один lookup в JS-массиве и одно чтение uint32 через DataView
 * - StringBufferRef: схема [count][(len,ptr)*count][data...],
 *   длины и указатели лежат в самом буфере.
 *   at(i) делает два чтения uint32 через DataView по одному адресу
 *
 * Обе версии O(1), бенчмарк показывает разницу между JS-массивом и двумя DataView-чтениями
 */

const SIZES = [100, 10_000];
const ITERATIONS = 100_000;

function makeStrings(size: number): string[] {
  return Array.from({ length: size }, (_, i) => `s${i}${"x".repeat(i % 16)}`);
}

for (const size of SIZES) {
  const data = makeStrings(size);
  const sb = StringBuffer.fromData(data);
  const sbRef = StringBufferRef.fromData(data);

  group(`at, size ${size}`, () => {
    summary(() => {
      bench(`StringBuffer`, () => {
        for (let i = 0; i < ITERATIONS; i++) sb.at(i % size);
      });

      bench(`StringBufferRef`, () => {
        for (let i = 0; i < ITERATIONS; i++) sbRef.at(i % size);
      });
    });
  });
}

await run();
