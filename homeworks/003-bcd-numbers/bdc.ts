// BCD8421
export class MyUnsignedBCD {
  private bcd: Uint8Array;

  constructor(input: number) {
    if (typeof input !== "number") {
      throw new Error("Input must be a number");
    }

    if (input < 0) {
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
    return this.bcd.reduce((acc, digit, index) => {
      const position = this.bcd.length - 1 - index; // позиция цифры в десятичном числе
      return acc + digit * Math.pow(10, position);
    }, 0);
  }

  toBigint(): bigint {
    return this.bcd.reduce((acc, digit, index) => {
      const position = this.bcd.length - 1 - index; // позиция цифры в десятичном числе
      return acc + BigInt(digit) * BigInt(10) ** BigInt(position);
    }, BigInt(0));
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

  at(position: number): number | undefined {
    const target = position < 0 ? this.bcd.length + position : position;
    if (target < 0 || target >= this.bcd.length) {
      return undefined;
    }

    return this.bcd[target];
  }
}
