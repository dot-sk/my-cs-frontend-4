import { run, bench, group, summary } from "mitata";
import { RingBufferArray } from "./ring-buffer-array";

const SIZES = [100, 100_000];

/**
 * push и pop работают за O(1), для них гоняем 100k операций без проблем.
 * shift и unshift – O(n). При unshift массив еще и растет, поэтому цикл из N
 * операций дает суммарно O(N²) работы: первая операция стоит 1, вторая – 2,
 * и так далее до N. Средняя цена одной операции – N/2, всего операций N,
 * итого (N/2) · N = N²/2
 *
 * Для N = 100 000 это ~5 · 10⁹ перемещений элементов. Даже для массива из 100 элементов
 * такое количество операций будет существенным по времени. Поэтому для
 * shift и unshift берем поменьше итераций, иначе бенч нужно ждать вечность
 */
const HIGH_ITER = 100_000;
const LOW_ITER = 1_000;

const dense = (size: number) => Array.from({ length: size }, (_, i) => i);
const sparse = (size: number) => new Array(size);

for (const size of SIZES) {
  group(`push, size ${size}`, () => {
    summary(() => {
      bench(`dense push`, () => {
        const arr = dense(size);
        for (let i = 0; i < HIGH_ITER; i++) arr.push(i);
      });

      bench(`sparse push`, () => {
        const arr = sparse(size);
        for (let i = 0; i < HIGH_ITER; i++) arr.push(i);
      });

      bench(`ring push`, () => {
        const rb = new RingBufferArray<number>(size + HIGH_ITER);
        for (let i = 0; i < HIGH_ITER; i++) rb.push(i);
      });
    });
  });

  group(`pop, size ${size}`, () => {
    summary(() => {
      bench(`dense pop`, () => {
        const arr = dense(size + HIGH_ITER);
        for (let i = 0; i < HIGH_ITER; i++) arr.pop();
      });

      bench(`sparse pop`, () => {
        const arr = sparse(size + HIGH_ITER);
        for (let i = 0; i < HIGH_ITER; i++) arr.pop();
      });

      bench(`ring pop`, () => {
        const rb = new RingBufferArray<number>(size + HIGH_ITER);
        for (let i = 0; i < size + HIGH_ITER; i++) rb.push(i);
        for (let i = 0; i < HIGH_ITER; i++) rb.pop();
      });
    });
  });

  group(`shift, size ${size}`, () => {
    summary(() => {
      bench(`dense shift`, () => {
        const arr = dense(size + LOW_ITER);
        for (let i = 0; i < LOW_ITER; i++) arr.shift();
      });

      bench(`sparse shift`, () => {
        const arr = sparse(size + LOW_ITER);
        for (let i = 0; i < LOW_ITER; i++) arr.shift();
      });

      bench(`ring shift`, () => {
        const rb = new RingBufferArray<number>(size + LOW_ITER);
        for (let i = 0; i < size + LOW_ITER; i++) rb.push(i);
        for (let i = 0; i < LOW_ITER; i++) rb.shift();
      });
    });
  });

  group(`unshift, size ${size}`, () => {
    summary(() => {
      bench(`dense unshift`, () => {
        const arr = dense(size);
        for (let i = 0; i < LOW_ITER; i++) arr.unshift(i);
      });

      bench(`sparse unshift`, () => {
        const arr = sparse(size);
        for (let i = 0; i < LOW_ITER; i++) arr.unshift(i);
      });

      bench(`ring unshift`, () => {
        const rb = new RingBufferArray<number>(size + LOW_ITER);
        for (let i = 0; i < LOW_ITER; i++) rb.unshift(i);
      });
    });
  });
}

await run();
