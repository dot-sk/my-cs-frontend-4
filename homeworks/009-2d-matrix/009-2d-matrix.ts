import type { View } from "./shared/types";

export class Matrix2D<TGet, TSet = TGet, TRef = TGet> {
  width: number;
  height: number;
  buffer: ArrayBufferLike;
  #bytes: Uint8Array;
  #entity: View<TGet, TSet, TRef>;
  #order: "row-major" | "column-major";

  BYTES_PER_ELEMENT: number;

  constructor(
    width: number,
    height: number,
    entity: View<TGet, TSet, TRef>,
    source?: ArrayBufferLike | ArrayBufferView,
    order: "row-major" | "column-major" = "row-major",
  ) {
    const need = width * height * entity.BYTES_PER_ELEMENT;

    if (source === undefined) {
      this.buffer = new ArrayBuffer(need);
      this.#bytes = new Uint8Array(this.buffer);
    } else if (ArrayBuffer.isView(source)) {
      this.buffer = source.buffer;
      this.#bytes = new Uint8Array(
        source.buffer,
        source.byteOffset,
        source.byteLength,
      );
    } else {
      this.buffer = source;
      this.#bytes = new Uint8Array(source);
    }

    if (this.#bytes.byteLength < need) {
      throw new RangeError(
        `Буффер слишком мал для матрицы ${width}x${height} и размера элемента ${entity.BYTES_PER_ELEMENT}`,
      );
    }

    this.width = width;
    this.height = height;
    this.BYTES_PER_ELEMENT = entity.BYTES_PER_ELEMENT;
    this.#entity = entity;
    this.#order = order;
  }

  set(x: number, y: number, value: TSet): void {
    const index = this.#getIndex(x, y);
    this.#entity.set(this.#bytes, index, value);
  }

  get(x: number, y: number): TGet {
    const index = this.#getIndex(x, y);
    return this.#entity.get(this.#bytes, index);
  }

  fill(value: TSet): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.set(x, y, value);
      }
    }
  }

  view(x: number, y: number): TRef {
    const index = this.#getIndex(x, y);
    return this.#entity.view(this.#bytes, index);
  }

  // возвращает индекс entity в координатах (x, y) в зависимости от метода итерации
  #getIndex(x: number, y: number): number {
    if (this.#order === "row-major") {
      return y * this.width + x;
    }

    return x * this.height + y;
  }
}
