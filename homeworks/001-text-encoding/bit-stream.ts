/**
 * Низкоуровневая утилка для работы с битовым потоком
 * Упаковывает биты в массив байтов без выравнивания по байтам и читает их обратно
 */
export class BitStream {
  private readonly bytes: Uint8Array;
  private readonly totalBitLength: number;
  private currentBitOffset = 0;

  private constructor(bytes: Uint8Array, totalBitLength: number) {
    this.bytes = bytes;
    this.totalBitLength = totalBitLength;
  }

  static forWrite(totalBitLength: number): BitStream {
    if (!Number.isInteger(totalBitLength) || totalBitLength < 0) {
      throw new Error(`Некорректная длина битового потока: ${totalBitLength}`);
    }

    return new BitStream(
      new Uint8Array(Math.ceil(totalBitLength / 8)),
      totalBitLength,
    );
  }

  static forRead(bytes: Uint8Array, totalBitLength: number): BitStream {
    if (
      !Number.isInteger(totalBitLength) ||
      totalBitLength < 0 ||
      totalBitLength > bytes.length * 8
    ) {
      throw new Error(`Некорректная длина битового потока: ${totalBitLength}`);
    }

    return new BitStream(bytes, totalBitLength);
  }

  hasMoreBits(): boolean {
    return this.currentBitOffset < this.totalBitLength;
  }

  toUint8Array(): Uint8Array {
    return this.bytes;
  }

  writeBits(bits: number, bitLength: number): void {
    if (this.currentBitOffset + bitLength > this.totalBitLength) {
      throw new Error("Битовый поток обрывается посреди записи символа");
    }

    // идем по битам источника от старшего к младшему и записываем каждый бит в нужную позицию массива байтов
    for (
      let bitPositionInSource = bitLength - 1;
      bitPositionInSource >= 0;
      bitPositionInSource--
    ) {
      // сдвигаем число вправо до нужного бита и забираем его через AND с 1
      const currentBit = (bits >> bitPositionInSource) & 1;
      // делим позицию на 8, чтобы понять в каком байте мы сейчас (>> 3 это то же самое что Math.floor(x / 8))
      const byteIndex = this.currentBitOffset >> 3;
      // в байте биты нумеруются слева направо (7,6,5,...,0), а наш счетчик идет слева направо (0,1,2,...,7)
      // поэтому переворачиваем: остаток от деления на 8 превращаем в позицию от левого края
      const bitPositionFromLeft = 7 - (this.currentBitOffset & 7);

      // ставим бит в нужную позицию через сдвиг и вклеиваем в байт через OR
      this.bytes[byteIndex] =
        this.bytes[byteIndex]! | (currentBit << bitPositionFromLeft);
      this.currentBitOffset += 1;
    }
  }

  readBits(bitLength: number): number {
    if (this.currentBitOffset + bitLength > this.totalBitLength) {
      throw new Error("Битовый поток обрывается посреди символа");
    }

    let result = 0;

    // читаем по одному биту и собираем из них число, как если бы дописывали цифры справа
    for (let bitsRead = 0; bitsRead < bitLength; bitsRead++) {
      // в каком байте лежит нужный бит (деление на 8)
      const byteIndex = this.currentBitOffset >> 3;
      // переворачиваем нумерацию: бит 0 внутри байта это на самом деле 7-й (старший)
      const bitPositionFromLeft = 7 - (this.currentBitOffset & 7);
      // сдвигаем байт вправо до нужного бита и забираем его через AND с 1
      const currentBit = (this.bytes[byteIndex]! >> bitPositionFromLeft) & 1;

      // сдвигаем то что уже собрали влево на 1 и приклеиваем новый бит справа
      // например было result=0b10, читаем бит 1: (0b10 << 1) | 1 = 0b100 | 1 = 0b101
      result = (result << 1) | currentBit;
      this.currentBitOffset += 1;
    }

    return result;
  }

  // читает valueBitLength бит из потока и склеивает с уже известным префиксом
  readWithPrefix(
    prefix: number,
    prefixBitLength: number,
    valueBitLength: number,
  ): Readonly<{
    bits: number;
    bitLength: number;
  }> {
    const value = this.readBits(valueBitLength);

    return {
      // сдвигаем prefix влево, освобождая место под value, и вставляем value через OR
      bits: (prefix << valueBitLength) | value,
      bitLength: prefixBitLength + valueBitLength,
    };
  }
}
