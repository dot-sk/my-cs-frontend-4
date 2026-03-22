import { describe, expect, test } from "bun:test";

import { VariableTextEncoder } from "./text-encoding";

const encoder = new VariableTextEncoder();

describe("001-text-encoding: VariableTextEncoder", () => {
  test("дает короткие коды самым частым символам", () => {
    expect(encoder.encode(" ").bitLength).toBe(4);
    expect(encoder.encode("о").bitLength).toBe(4);
    expect(encoder.encode("и").bitLength).toBe(5);
    expect(encoder.encode("м").bitLength).toBe(6);
    expect(encoder.encode("А").bitLength).toBe(9);
  });

  test("пакует биты подряд без выравнивания по символам", () => {
    const encoded = encoder.encode(" оА");

    expect(Array.from(encoded.bytes)).toEqual([
      0b00000001, 0b11000000, 0b00000000,
    ]);
    expect(encoded.bitLength).toBe(17);
    expect(encoder.decode(encoded)).toBe(" оА");
  });

  test("преобразует русский текст в обе стороны и выигрывает по битам на частых символах", () => {
    const source = "это не тест, а текст про море";
    const encoded = encoder.encode(source);

    expect(encoded.bitLength).toBeLessThan(source.length * 8);
    expect(encoder.decode(encoded)).toBe(source);
  });

  test("кидает ошибку на неподдерживаемых символах", () => {
    expect(() => encoder.encode("A")).toThrow("не поддерживается");
  });
});
