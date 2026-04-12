import { describe, expect, it } from "bun:test";

import { RingBufferArray } from "./ring-buffer-array";

/**
 * Тесты используют только размеры – степени двойки, чтобы не зависеть от
 * внутренней политики округления. Если класс решит хранить буфер больше
 * запрошенного (как сейчас, округляя до pow2), тесты с pow2-размерами
 * останутся детерминированными – capacity === запрошенному size
 *
 * Все проверки идут через публичный API (toArray, push, pop, shift,
 * unshift) – никаких обращений к приватным полям
 */

describe("RingBufferArray", () => {
  it("push: пишет в хвост", () => {
    const buf = new RingBufferArray<number>(4);
    buf.push(1);
    buf.push(2);
    buf.push(3);

    expect(buf.toArray()).toEqual([1, 2, 3]);
  });

  it("push: при переполнении затирает самый старый элемент", () => {
    const buf = new RingBufferArray<number>(4);
    for (let i = 1; i <= 7; i++) buf.push(i);

    // первые 3 элемента должны быть вытеснены, остаются последние 4
    expect(buf.toArray()).toEqual([4, 5, 6, 7]);
  });

  it("pop: снимает с хвоста по одному", () => {
    const buf = new RingBufferArray<number>(4);
    [0, 1, 2, 3].forEach((v) => buf.push(v));

    expect(buf.pop()).toBe(3);
    expect(buf.pop()).toBe(2);
    expect(buf.pop()).toBe(1);
    expect(buf.pop()).toBe(0);
    expect(buf.pop()).toBeUndefined();
    expect(buf.toArray()).toEqual([]);
  });

  it("shift: снимает с головы по одному", () => {
    const buf = new RingBufferArray<number>(4);
    [0, 1, 2, 3].forEach((v) => buf.push(v));

    expect(buf.shift()).toBe(0);
    expect(buf.shift()).toBe(1);
    expect(buf.shift()).toBe(2);
    expect(buf.shift()).toBe(3);
    expect(buf.shift()).toBeUndefined();
    expect(buf.toArray()).toEqual([]);
  });

  it("unshift: пишет в голову пустого буфера", () => {
    const buf = new RingBufferArray<number>(4);
    buf.unshift(1);
    buf.unshift(2);
    buf.unshift(3);

    expect(buf.toArray()).toEqual([3, 2, 1]);
  });

  it("unshift: при переполнении затирает самый новый элемент", () => {
    const buf = new RingBufferArray<number>(4);
    [0, 1, 2, 3].forEach((v) => buf.push(v));

    // буфер полный, каждый unshift двигает новое значение в голову
    // и вытесняет хвост
    buf.unshift(10);
    buf.unshift(20);
    buf.unshift(30);
    buf.unshift(40);

    expect(buf.toArray()).toEqual([40, 30, 20, 10]);
  });

  it("смешанные push/pop/shift/unshift сохраняют корректный порядок", () => {
    const buf = new RingBufferArray<number>(4);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.toArray()).toEqual([1, 2, 3]);

    expect(buf.shift()).toBe(1);
    expect(buf.toArray()).toEqual([2, 3]);

    buf.unshift(0);
    expect(buf.toArray()).toEqual([0, 2, 3]);

    buf.push(4);
    expect(buf.toArray()).toEqual([0, 2, 3, 4]);

    expect(buf.pop()).toBe(4);
    expect(buf.toArray()).toEqual([0, 2, 3]);
  });

  it("пустой буфер: pop/shift возвращают undefined", () => {
    const buf = new RingBufferArray<number>(4);
    expect(buf.pop()).toBeUndefined();
    expect(buf.shift()).toBeUndefined();
    expect(buf.toArray()).toEqual([]);
  });

  describe("логическая вместимость: не степень двойки", () => {
    // RingBufferArray может внутри использовать буфер больше запрошенного
    // размера (например, округлять до pow2), но снаружи должен вести себя
    // строго как буфер на запрошенное число элементов. Эти тесты проверяют
    // что логическая capacity === переданный size, а не какой-то
    // округленный внутренний размер

    it("push: вмещает ровно запрошенное число элементов", () => {
      const buf = new RingBufferArray<number>(5);
      for (let i = 0; i < 5; i++) buf.push(i);

      expect(buf.toArray()).toEqual([0, 1, 2, 3, 4]);
      expect(buf.count).toBe(5);
    });

    it("push: 6-й элемент вытесняет первый (capacity = 5, не 8)", () => {
      const buf = new RingBufferArray<number>(5);
      for (let i = 0; i < 5; i++) buf.push(i);
      // проверяем что буфер реально полный на 5 элементах
      expect(buf.isFull).toBe(true);

      buf.push(5);
      // capacity логическая 5, поэтому добавление 6-го вытесняет первый
      expect(buf.toArray()).toEqual([1, 2, 3, 4, 5]);
      expect(buf.count).toBe(5);
    });

    it("push: toArray никогда не превышает capacity после многих push", () => {
      const capacity = 5;
      const buf = new RingBufferArray<number>(capacity);
      for (let i = 0; i < 100; i++) {
        buf.push(i);
        expect(buf.count).toBeLessThanOrEqual(capacity);
        expect(buf.toArray().length).toBeLessThanOrEqual(capacity);
      }

      // после 100 push остаются последние 5 элементов
      expect(buf.toArray()).toEqual([95, 96, 97, 98, 99]);
    });

    it("unshift: 6-й элемент вытесняет хвост (capacity = 5, не 8)", () => {
      const buf = new RingBufferArray<number>(5);
      for (let i = 0; i < 5; i++) buf.push(i);
      expect(buf.isFull).toBe(true);

      buf.unshift(-1);
      expect(buf.toArray()).toEqual([-1, 0, 1, 2, 3]);
      expect(buf.count).toBe(5);
    });

    it("isFull срабатывает ровно на запрошенном размере", () => {
      const buf = new RingBufferArray<number>(5);
      expect(buf.isFull).toBe(false);

      for (let i = 0; i < 4; i++) {
        buf.push(i);
        expect(buf.isFull).toBe(false);
      }
      buf.push(4);
      expect(buf.isFull).toBe(true);
    });

    it("pop после переполнения: снимает в LIFO от последних добавленных", () => {
      const buf = new RingBufferArray<number>(5);
      // добавим 7 элементов, первые 2 должны быть вытеснены
      for (let i = 0; i < 7; i++) buf.push(i);

      expect(buf.pop()).toBe(6);
      expect(buf.pop()).toBe(5);
      expect(buf.pop()).toBe(4);
      expect(buf.pop()).toBe(3);
      expect(buf.pop()).toBe(2);
      expect(buf.pop()).toBeUndefined();
    });

    it("shift после переполнения: снимает в FIFO от оставшихся", () => {
      const buf = new RingBufferArray<number>(5);
      for (let i = 0; i < 7; i++) buf.push(i);

      expect(buf.shift()).toBe(2);
      expect(buf.shift()).toBe(3);
      expect(buf.shift()).toBe(4);
      expect(buf.shift()).toBe(5);
      expect(buf.shift()).toBe(6);
      expect(buf.shift()).toBeUndefined();
    });

    it("смешанные операции сохраняют порядок и логическую capacity", () => {
      const buf = new RingBufferArray<number>(5);
      buf.push(1);
      buf.push(2);
      buf.unshift(0);
      buf.push(3);
      expect(buf.toArray()).toEqual([0, 1, 2, 3]);
      expect(buf.count).toBe(4);

      expect(buf.shift()).toBe(0);
      expect(buf.pop()).toBe(3);
      expect(buf.toArray()).toEqual([1, 2]);
      expect(buf.count).toBe(2);
    });
  });
});
