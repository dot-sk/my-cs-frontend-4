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

    return new BitStream(new Uint8Array(Math.ceil(totalBitLength / 8)), totalBitLength);
  }

  static forRead(bytes: Uint8Array, totalBitLength: number): BitStream {
    if (!Number.isInteger(totalBitLength) || totalBitLength < 0 || totalBitLength > bytes.length * 8) {
      throw new Error(`Некорректная длина битового потока: ${totalBitLength}`);
    }

    return new BitStream(bytes, totalBitLength);
  }

  /**
   * Делает маску вида 0b111...111 нужной длины
   * Она нужна, чтобы потом оставить только младшие биты
   *
   * Это как "1".repeat(bitLength)
   */
  static createIndexMask(bitLength: number): number {
    // сдвигаем единицу влево на bitLength позиций, получаем 0b100...0
    // вычитаем 1 и получаем 0b111...1 нужной длины
    // например для bitLength=3: (1 << 3) - 1 = 0b1000 - 1 = 0b111
    return (1 << bitLength) - 1;
  }

  /**
   * Склеивает две части в одно число
   * - prefix лежит в старших битах
   * - value лежит в младших битах
   */
  static packPrefixAndValue(prefix: number, value: number, valueBitLength: number): number {
    // сдвигаем prefix влево, освобождая место под value, и вставляем value в освободившееся место через OR
    // например prefix=0b01, value=0b101, valueBitLength=3: (0b01 << 3) | 0b101 = 0b01000 | 0b101 = 0b01101
    return (prefix << valueBitLength) | value;
  }

  /**
   * Достает обратно только младшие биты
   * То есть отбрасывает все старшие биты и оставляет только value
   */
  static unpackValue(bits: number, valueBitLength: number): number {
    // накладываем маску из единиц через AND, чтобы обнулить все старшие биты (префикс) и оставить только value
    // например bits=0b01101, valueBitLength=3: 0b01101 & 0b00111 = 0b00101
    return bits & BitStream.createIndexMask(valueBitLength);
  }

  get bitLength(): number {
    return this.totalBitLength;
  }

  get offset(): number {
    return this.currentBitOffset;
  }

  hasMoreBits(): boolean {
    return this.currentBitOffset < this.totalBitLength;
  }

  toUint8Array(): Uint8Array {
    return this.bytes;
  }

  writeBits(bits: number, bitLength: number): void {
    this.currentBitOffset = BitStream.writeBits(this.bytes, this.currentBitOffset, bits, bitLength, this.totalBitLength);
  }

  writePacked(prefix: number, prefixBitLength: number, value: number, valueBitLength: number): void {
    this.writeBits(BitStream.packPrefixAndValue(prefix, value, valueBitLength), prefixBitLength + valueBitLength);
  }

  readBits(bitLength: number): number {
    const value = BitStream.readBits(this.bytes, this.currentBitOffset, bitLength, this.totalBitLength);
    this.currentBitOffset += bitLength;
    return value;
  }

  readPackedWithKnownPrefix(prefix: number, prefixBitLength: number, valueBitLength: number): Readonly<{
    value: number;
    bits: number;
    bitLength: number;
  }> {
    const value = this.readBits(valueBitLength);

    return {
      value,
      bits: BitStream.packPrefixAndValue(prefix, value, valueBitLength),
      bitLength: prefixBitLength + valueBitLength,
    };
  }

  /**
   * Пишет bits длиной bitLength в общий поток байтов
   * Возвращает новую позицию, куда писать следующий бит
   */
  static writeBits(
    bytes: Uint8Array,
    startBitOffset: number,
    bits: number,
    bitLength: number,
    totalBitLength = bytes.length * 8,
  ): number {
    if (startBitOffset + bitLength > totalBitLength) {
      throw new Error("Битовый поток обрывается посреди записи символа");
    }

    let nextFreeBitOffset = startBitOffset;

    // идем по битам источника от старшего к младшему и записываем каждый бит в нужную позицию массива байтов
    for (let bitPositionInSource = bitLength - 1; bitPositionInSource >= 0; bitPositionInSource--) {
      // сдвигаем число вправо до нужного бита и забираем его через AND с 1
      const currentBit = (bits >> bitPositionInSource) & 1;
      // делим позицию на 8, чтобы понять в каком байте мы сейчас (>> 3 это то же самое что Math.floor(x / 8))
      const currentByteIndex = nextFreeBitOffset >> 3;
      // остаток от деления на 8, позиция бита внутри байта (& 7 это то же самое что x % 8)
      const bitPositionInsideByte = nextFreeBitOffset & 7;
      const currentByte = bytes[currentByteIndex];

      if (currentByte === undefined) {
        throw new Error(`Попытка записать за пределы буфера: byteIndex=${currentByteIndex}`);
      }

      // в байте биты нумеруются слева направо (7,6,5,...,0), а наш счетчик идет слева направо (0,1,2,...,7)
      const bitPositionFromLeft = 7 - bitPositionInsideByte;

      // ставим бит в нужную позицию через сдвиг и вклеиваем в байт через OR
      bytes[currentByteIndex] = currentByte | (currentBit << bitPositionFromLeft);
      nextFreeBitOffset += 1;
    }

    return nextFreeBitOffset;
  }

  /**
   * Читает bitLength бит из потока и собирает из них одно число
   */
  static readBits(bytes: Uint8Array, startBitOffset: number, bitLength: number, totalBitLength: number): number {
    if (startBitOffset + bitLength > totalBitLength) {
      throw new Error("Битовый поток обрывается посреди символа");
    }

    let result = 0;

    // читаем по одному биту и собираем из них число, как если бы дописывали цифры справа
    for (let bitsRead = 0; bitsRead < bitLength; bitsRead++) {
      const currentBitOffset = startBitOffset + bitsRead;
      // в каком байте лежит нужный бит (деление на 8)
      const currentByteIndex = currentBitOffset >> 3;
      // какой бит внутри этого байта (остаток от деления на 8)
      const bitPositionInsideByte = currentBitOffset & 7;
      const currentByte = bytes[currentByteIndex];

      if (currentByte === undefined) {
        throw new Error(`Попытка прочитать за пределами буфера: byteIndex=${currentByteIndex}`);
      }

      // переворачиваем нумерацию: бит 0 внутри байта это на самом деле 7-й (старший)
      const bitPositionFromLeft = 7 - bitPositionInsideByte;
      // сдвигаем байт вправо до нужного бита и забираем его через AND с 1
      const currentBit = (currentByte >> bitPositionFromLeft) & 1;

      // сдвигаем то что уже собрали влево на 1 и приклеиваем новый бит справа
      // например было result=0b10, читаем бит 1: (0b10 << 1) | 1 = 0b100 | 1 = 0b101
      result = (result << 1) | currentBit;
    }

    return result;
  }
}