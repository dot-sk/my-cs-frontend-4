const STR_LEN_BYTE_SIZE = 4;
const INITIAL_CAPACITY = 256;
const MAX_CAPACITY = 1e6;

export class StringBuffer {
  // внутри такая схема данных [count:uint32][len1:uint32][bytes1][len2:uint32][bytes2]
  #buffer: ArrayBuffer;
  #dataView: DataView;
  // количество занятых данными байт, первые 4 байта всегда заняты под count:uint32
  #byteLength: number = STR_LEN_BYTE_SIZE;
  #decoder = new TextDecoder();
  readonly count: number;

  constructor(buffer: ArrayBuffer, count: number) {
    this.#buffer = buffer;
    this.count = count;
    this.#dataView = new DataView(buffer);
  }

  static fromData(data: string[]): StringBuffer {
    const buffer = new ArrayBuffer(
      // начальный capacity
      INITIAL_CAPACITY,
      {
        // max capacity
        maxByteLength: MAX_CAPACITY, // 1мб
      },
    );

    const sb = new StringBuffer(buffer, data.length);
    sb.#writeData(data);
    return sb;
  }

  static fromBuffer(buffer: ArrayBuffer): StringBuffer {
    const count = new DataView(buffer).getUint32(0, true);
    return new StringBuffer(buffer, count);
  }

  get buffer(): ArrayBuffer {
    return this.#buffer;
  }

  // по времени O(n), по памяти O(1)
  at(idx: number): string {
    if (this.count === 0) return "";

    const target = this.#mod(idx);
    for (const { offset, length, index } of this.#entries()) {
      if (index === target) return this.#readString(offset, length);
    }
    return "";
  }

  // по времени O(n), по памяти O(n)
  toArray(): string[] {
    const result: string[] = [];
    for (const { offset, length } of this.#entries()) {
      result.push(this.#readString(offset, length));
    }
    return result;
  }

  #writeData(data: string[]): void {
    // пишем первые 4 байта количество строк в массиве
    this.#dataView.setUint32(0, data.length, true);

    const encoder = new TextEncoder();

    // пишем каждую строку
    data.forEach((str) => {
      const bytes = encoder.encode(str);
      this.#ensureCapacity(bytes.length + STR_LEN_BYTE_SIZE);

      // пишем длину строки
      this.#dataView.setUint32(this.#byteLength, bytes.length, true);
      this.#byteLength += STR_LEN_BYTE_SIZE;

      // пишем саму строку
      new Uint8Array(this.#buffer, this.#byteLength, bytes.length).set(bytes);
      this.#byteLength += bytes.length;
    });
  }

  #ensureCapacity(bytesToWrite: number): void {
    if (
      this.#buffer.resizable &&
      bytesToWrite > this.#buffer.byteLength - this.#byteLength
    ) {
      this.#buffer.resize(
        Math.max(this.#buffer.byteLength * 2, bytesToWrite * 2),
      );
    }
  }

  #readString(offset: number, length: number): string {
    return this.#decoder.decode(new Uint8Array(this.#buffer, offset, length));
  }

  #mod(idx: number): number {
    return ((idx % this.count) + this.count) % this.count;
  }

  *#entries(): Generator<{ offset: number; length: number; index: number }> {
    let cursor = STR_LEN_BYTE_SIZE;
    for (let i = 0; i < this.count; i++) {
      const length = this.#dataView.getUint32(cursor, true);
      const offset = cursor + STR_LEN_BYTE_SIZE;
      cursor = offset + length;
      yield { offset, length, index: i };
    }
  }
}

export function encodeStrings(data: string[]): ArrayBuffer {
  return StringBuffer.fromData(data).buffer;
}

export function decodeStrings(buffer: ArrayBuffer): string[] {
  return StringBuffer.fromBuffer(buffer).toArray();
}
