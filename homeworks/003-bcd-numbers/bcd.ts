// BCD8421
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

    // какую целую степень 10 нужно взять, чтобы получить число – это и будет количество разрядов
    const length = Math.floor(Math.log10(input)) + 1;
    const bcd = new Uint8Array(length);

    while (input > 0) {
      // берем последнюю цифру
      const digit = input % 10;
      // аналогичным образом тут получает индекс в массиве по количеству разрядом в оставшемся числе
      const index = Math.floor(Math.log10(input));
      bcd[index] = digit;
      input = Math.floor(input / 10);
    }

    return bcd;
  }

  toNumber(): number {
    let acc = 0;
    for (const digit of this.bcd) {
      acc = acc * 10 + digit;
    }
    return acc;
  }

  toBigint(): bigint {
    let acc = 0n;
    for (const digit of this.bcd) {
      acc = acc * 10n + BigInt(digit);
    }
    return acc;
  }

  toString(): string {
    return this.bcd.reduce((acc, digit, index) => {
      return (
        acc +
        digit.toString(2).padStart(4, "0") +
        (this.bcd[index + 1] !== undefined ? "_" : "")
      );
    }, "");
  }

  at(position: number): number {
    const target = position < 0 ? this.bcd.length + position : position;
    if (target < 0 || target >= this.bcd.length) {
      return 0;
    }

    return this.bcd[target];
  }
}
