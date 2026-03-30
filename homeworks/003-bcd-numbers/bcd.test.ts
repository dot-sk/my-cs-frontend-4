import { describe, expect, test } from "bun:test";
import { MyUnsignedBCD } from "./bcd";

describe("003 BCD numbers", () => {
  test("должен конвертировать десятичное число в BCD", () => {
    expect(new MyUnsignedBCD(123).toString()).toBe("0001_0010_0011");
    expect(new MyUnsignedBCD(45).toString()).toBe("0100_0101");
    expect(new MyUnsignedBCD(0).toString()).toBe("0000");
  });

  test("должен конвертировать BCD в Number", () => {
    expect(new MyUnsignedBCD(123).toNumber()).toBe(123);
    expect(new MyUnsignedBCD(45).toNumber()).toBe(45);
    expect(new MyUnsignedBCD(0).toNumber()).toBe(0);
  });

  test("должен конвертировать BCD в Bigint", () => {
    expect(new MyUnsignedBCD(123).toBigint()).toBe(BigInt(123));
    expect(new MyUnsignedBCD(45).toBigint()).toBe(BigInt(45));
    expect(new MyUnsignedBCD(0).toBigint()).toBe(BigInt(0));
  });

  test("должен выбрасывать ошибку при попытке создать BCD из отрицательного числа", () => {
    expect(() => new MyUnsignedBCD(-1)).toThrow(
      "Input must be a non-negative integer",
    );
  });

  test("должен возвращать число в позиции .at()", () => {
    const bcd = new MyUnsignedBCD(12345);
    expect(bcd.at(0)).toBe(1);
    expect(bcd.at(1)).toBe(2);
    expect(bcd.at(2)).toBe(3);
    expect(bcd.at(3)).toBe(4);
    expect(bcd.at(4)).toBe(5);
    expect(bcd.at(5)).toBeUndefined();
  });
});
