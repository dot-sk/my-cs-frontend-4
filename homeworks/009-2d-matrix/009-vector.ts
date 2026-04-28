import type { RGBAInput, RGBATuple, View } from "./shared/types";

/**
 * Обычный вектор
 */
export class Vector<TGet, TSet = TGet, TRef = TGet> {
  buffer: ArrayBufferLike;
  capacity: number;
  length: number;
  private _bytes: Uint8Array;
  private _entity: View<TGet, TSet, TRef>;

  BYTES_PER_ELEMENT: number;

  constructor(
    capacity: number,
    entity: View<TGet, TSet, TRef>,
    source?: ArrayBufferLike | ArrayBufferView,
  ) {
    const need = capacity * entity.BYTES_PER_ELEMENT;

    if (source === undefined) {
      this.buffer = new ArrayBuffer(need);
      this._bytes = new Uint8Array(this.buffer);
    } else if (ArrayBuffer.isView(source)) {
      this.buffer = source.buffer;
      this._bytes = new Uint8Array(
        source.buffer,
        source.byteOffset,
        source.byteLength,
      );
    } else {
      this.buffer = source;
      this._bytes = new Uint8Array(source);
    }

    if (this._bytes.byteLength < need) {
      throw new RangeError(
        `Буффер слишком мал для вектора из ${capacity} элементов и размера элемента ${entity.BYTES_PER_ELEMENT}`,
      );
    }

    this.length = 0;
    this.capacity = capacity;
    this._entity = entity;
    this.BYTES_PER_ELEMENT = entity.BYTES_PER_ELEMENT;
  }

  set(index: number, value: TSet): void {
    this._entity.set(this._bytes, index, value);
  }

  get(index: number): TGet {
    return this._entity.get(this._bytes, index);
  }

  fill(value: TSet): void {
    for (let i = 0; i < this.capacity; i++) {
      this.set(i, value);
    }
  }

  #resize(newCapacity: number) {
    if (newCapacity === this.capacity) {
      return;
    }

    const shouldDownsize = newCapacity < this.capacity;
    const canDownsize = newCapacity >= this.length;

    // делаем downsize
    if (shouldDownsize && canDownsize) {
      const newBuffer = this.buffer.slice(
        0,
        newCapacity * this.BYTES_PER_ELEMENT,
      );
      this.buffer = newBuffer;
      this._bytes = new Uint8Array(this.buffer);
      this.capacity = newCapacity;
      return;
    }

    if (shouldDownsize && !canDownsize) {
      throw new RangeError(
        `Невозможно уменьшить буфер до ${newCapacity} элементов, так как фактическая длина вектора ${this.length}`,
      );
    }

    if (this.buffer instanceof ArrayBuffer) {
      if (
        this.buffer.resizable &&
        this.buffer.maxByteLength >= newCapacity * this.BYTES_PER_ELEMENT
      ) {
        this.buffer.resize(newCapacity * this.BYTES_PER_ELEMENT);
        this.capacity = newCapacity;
        return;
      }
    }

    if (this.buffer instanceof SharedArrayBuffer) {
      if (
        this.buffer.growable &&
        this.buffer.maxByteLength >= newCapacity * this.BYTES_PER_ELEMENT
      ) {
        this.buffer.grow(
          newCapacity * this.BYTES_PER_ELEMENT - this.buffer.byteLength,
        );
        this.capacity = newCapacity;
        return;
      }
    }

    const newBuffer =
      this.buffer instanceof ArrayBuffer
        ? new ArrayBuffer(newCapacity * this.BYTES_PER_ELEMENT)
        : new SharedArrayBuffer(newCapacity * this.BYTES_PER_ELEMENT);

    // Копируем старые данные в новый буфер
    new Uint8Array(newBuffer).set(
      new Uint8Array(this.buffer, 0, this.length * this.BYTES_PER_ELEMENT),
    );

    this.buffer = newBuffer;
    this._bytes = new Uint8Array(newBuffer);
    this.capacity = newCapacity;
  }

  push(value: TSet): void {
    if (this.length >= this.capacity) {
      this.#resize(this.capacity * 2);
    }

    this.set(this.length, value);
    this.length++;
  }

  pop(): TGet | undefined {
    if (this.length === 0) {
      return undefined;
    }

    this.length--;
    return this.get(this.length);
  }

  // Ужимает внутренний буфер до фактической длины вектора
  shrinkToFit() {
    if (this.length === this.capacity) {
      return;
    }

    this.#resize(this.length);
  }

  // Гарантирует место в буфере для хранения как минимум ещё N элементов
  // Растим до max(length + additional, capacity * 2) – амортизация как в Rust Vec,
  // чтобы повторные reserve(1) в цикле не давали O(N²)
  reserve(additional: number) {
    if (this.length + additional <= this.capacity) {
      return;
    }

    this.#resize(Math.max(this.length + additional, this.capacity * 2));
  }

  view(index: number): TRef {
    return this._entity.view(this._bytes, index);
  }

  shift(): TGet | undefined {
    if (this.length === 0) {
      return undefined;
    }

    const value = this.get(0);

    /** copyWithin корректно обрабатывает перекрытие диапазонов */
    const bytes = new Uint8Array(this.buffer);
    const elem = this.BYTES_PER_ELEMENT;
    bytes.copyWithin(0, elem, this.length * elem);

    this.length--;
    return value;
  }

  unshift(value: TSet): void {
    if (this.length >= this.capacity) {
      this.#resize(this.capacity * 2);
    }

    const bytes = new Uint8Array(this.buffer);
    const elem = this.BYTES_PER_ELEMENT;
    bytes.copyWithin(elem, 0, this.length * elem);

    this.set(0, value);
    this.length++;
  }
}
