import { describe, expect, test } from "bun:test";
import { cyclicLeftShift, cyclicRightShift } from "./bit-ops";

describe("004 Bit operations", () => {
  test("cyclicLeftShift должен сдвигать биты влево циклически", () => {
    expect(cyclicLeftShift(0b10000000_00000000_00000000_00000001, 1)).toBe(
      0b00000000_00000000_00000000_00000011,
    );
    expect(cyclicLeftShift(0b10000000_00000000_00000000_00000001, 2)).toBe(
      0b00000000_00000000_00000000_00000110,
    );
    expect(cyclicLeftShift(0b00000000_00000000_00000000_00000011, 2)).toBe(
      0b00000000_00000000_00000000_00001100,
    );
  });

  test("cyclicRightShift должен сдвигать биты вправо циклически", () => {
    expect(cyclicRightShift(0b10000000_00000000_00000000_00000001, 1)).toBe(
      0b11000000_00000000_00000000_00000000,
    );
    expect(cyclicRightShift(0b11000000_00000000_00000000_00000000, 2)).toBe(
      0b00110000_00000000_00000000_00000000,
    );
  });

  test("Сдвиг на 0 НЕ должен изменять число", () => {
    expect(cyclicLeftShift(0b1011, 0)).toBe(0b1011);
    expect(cyclicRightShift(0b1011, 0)).toBe(0b1011);
  });

  test("Сдвиг влево на n/2 и сдвиг вправо на n/2 дают одинаковый результат (при чётном n)", () => {
    expect(cyclicLeftShift(0b1011, 16)).toBe(cyclicRightShift(0b1011, 16));
  });

  test("Сдвиг на -n работает как сдвиг в другую строну на n", () => {
    expect(cyclicLeftShift(0b1011, -1)).toBe(cyclicRightShift(0b1011, 1));
    expect(cyclicRightShift(0b1011, -1)).toBe(cyclicLeftShift(0b1011, 1));
  });

  test("Странные сдвиги должны работать", () => {
    expect(cyclicLeftShift(0b1011, 32)).toBe(0b1011);
    expect(cyclicRightShift(0b1011, 32)).toBe(0b1011);
    expect(cyclicLeftShift(0b1011, 33)).toBe(cyclicLeftShift(0b1011, 1));

    expect(cyclicLeftShift(0b1011, -33)).toBe(cyclicRightShift(0b1011, 1));
    expect(cyclicRightShift(0b1011, -3.3)).toBe(cyclicLeftShift(0b1011, 3));
  });
});
