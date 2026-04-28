import { describe, it, expect } from "bun:test";
import { Vector } from "./009-vector";
import { RGBA } from "./shared/rgba";

describe("009-vector", () => {
  describe("конструктор", () => {
    it("создает свой буфер если внешний не передан", () => {
      const pixels = new Vector(4, RGBA);

      expect(pixels.buffer.byteLength).toBe(4 * 4);
      expect(pixels.capacity).toBe(4);
      expect(pixels.BYTES_PER_ELEMENT).toBe(4);
    });

    it("стартует с пустой длиной", () => {
      const pixels = new Vector(4, RGBA);

      expect(pixels.length).toBe(0);
    });

    it("шарит буфер с переданным Uint8ClampedArray", () => {
      const data = new Uint8ClampedArray(4 * 4);

      const pixels = new Vector(4, RGBA, data);

      expect(pixels.buffer).toBe(data.buffer);
      expect(pixels.capacity).toBe(4);
    });

    it("принимает ArrayBuffer как источник", () => {
      const buffer = new ArrayBuffer(4 * 4);

      const pixels = new Vector(4, RGBA, buffer);

      expect(pixels.buffer).toBe(buffer);
    });

    it("бросает RangeError если переданный буфер мал", () => {
      const tiny = new ArrayBuffer(8);

      expect(() => new Vector(4, RGBA, tiny)).toThrow(RangeError);
    });
  });

  describe("fill", () => {
    it("заливает все слоты коротким hex #FFF", () => {
      const pixels = new Vector(3, RGBA);

      pixels.fill("#FFF");

      expect(pixels.get(0)).toEqual([255, 255, 255, 255]);
      expect(pixels.get(1)).toEqual([255, 255, 255, 255]);
      expect(pixels.get(2)).toEqual([255, 255, 255, 255]);
    });

    it("заливает все слоты кортежем RGBA", () => {
      const pixels = new Vector(2, RGBA);

      pixels.fill([10, 20, 30, 40]);

      expect(pixels.get(0)).toEqual([10, 20, 30, 40]);
      expect(pixels.get(1)).toEqual([10, 20, 30, 40]);
    });
  });

  describe("set", () => {
    it("принимает кортеж RGBA", () => {
      const pixels = new Vector(20, RGBA);

      pixels.set(10, [255, 0, 0, 255]);

      expect(pixels.get(10)).toEqual([255, 0, 0, 255]);
    });

    it("принимает 6-значный hex и подставляет alpha 255", () => {
      const pixels = new Vector(20, RGBA);

      pixels.set(10, "#EFEFEF");

      expect(pixels.get(10)).toEqual([239, 239, 239, 255]);
    });
  });

  describe("push", () => {
    it("добавляет элемент в конец и увеличивает length", () => {
      const pixels = new Vector(4, RGBA);

      pixels.push([255, 0, 0, 255]);

      expect(pixels.length).toBe(1);
      expect(pixels.get(0)).toEqual([255, 0, 0, 255]);
    });

    it("принимает hex", () => {
      const pixels = new Vector(4, RGBA);

      pixels.push("#EFEFEF");

      expect(pixels.get(0)).toEqual([239, 239, 239, 255]);
    });

    it("расширяет capacity если места не хватает", () => {
      const pixels = new Vector(2, RGBA);

      pixels.push([1, 1, 1, 1]);
      pixels.push([2, 2, 2, 2]);
      pixels.push([3, 3, 3, 3]);

      expect(pixels.length).toBe(3);
      expect(pixels.capacity).toBeGreaterThanOrEqual(3);
      expect(pixels.get(2)).toEqual([3, 3, 3, 3]);
    });

    it("сохраняет ранее добавленные элементы при расширении", () => {
      const pixels = new Vector(2, RGBA);
      pixels.push([1, 2, 3, 4]);
      pixels.push([5, 6, 7, 8]);

      pixels.push([9, 10, 11, 12]);

      expect(pixels.get(0)).toEqual([1, 2, 3, 4]);
      expect(pixels.get(1)).toEqual([5, 6, 7, 8]);
      expect(pixels.get(2)).toEqual([9, 10, 11, 12]);
    });
  });

  describe("pop", () => {
    it("возвращает undefined для пустого вектора", () => {
      const pixels = new Vector(4, RGBA);

      expect(pixels.pop()).toBeUndefined();
    });

    it("возвращает последний элемент и уменьшает length", () => {
      const pixels = new Vector(4, RGBA);
      pixels.push([10, 20, 30, 40]);
      pixels.push([50, 60, 70, 80]);

      const value = pixels.pop();

      expect(value).toEqual([50, 60, 70, 80]);
      expect(pixels.length).toBe(1);
    });

    it("не меняет capacity (шринк только через shrinkToFit)", () => {
      const pixels = new Vector(8, RGBA);
      pixels.push([1, 1, 1, 1]);
      const capacityBefore = pixels.capacity;
      const bufferBefore = pixels.buffer;

      pixels.pop();

      expect(pixels.length).toBe(0);
      expect(pixels.capacity).toBe(capacityBefore);
      expect(pixels.buffer).toBe(bufferBefore);
    });
  });

  describe("shrinkToFit", () => {
    it("ужимает capacity до фактической длины", () => {
      const pixels = new Vector(8, RGBA);
      pixels.push([1, 1, 1, 1]);
      pixels.push([2, 2, 2, 2]);

      pixels.shrinkToFit();

      expect(pixels.capacity).toBe(2);
      expect(pixels.length).toBe(2);
      expect(pixels.get(1)).toEqual([2, 2, 2, 2]);
    });

    it("ничего не делает когда length равен capacity", () => {
      const pixels = new Vector(2, RGBA);
      pixels.push([1, 1, 1, 1]);
      pixels.push([2, 2, 2, 2]);
      const bufferBefore = pixels.buffer;

      pixels.shrinkToFit();

      expect(pixels.buffer).toBe(bufferBefore);
      expect(pixels.capacity).toBe(2);
    });
  });

  describe("reserve", () => {
    it("гарантирует место для дополнительных элементов", () => {
      const pixels = new Vector(2, RGBA);
      pixels.push([1, 1, 1, 1]);

      pixels.reserve(10);

      expect(pixels.capacity).toBeGreaterThanOrEqual(pixels.length + 10);
    });

    it("амортизирует рост: capacity удваивается даже при reserve(1)", () => {
      const pixels = new Vector(8, RGBA);
      for (let i = 0; i < 8; i++) pixels.push([i, 0, 0, 255]);

      pixels.reserve(1);

      expect(pixels.capacity).toBeGreaterThanOrEqual(16);
    });

    it("не делает реаллокацию если места хватает", () => {
      const pixels = new Vector(20, RGBA);
      const bufferBefore = pixels.buffer;
      const capacityBefore = pixels.capacity;

      pixels.reserve(5);

      expect(pixels.buffer).toBe(bufferBefore);
      expect(pixels.capacity).toBe(capacityBefore);
    });
  });

  describe("view", () => {
    it("читает компоненты элемента по именам полей", () => {
      const pixels = new Vector(4, RGBA);
      pixels.set(2, [239, 100, 50, 200]);

      const ref = pixels.view(2);

      expect(ref.red).toBe(239);
      expect(ref.green).toBe(100);
      expect(ref.blue).toBe(50);
      expect(ref.alpha).toBe(200);
    });

    it("пишет в буфер вектора через присваивание полю ref", () => {
      const pixels = new Vector(4, RGBA);
      pixels.set(2, [0, 0, 0, 255]);

      pixels.view(2).red = 255;

      expect(pixels.get(2)).toEqual([255, 0, 0, 255]);
    });

    it("проксирует правки во внешний Uint8ClampedArray", () => {
      const data = new Uint8ClampedArray(4 * 4);
      const pixels = new Vector(4, RGBA, data);
      pixels.fill("#000");

      pixels.view(0).red = 200;

      expect(data[0]).toBe(200);
      expect(data[1]).toBe(0);
      expect(data[2]).toBe(0);
      expect(data[3]).toBe(255);
    });
  });

  describe("shift", () => {
    it("возвращает undefined для пустого вектора", () => {
      const pixels = new Vector(4, RGBA);

      expect(pixels.shift()).toBeUndefined();
    });

    it("возвращает первый элемент и сдвигает остальные влево", () => {
      const pixels = new Vector(4, RGBA);
      pixels.push([10, 0, 0, 255]);
      pixels.push([20, 0, 0, 255]);
      pixels.push([30, 0, 0, 255]);

      const first = pixels.shift();

      expect(first).toEqual([10, 0, 0, 255]);
      expect(pixels.length).toBe(2);
      expect(pixels.get(0)).toEqual([20, 0, 0, 255]);
      expect(pixels.get(1)).toEqual([30, 0, 0, 255]);
    });

    it("не меняет capacity (шринк только через shrinkToFit)", () => {
      const pixels = new Vector(8, RGBA);
      pixels.push([1, 1, 1, 1]);
      const capacityBefore = pixels.capacity;
      const bufferBefore = pixels.buffer;

      pixels.shift();

      expect(pixels.length).toBe(0);
      expect(pixels.capacity).toBe(capacityBefore);
      expect(pixels.buffer).toBe(bufferBefore);
    });
  });

  describe("unshift", () => {
    it("вставляет элемент в начало пустого вектора", () => {
      const pixels = new Vector(4, RGBA);

      pixels.unshift([10, 20, 30, 255]);

      expect(pixels.length).toBe(1);
      expect(pixels.get(0)).toEqual([10, 20, 30, 255]);
    });

    it("сдвигает существующие элементы вправо", () => {
      const pixels = new Vector(4, RGBA);
      pixels.push([20, 0, 0, 255]);
      pixels.push([30, 0, 0, 255]);

      pixels.unshift([10, 0, 0, 255]);

      expect(pixels.length).toBe(3);
      expect(pixels.get(0)).toEqual([10, 0, 0, 255]);
      expect(pixels.get(1)).toEqual([20, 0, 0, 255]);
      expect(pixels.get(2)).toEqual([30, 0, 0, 255]);
    });

    it("принимает hex", () => {
      const pixels = new Vector(2, RGBA);
      pixels.push([0, 0, 0, 255]);

      pixels.unshift("#EFEFEF");

      expect(pixels.get(0)).toEqual([239, 239, 239, 255]);
      expect(pixels.get(1)).toEqual([0, 0, 0, 255]);
    });

    it("расширяет capacity если места не хватает", () => {
      const pixels = new Vector(2, RGBA);
      pixels.push([10, 0, 0, 255]);
      pixels.push([20, 0, 0, 255]);

      pixels.unshift([0, 0, 0, 255]);

      expect(pixels.length).toBe(3);
      expect(pixels.capacity).toBeGreaterThanOrEqual(3);
      expect(pixels.get(0)).toEqual([0, 0, 0, 255]);
      expect(pixels.get(1)).toEqual([10, 0, 0, 255]);
      expect(pixels.get(2)).toEqual([20, 0, 0, 255]);
    });
  });

  describe("сценарий из примера", () => {
    it("проходит fill → set → push → pop → shrinkToFit → reserve → view", () => {
      const pixels = new Vector(20, RGBA);

      pixels.fill("#FFF");
      expect(pixels.get(0)).toEqual([255, 255, 255, 255]);

      pixels.set(10, [255, 0, 0, 255]);
      expect(pixels.get(10)).toEqual([255, 0, 0, 255]);

      pixels.set(10, "#EFEFEF");
      expect(pixels.get(10)).toEqual([239, 239, 239, 255]);

      pixels.push([255, 0, 0, 255]);
      pixels.push("#EFEFEF");
      expect(pixels.pop()).toEqual([239, 239, 239, 255]);

      pixels.shrinkToFit();
      expect(pixels.capacity).toBe(pixels.length);

      const lengthBefore = pixels.length;
      pixels.reserve(10);
      expect(pixels.capacity).toBeGreaterThanOrEqual(lengthBefore + 10);

      pixels.set(0, [239, 100, 50, 200]);
      expect(pixels.view(0).red).toBe(239);

      pixels.view(0).red = 255;
      expect(pixels.get(0)).toEqual([255, 100, 50, 200]);
    });
  });
});
