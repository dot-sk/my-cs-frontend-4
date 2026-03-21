import { describe, expect, test } from "bun:test";

import {
  decodeSymbol,
  decodeText,
  encodeSymbol,
  encodeText,
} from "./1-alphabet-encoding";

describe("кодирование текста", () => {
  test("преобразует символы в байты", () => {
    expect(encodeSymbol("а")).toBe(0b00_000000);
    expect(encodeSymbol("я")).toBe(0b00_100000);
    expect(encodeSymbol("А")).toBe(0b01_000000);
    expect(encodeSymbol("Я")).toBe(0b01_100000);
    expect(encodeSymbol("0")).toBe(0b10_000000);
    expect(encodeSymbol(" ")).toBe(0b11_011010);
  });

  test("декодирует байты обратно в символы", () => {
    expect(decodeSymbol(0b00_000000)).toBe("а");
    expect(decodeSymbol(0b01_000000)).toBe("А");
    expect(decodeSymbol(0b10_000000)).toBe("0");
    expect(decodeSymbol(0b11_011100)).toBe("\n");
  });

  test("преобразует текст в обе стороны", () => {
    const source = "Привет, мир!\nЭто тест: 0123456789";
    const encoded = encodeText(source);

    expect(Array.from(encoded)).toEqual([
      0b01_010000,
      0b00_010001,
      0b00_001001,
      0b00_000010,
      0b00_000101,
      0b00_010011,
      0b11_000001,
      0b11_011010,
      0b00_001101,
      0b00_001001,
      0b00_010001,
      0b11_000010,
      0b11_011100,
      0b01_011110,
      0b00_010011,
      0b00_001111,
      0b11_011010,
      0b00_010011,
      0b00_000101,
      0b00_010010,
      0b00_010011,
      0b11_000100,
      0b11_011010,
      0b10_000000,
      0b10_000001,
      0b10_000010,
      0b10_000011,
      0b10_000100,
      0b10_000101,
      0b10_000110,
      0b10_000111,
      0b10_001000,
      0b10_001001,
    ]);
    expect(decodeText(encoded)).toBe(source);
  });

  test("кидает ошибку, когда символ не поддерживается или байт выходит за пределы страницы", () => {
    expect(() => encodeSymbol("A")).toThrow("не поддерживается");
    expect(() => decodeSymbol(0b11_111111)).toThrow("выходит за пределы страницы");
  });
});