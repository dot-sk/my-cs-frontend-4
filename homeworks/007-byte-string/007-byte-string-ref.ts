const HEADER_SIZE = 4;
const LEN_FIELD_SIZE = 4;
const PTR_FIELD_SIZE = 4;
const INDEX_ENTRY_SIZE = LEN_FIELD_SIZE + PTR_FIELD_SIZE;
const INITIAL_CAPACITY = 256;
const MAX_CAPACITY = 1e6;

export class StringBufferRef {
  // внутри такая схема данных [count:uint32] [len1:uint32][ptr1:uint32] [len2:uint32][ptr2:uint32] ... [data1][data2]...
  #buffer: ArrayBuffer;
  #dataView: DataView;
  // следующая свободная позиция в хвосте, куда пишем данные строк
  #byteLength: number;
  #decoder = new TextDecoder();
  readonly count: number;

  constructor(buffer: ArrayBuffer, count: number) {
    this.#buffer = buffer;
    this.count = count;
    this.#dataView = new DataView(buffer);
    // хвост начинается сразу за header и index
    this.#byteLength = HEADER_SIZE + count * INDEX_ENTRY_SIZE;
  }

  static fromData(data: string[]): StringBufferRef {
    const buffer = new ArrayBuffer(
      // начальный capacity
      INITIAL_CAPACITY,
      {
        // max capacity
        maxByteLength: MAX_CAPACITY, // 1мб
      },
    );

    const sb = new StringBufferRef(buffer, data.length);
    sb.#writeData(data);
    return sb;
  }

  static fromBuffer(buffer: ArrayBuffer): StringBufferRef {
    const count = new DataView(buffer).getUint32(0, true);
    const sb = new StringBufferRef(buffer, count);
    // восстанавливаем позицию хвоста, чтобы set мог дописывать
    sb.#recalcByteLength();
    return sb;
  }

  get buffer(): ArrayBuffer {
    return this.#buffer;
  }

  // по времени O(1), по памяти O(1)
  at(idx: number): string {
    if (this.count === 0) return "";

    const indexOffset = HEADER_SIZE + this.#mod(idx) * INDEX_ENTRY_SIZE;
    const length = this.#dataView.getUint32(indexOffset, true);
    const ptr = this.#dataView.getUint32(indexOffset + LEN_FIELD_SIZE, true);
    return this.#readString(ptr, length);
  }

  // по времени O(1), по памяти амортизированно O(1), буфер только растет
  set(idx: number, str: string): void {
    if (this.count === 0) {
      throw new RangeError("нельзя set в пустой буфер");
    }

    const indexOffset = HEADER_SIZE + this.#mod(idx) * INDEX_ENTRY_SIZE;
    const bytes = new TextEncoder().encode(str);
    this.#ensureCapacity(bytes.length);

    // пишем новую строку в хвост, старые байты остаются мусором
    const ptr = this.#byteLength;
    new Uint8Array(this.#buffer, ptr, bytes.length).set(bytes);
    this.#byteLength += bytes.length;

    // обновляем длину и указатель в индексе
    this.#dataView.setUint32(indexOffset, bytes.length, true);
    this.#dataView.setUint32(indexOffset + LEN_FIELD_SIZE, ptr, true);
  }

  // по времени O(n), по памяти O(n)
  toArray(): string[] {
    const result: string[] = [];
    for (let i = 0; i < this.count; i++) {
      result.push(this.at(i));
    }
    return result;
  }

  #writeData(data: string[]): void {
    // пишем первые 4 байта количество строк в массиве
    this.#dataView.setUint32(0, data.length, true);

    const encoder = new TextEncoder();

    // пишем каждую строку: сначала данные в хвост, потом len+ptr в индекс
    data.forEach((str, idx) => {
      const bytes = encoder.encode(str);
      this.#ensureCapacity(bytes.length);

      const indexOffset = HEADER_SIZE + idx * INDEX_ENTRY_SIZE;
      const ptr = this.#byteLength;

      // пишем данные строки
      new Uint8Array(this.#buffer, ptr, bytes.length).set(bytes);
      this.#byteLength += bytes.length;

      // пишем длину и указатель
      this.#dataView.setUint32(indexOffset, bytes.length, true);
      this.#dataView.setUint32(indexOffset + LEN_FIELD_SIZE, ptr, true);
    });
  }

  #recalcByteLength(): void {
    // хвост = максимум ptr + length по всем записям индекса
    for (let i = 0; i < this.count; i++) {
      const indexOffset = HEADER_SIZE + i * INDEX_ENTRY_SIZE;
      const length = this.#dataView.getUint32(indexOffset, true);
      const ptr = this.#dataView.getUint32(indexOffset + LEN_FIELD_SIZE, true);
      if (ptr + length > this.#byteLength) {
        this.#byteLength = ptr + length;
      }
    }
  }

  #ensureCapacity(bytesToWrite: number): void {
    if (
      this.#buffer.resizable &&
      bytesToWrite > this.#buffer.byteLength - this.#byteLength
    ) {
      this.#buffer.resize(
        Math.max(
          this.#buffer.byteLength * 2,
          (this.#byteLength + bytesToWrite) * 2,
        ),
      );
    }
  }

  #readString(offset: number, length: number): string {
    return this.#decoder.decode(new Uint8Array(this.#buffer, offset, length));
  }

  #mod(idx: number): number {
    return ((idx % this.count) + this.count) % this.count;
  }
}

export function encodeStrings(data: string[]): ArrayBuffer {
  return StringBufferRef.fromData(data).buffer;
}

export function decodeStrings(buffer: ArrayBuffer): string[] {
  return StringBufferRef.fromBuffer(buffer).toArray();
}
