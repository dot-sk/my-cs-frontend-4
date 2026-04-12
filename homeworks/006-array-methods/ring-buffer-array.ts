/**
 * Кольцевой буфер через два монотонных счетчика
 *
 * Идея как в Kafka: `writes` – сколько всего записали за жизнь буфера,
 * `reads` – сколько всего прочитали. Физический массив – скользящее окно
 * размера `capacity` над воображаемой бесконечной лентой
 *
 * Инварианты:
 * - count = writes - reads
 * - count ∈ [0, capacity]
 * - пустой когда writes === reads
 * - полный когда count === capacity
 *
 * Все операции push/pop/shift/unshift работают за O(1)
 *
 * Физический размер буфера округляется до степени двойки, чтобы
 * нормализовать индекс битовой маской (`i & mask`) вместо дорогого `i % size`
 */
export class RingBufferArray<T = undefined> {
  static nextPow2(n: number): number {
    if (n <= 0) return 1;
    return 1 << (32 - Math.clz32(n - 1));
  }

  private buffer: (T | undefined)[];
  private capacity: number;
  private mask: number;
  private writes = 0;
  private reads = 0;

  constructor(size: number) {
    const physicalSize = RingBufferArray.nextPow2(size);
    this.capacity = size;
    this.mask = physicalSize - 1;
    this.buffer = Array.from({ length: physicalSize }, () => undefined);
  }

  private mod(i: number): number {
    return i & this.mask;
  }

  get count(): number {
    return this.writes - this.reads;
  }

  get isEmpty(): boolean {
    return this.writes === this.reads;
  }

  get isFull(): boolean {
    return this.count === this.capacity;
  }

  /** Добавить в хвост. При переполнении затирает самый старый элемент */
  push(v: T): void {
    this.buffer[this.mod(this.writes)] = v;
    this.writes++;
    if (this.count > this.capacity) {
      this.reads++;
    }
  }

  /** Снять с хвоста */
  pop(): T | undefined {
    if (this.isEmpty) return undefined;
    this.writes--;
    const idx = this.mod(this.writes);
    const v = this.buffer[idx];
    this.buffer[idx] = undefined;
    return v as T;
  }

  /** Снять с головы */
  shift(): T | undefined {
    if (this.isEmpty) return undefined;
    const idx = this.mod(this.reads);
    const v = this.buffer[idx];
    this.buffer[idx] = undefined;
    this.reads++;
    return v as T;
  }

  /** Добавить в голову. При переполнении затирает самый новый элемент */
  unshift(v: T): void {
    if (this.isFull) this.writes--;
    this.reads--;
    this.buffer[this.mod(this.reads)] = v;
  }

  toArray(): (T | undefined)[] {
    return Array.from(
      { length: this.count },
      (_, i) => this.buffer[this.mod(this.reads + i)],
    );
  }

  toString(): string {
    return `RingBufferArray(${this.toArray().join(", ")})`;
  }
}
