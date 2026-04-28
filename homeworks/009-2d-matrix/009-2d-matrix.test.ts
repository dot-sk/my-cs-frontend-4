import { describe, it, expect } from "bun:test";
import { Matrix2D } from "./009-2d-matrix";
import { RGBA } from "./shared/rgba";

describe("009-2d-matrix", () => {
  describe("конструктор", () => {
    it("шарит буфер с переданным Uint8ClampedArray", () => {
      const data = new Uint8ClampedArray(2 * 2 * 4);

      const image = new Matrix2D(2, 2, RGBA, data);

      expect(image.width).toBe(2);
      expect(image.height).toBe(2);
      expect(image.BYTES_PER_ELEMENT).toBe(4);
      expect(image.buffer).toBe(data.buffer);
    });

    it("создает свой буфер если внешний не передан", () => {
      const image = new Matrix2D(3, 3, RGBA);

      expect(image.buffer.byteLength).toBe(3 * 3 * 4);
    });

    it("бросает RangeError если переданный буфер мал", () => {
      const tiny = new ArrayBuffer(10);

      expect(() => new Matrix2D(2, 2, RGBA, tiny)).toThrow(RangeError);
    });
  });

  describe("fill", () => {
    it("заливает все пиксели коротким hex #FFF", () => {
      const image = new Matrix2D(2, 2, RGBA);

      image.fill("#FFF");

      expect(image.get(0, 0)).toEqual([255, 255, 255, 255]);
      expect(image.get(1, 0)).toEqual([255, 255, 255, 255]);
      expect(image.get(0, 1)).toEqual([255, 255, 255, 255]);
      expect(image.get(1, 1)).toEqual([255, 255, 255, 255]);
    });
  });

  describe("set", () => {
    it("принимает кортеж RGBA", () => {
      const image = new Matrix2D(3, 3, RGBA);

      image.set(1, 1, [255, 0, 0, 255]);

      expect(image.get(1, 1)).toEqual([255, 0, 0, 255]);
    });

    it("принимает 6-значный hex и подставляет alpha 255", () => {
      const image = new Matrix2D(3, 3, RGBA);

      image.set(1, 1, "#EFEFEF");

      expect(image.get(1, 1)).toEqual([239, 239, 239, 255]);
    });
  });

  describe("view", () => {
    it("читает компоненты пикселя по именам полей", () => {
      const image = new Matrix2D(3, 3, RGBA);
      image.set(1, 1, [239, 100, 50, 200]);

      const ref = image.view(1, 1);

      expect(ref.red).toBe(239);
      expect(ref.green).toBe(100);
      expect(ref.blue).toBe(50);
      expect(ref.alpha).toBe(200);
    });

    it("пишет в буфер матрицы через присваивание полю ref", () => {
      const image = new Matrix2D(3, 3, RGBA);
      image.set(1, 1, [0, 0, 0, 255]);

      image.view(1, 1).red = 255;

      expect(image.get(1, 1)).toEqual([255, 0, 0, 255]);
    });

    it("проксирует правки во внешний Uint8ClampedArray", () => {
      const data = new Uint8ClampedArray(2 * 2 * 4);
      const image = new Matrix2D(2, 2, RGBA, data);
      image.fill("#000");

      image.view(0, 0).red = 200;

      expect(data[0]).toBe(200);
      expect(data[1]).toBe(0);
      expect(data[2]).toBe(0);
      expect(data[3]).toBe(255);
    });
  });

  describe("индексация", () => {
    it("раскладывает (x, y) row-major: y * width + x", () => {
      const image = new Matrix2D(20, 20, RGBA);

      image.set(1, 10, [42, 0, 0, 0]);

      const bytes = new Uint8Array(image.buffer);
      const offset = (10 * 20 + 1) * 4;
      expect(bytes[offset]).toBe(42);
    });
  });

  describe("сценарий из примера", () => {
    it("проходит fill → get → set RGBA → set hex → view ref", () => {
      const data = new Uint8ClampedArray(20 * 20 * 4);
      const image = new Matrix2D(20, 20, RGBA, data);

      image.fill("#FFF");
      expect(image.get(1, 10)).toEqual([255, 255, 255, 255]);

      image.set(1, 10, [255, 0, 0, 255]);
      expect(image.get(1, 10)).toEqual([255, 0, 0, 255]);

      image.set(1, 10, "#EFEFEF");
      expect(image.view(1, 10).red).toBe(239);

      image.view(1, 10).red = 255;
      expect(image.get(1, 10)).toEqual([255, 239, 239, 255]);
    });
  });
});
