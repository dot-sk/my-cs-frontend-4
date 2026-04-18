import { describe, expect, it } from "bun:test";
import {
  encodeStrings,
  decodeStrings,
  StringBufferRef,
} from "./007-byte-string-ref";

describe("007-byte-string-ref", () => {
  it("кодирует массив строк", () => {
    const strings = ["hello", "мир", ""];

    const buffer = encodeStrings(strings);

    const stringBuffer = StringBufferRef.fromBuffer(buffer);

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
    const stringBuffer = StringBufferRef.fromData([]);
    expect(stringBuffer.at(0)).toBe("");
  });

  it("обновляет строку через set", () => {
    const sb = StringBufferRef.fromData(["hello", "мир", ""]);

    sb.set(0, "Привет, ");
    expect(sb.at(0)).toBe("Привет, ");

    sb.set(-1, "!");
    expect(sb.toArray()).toEqual(["Привет, ", "мир", "!"]);
  });

  it("set переживает roundtrip через буфер", () => {
    const sb = StringBufferRef.fromData(["a", "b", "c"]);
    sb.set(1, "новое значение");

    const sb2 = StringBufferRef.fromBuffer(sb.buffer);
    expect(sb2.toArray()).toEqual(["a", "новое значение", "c"]);
  });
});
