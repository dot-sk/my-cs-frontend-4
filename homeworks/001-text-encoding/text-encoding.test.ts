import { describe, expect, test } from "bun:test";

import {
  decodeSymbol,
  decodeText,
  encodeSymbol,
  encodeText,
} from "./text-encoding";

describe("кодирование текста", () => {
  test("дает короткие коды самым частым символам", () => {
    expect(encodeSymbol(" ")).toEqual({ bits: 0b00_00, bitLength: 4 });
    expect(encodeSymbol("о")).toEqual({ bits: 0b00_01, bitLength: 4 });
    expect(encodeSymbol("и")).toEqual({ bits: 0b01_000, bitLength: 5 });
    expect(encodeSymbol("м")).toEqual({ bits: 0b10_0000, bitLength: 6 });
    expect(encodeSymbol("А")).toEqual({ bits: 0b11_0000000, bitLength: 9 });
  });

  test("декодирует коды обратно в символы", () => {
    expect(decodeSymbol(0b00_00, 4)).toBe(" ");
    expect(decodeSymbol(0b00_01, 4)).toBe("о");
    expect(decodeSymbol(0b01_000, 5)).toBe("и");
    expect(decodeSymbol(0b10_0000, 6)).toBe("м");
    expect(decodeSymbol(0b11_0000000, 9)).toBe("А");
  });

  test("пакует биты подряд без выравнивания по символам", () => {
    const encoded = encodeText(" оА");

    expect(Array.from(encoded.bytes)).toEqual([0b00000001, 0b11000000, 0b00000000]);
    expect(encoded.bitLength).toBe(17);
    expect(decodeText(encoded.bytes, encoded.bitLength)).toBe(" оА");
  });

  test("преобразует русский текст в обе стороны и выигрывает по битам на частых символах", () => {
    const source = "это не тест, а текст про море";
    const encoded = encodeText(source);

    expect(encoded.bitLength).toBeLessThan(source.length * 8);
    expect(decodeText(encoded.bytes, encoded.bitLength)).toBe(source);
  });

  test("кидает ошибку на неподдерживаемых символах и некорректных данных", () => {
    expect(() => encodeSymbol("A")).toThrow("не поддерживается");
    expect(() => decodeSymbol(0b10_000, 5)).toThrow("не соответствует ни одному формату");
    expect(() => decodeText(new Uint8Array([0b01000000]), 3)).toThrow("обрывается посреди символа");
  });
});