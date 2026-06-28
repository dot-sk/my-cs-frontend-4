import { describe, expect, it } from "bun:test";
import { MemoryManager } from "./011-memory-manager";

const data = (...values: number[]) => new Uint8Array(values);
const values = (bytes: Uint8Array) => Array.from(bytes);

describe("MemoryManager", () => {
  describe("stack", () => {
    it("кладет данные подряд с начала общей памяти", () => {
      const mem = new MemoryManager(16, { stackByteSize: 8 });

      const first = mem.push(data(1, 2, 3));
      const second = mem.push(data(4, 5));

      expect(first.region).toBe("stack");
      expect(first.offset).toBe(0);
      expect(first.byteLength).toBe(3);
      expect(second.offset).toBe(3);
      expect(values(first.deref())).toEqual([1, 2, 3]);
      expect(values(second.deref())).toEqual([4, 5]);
    });

    it("перезаписывает блок и зануляет остаток, если новые данные короче", () => {
      const mem = new MemoryManager(16, { stackByteSize: 8 });
      const pointer = mem.push(data(1, 2, 3, 4));

      pointer.write(data(9, 8));

      expect(values(pointer.deref())).toEqual([9, 8, 0, 0]);
    });

    it("не дает записать больше выделенного блока", () => {
      const mem = new MemoryManager(16, { stackByteSize: 8 });
      const pointer = mem.push(data(1, 2));

      expect(() => pointer.write(data(3, 4, 5))).toThrow();
    });

    it("pop освобождает только последний stack handle", () => {
      const mem = new MemoryManager(16, { stackByteSize: 8 });

      const first = mem.push(data(1, 2));
      const second = mem.push(data(3, 4));

      mem.pop();

      expect(() => second.deref()).toThrow();
      expect(values(first.deref())).toEqual([1, 2]);

      const third = mem.push(data(5));

      expect(third.offset).toBe(2);
      expect(values(third.deref())).toEqual([5]);
    });

    it("последовательные pop освобождают stack блоки в обратном порядке", () => {
      const mem = new MemoryManager(16, { stackByteSize: 8 });

      const first = mem.push(data(1, 2));
      const second = mem.push(data(3, 4));

      mem.pop();

      expect(() => second.deref()).toThrow();
      expect(values(first.deref())).toEqual([1, 2]);

      mem.pop();

      expect(() => first.deref()).toThrow();

      const third = mem.push(data(5));

      expect(third.offset).toBe(0);
    });

    it("не дает освободить stack handle через free", () => {
      const mem = new MemoryManager(16, { stackByteSize: 8 });
      const pointer = mem.push(data(1));

      expect(() => pointer.free()).toThrow();
    });

    it("проверяет границу stack региона", () => {
      const mem = new MemoryManager(16, { stackByteSize: 4 });

      mem.push(data(1, 2, 3));

      expect(() => mem.push(data(4, 5))).toThrow();
    });
  });

  describe("heap", () => {
    it("выделяет блоки с конца heap региона", () => {
      const mem = new MemoryManager(32, { stackByteSize: 8 });

      const first = mem.alloc(4);
      const second = mem.alloc(6);

      expect(first.region).toBe("heap");
      expect(first.offset).toBe(28);
      expect(second.offset).toBe(22);
      expect(first.byteLength).toBe(4);
      expect(second.byteLength).toBe(6);
    });

    it("пишет и читает heap данные через handle", () => {
      const mem = new MemoryManager(32, { stackByteSize: 8 });
      const pointer = mem.alloc(4);

      pointer.write(data(7, 8));

      expect(values(pointer.deref())).toEqual([7, 8, 0, 0]);
    });

    it("free освобождает heap handle и ловит повторный доступ", () => {
      const mem = new MemoryManager(32, { stackByteSize: 8 });
      const pointer = mem.alloc(4);

      pointer.write(data(1, 2, 3, 4));
      pointer.free();

      expect(() => pointer.deref()).toThrow();
      expect(() => pointer.free()).toThrow();
    });

    it("переиспользует освобожденный heap блок", () => {
      const mem = new MemoryManager(32, { stackByteSize: 8 });

      const first = mem.alloc(4);
      const offset = first.offset;

      first.free();

      const second = mem.alloc(4);

      expect(second.offset).toBe(offset);
    });

    it("сливает соседние свободные heap блоки", () => {
      const mem = new MemoryManager(32, { stackByteSize: 8 });

      const first = mem.alloc(4);
      const second = mem.alloc(4);
      const third = mem.alloc(4);

      second.free();
      first.free();
      third.free();

      const merged = mem.alloc(12);

      expect(merged.byteLength).toBe(12);
      expect(merged.offset).toBe(20);
    });

    it("проверяет границу heap региона", () => {
      const mem = new MemoryManager(16, { stackByteSize: 8 });

      mem.alloc(6);

      expect(() => mem.alloc(3)).toThrow();
    });
  });
});
