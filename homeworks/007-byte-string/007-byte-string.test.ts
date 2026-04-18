import { describe, expect, it } from "bun:test";
import { encodeStrings, decodeStrings, StringBuffer } from "./007-byte-string";

describe("007-byte-string", () => {
  it("кодирует массив строк", () => {
    const strings = ["hello", "мир", ""];

    const buffer = encodeStrings(strings);

    const stringBuffer = StringBuffer.fromBuffer(buffer);

    expect(stringBuffer.at(0)).toBe("hello");
    expect(stringBuffer.at(1)).toBe("мир");
    expect(stringBuffer.at(-1)).toBe("");
  });

  it("декодирует байты в массив строк", () => {
    const strings = ["hello", "мир", ""];

    const buffer = encodeStrings(strings);

    expect(decodeStrings(buffer)).toEqual(strings);
  });

  it("подстраивает размер буфера под данные", () => {
    const big = new Array(100).fill("x".repeat(10));
    encodeStrings(big);
  });

  it("корректно обрабатывает пустой массив", () => {
    const stringBuffer = StringBuffer.fromData([]);
    expect(stringBuffer.at(0)).toBe("");
  });
});
