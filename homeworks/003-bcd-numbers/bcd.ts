// BCD8421

const FIRST_DIGIT_MASK = 0b1111;
const SECOND_DIGIT_MASK = 0b11110000;
export class MyUnsignedBCD {
  private bcd: Uint8Array;

  constructor(input: number) {
    if (
      typeof input !== "number" ||
      !Number.isFinite(input) ||
      !Number.isInteger(input) ||
      input < 0
    ) {
      throw new Error("Input must be a non-negative integer");
    }

    this.bcd = MyUnsignedBCD.decimalToBCD(input);
  }

  private static decimalToBCD(input: number): Uint8Array {
    if (input === 0) {
      return new Uint8Array([0]);
    }

    const digits: number[] = [];
    while (input > 0) {
      digits.push(input % 10);
      input = Math.floor(input / 10);
    }

    const length = digits.length;
    // пакуем по 2 цифры в байт, поэтому Uint8Array в 2 раза короче
    const bcd = new Uint8Array(Math.ceil(length / 2));

    for (let i = 0; i < length; i++) {
      const digit = digits[length - 1 - i];
      const byteIndex = (i / 2) | 0;

      if (i % 2 === 0) {
        // первое число ложится в первые 4 байта
        bcd[byteIndex] |= digit;
      } else {
        // второе во вторые
        bcd[byteIndex] |= digit << 4;
      }
    }

    return bcd;
  }

  toNumber(): number {
    let acc = 0;
    for (const digit of this.bcd) {
      acc = acc * 10 + (digit & FIRST_DIGIT_MASK);
      if (digit & SECOND_DIGIT_MASK) {
        acc = acc * 10 + (digit >>> 4);
      }
    }
    return acc;
  }

  toBigint(): bigint {
    let acc = 0n;
    for (const digit of this.bcd) {
      acc = acc * 10n + BigInt(digit & FIRST_DIGIT_MASK);
      if (digit & SECOND_DIGIT_MASK) {
        acc = acc * 10n + BigInt(digit >>> 4);
      }
    }
    return acc;
  }

  toString(): string {
    let result = "";

    for (const digit of this.bcd) {
      if (result !== "") result += "_";
      result += (digit & FIRST_DIGIT_MASK).toString(2).padStart(4, "0");

      if (digit & SECOND_DIGIT_MASK) {
        result += "_";
        result += (digit >>> 4).toString(2).padStart(4, "0");
      }
    }

    return result;
  }

  at(position: number): number {
    const target = position < 0 ? this.bcd.length * 2 + position - 1 : position;
    const targetByte = (target / 2) | 0;
    const targetDigitInByte = target % 2;

    if (targetByte < 0 || targetByte >= this.bcd.length) {
      return 0;
    }

    if (targetDigitInByte === 0) {
      return this.bcd[targetByte] & FIRST_DIGIT_MASK;
    }

    return this.bcd[targetByte] >>> (targetDigitInByte * 4);
  }
}
