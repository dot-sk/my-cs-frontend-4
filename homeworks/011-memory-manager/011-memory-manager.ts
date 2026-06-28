type MemoryRegion = "stack" | "heap";

interface IHandle {
  readonly id: number;
  readonly offset: number;
  readonly size: number;
  readonly byteLength: number;
  readonly region: MemoryRegion;

  write(data: Uint8Array): void;
  deref(): Uint8Array;
  free(): void;
}

interface IMemoryManager {
  push(data: Uint8Array): IHandle;
  pop(): void;
  alloc(byteLength: number): IHandle;
  free(pointer: IHandle): void;
  write(pointer: IHandle, data: Uint8Array): void;
  deref(pointer: IHandle): Uint8Array;
}

// Handle остается тонким: наружу отдаем id + region, а metadata блока хранит manager.
type MemoryBlockMeta = {
  id: number;
  offset: number;
  byteLength: number;
  region: MemoryRegion;
  released: boolean;
};

class HeapBlock {
  prev: HeapBlock | null = null;
  next: HeapBlock | null = null;
  handleId: number | null = null;

  constructor(
    public offset: number,
    public byteLength: number,
    public isFree = true,
  ) {}
}

class HeapBlockList {
  #tail: HeapBlock | null = null;
  #blocksByOffset = new Map<number, HeapBlock>();

  constructor(offset: number, byteLength: number) {
    if (byteLength <= 0) {
      return;
    }

    const block = new HeapBlock(offset, byteLength);

    this.#tail = block;
    this.#blocksByOffset.set(block.offset, block);
  }

  getByOffset(offset: number) {
    return this.#blocksByOffset.get(offset);
  }

  findFreeBlock(byteLength: number) {
    let block = this.#tail;

    while (block) {
      if (block.isFree && block.byteLength >= byteLength) {
        return block;
      }

      block = block.prev;
    }

    return null;
  }

  takeBlock(block: HeapBlock, byteLength: number) {
    if (block.byteLength === byteLength) {
      return block;
    }

    // Куча растет с конца свободного блока: низ остается free, верх отдаем handle.
    const usedBlock = new HeapBlock(
      block.offset + block.byteLength - byteLength,
      byteLength,
      false,
    );

    block.byteLength -= byteLength;
    this.#insertAfter(block, usedBlock);
    this.#blocksByOffset.set(usedBlock.offset, usedBlock);

    return usedBlock;
  }

  mergeBlock(block: HeapBlock) {
    let currentBlock = block;

    // merge вызывается на каждом free(), рядом может быть не больше одного free-блока с каждой стороны
    if (currentBlock.prev?.isFree) {
      const prevBlock = currentBlock.prev;

      prevBlock.byteLength += currentBlock.byteLength;
      this.#remove(currentBlock);
      currentBlock = prevBlock;
    }

    if (currentBlock.next?.isFree) {
      const nextBlock = currentBlock.next;

      currentBlock.byteLength += nextBlock.byteLength;
      this.#remove(nextBlock);
    }
  }

  #insertAfter(block: HeapBlock, newBlock: HeapBlock) {
    newBlock.prev = block;
    newBlock.next = block.next;

    if (block.next) {
      block.next.prev = newBlock;
    } else {
      this.#tail = newBlock;
    }

    block.next = newBlock;
  }

  #remove(block: HeapBlock) {
    if (block.prev) {
      block.prev.next = block.next;
    }

    if (block.next) {
      block.next.prev = block.prev;
    } else {
      this.#tail = block.prev;
    }

    this.#blocksByOffset.delete(block.offset);
  }
}

class StackHandle implements IHandle {
  readonly region = "stack" as const;

  constructor(
    readonly id: number,
    private readonly manager: MemoryManager,
  ) {}

  get offset(): number {
    return this.manager.getOffset(this);
  }

  get size(): number {
    return this.manager.getByteLength(this);
  }

  get byteLength(): number {
    return this.manager.getByteLength(this);
  }

  write(data: Uint8Array) {
    this.manager.write(this, data);
  }

  deref() {
    return this.manager.deref(this);
  }

  free() {
    this.manager.free(this);
  }
}

class HeapHandle implements IHandle {
  readonly region = "heap" as const;

  constructor(
    readonly id: number,
    private readonly manager: MemoryManager,
  ) {}

  get offset(): number {
    return this.manager.getOffset(this);
  }

  get size(): number {
    return this.manager.getByteLength(this);
  }

  get byteLength(): number {
    return this.manager.getByteLength(this);
  }

  write(data: Uint8Array) {
    this.manager.write(this, data);
  }

  deref() {
    return this.manager.deref(this);
  }

  free() {
    this.manager.free(this);
  }
}

export class MemoryManager implements IMemoryManager {
  readonly memory: Uint8Array;

  #stackByteLimit: number;
  #stackByteLength = 0;
  #stackIds: number[] = [];

  #heapBlocks: HeapBlockList;

  #nextHandleId = 1;
  #metaById = new Map<number, MemoryBlockMeta>();

  constructor(
    totalByteSize = 100,
    {
      stackByteSize = Math.floor(totalByteSize / 2),
    }: { stackByteSize?: number } = {},
  ) {
    if (!Number.isInteger(totalByteSize) || totalByteSize <= 0) {
      throw new RangeError("Некорректный размер памяти");
    }

    if (
      !Number.isInteger(stackByteSize) ||
      stackByteSize < 0 ||
      stackByteSize > totalByteSize
    ) {
      throw new RangeError("Некорректный размер стэка");
    }

    // Один общий буфер: стэк растет с начала, куча занимает место с хвоста до stackByteSize
    this.memory = new Uint8Array(totalByteSize);
    this.#stackByteLimit = stackByteSize;

    this.#heapBlocks = new HeapBlockList(
      stackByteSize,
      totalByteSize - stackByteSize,
    );
  }

  push(data: Uint8Array) {
    const byteLength = data.byteLength;

    const offset = this.#stackByteLength;
    const newStackByteLength = offset + byteLength;

    if (newStackByteLength > this.#stackByteLimit) {
      throw new RangeError("Стэк переполнен");
    }

    const id = this.#nextHandleId++;

    this.#metaById.set(id, {
      id,
      offset,
      byteLength,
      region: "stack",
      released: false,
    });

    this.#stackIds.push(id);
    this.memory.set(data, offset);
    this.#stackByteLength = newStackByteLength;

    return new StackHandle(id, this);
  }

  pop() {
    // Стэк освобождается в LIFO-порядке
    const id = this.#stackIds.pop();

    if (id === undefined) {
      throw new Error("Стэк пуст");
    }

    const meta = this.#metaById.get(id);

    if (!meta || meta.region !== "stack" || meta.released) {
      throw new Error("Метаданные стэка повреждены");
    }

    meta.released = true;
    this.memory.fill(0, meta.offset, meta.offset + meta.byteLength);
    this.#stackByteLength = meta.offset;
  }

  alloc(byteLength: number) {
    const block = this.#heapBlocks.findFreeBlock(byteLength);

    if (!block) {
      throw new RangeError("Недостаточно памяти в куче");
    }

    const usedBlock = this.#heapBlocks.takeBlock(block, byteLength);
    const id = this.#nextHandleId++;

    usedBlock.isFree = false;
    usedBlock.handleId = id;

    this.#metaById.set(id, {
      id,
      offset: usedBlock.offset,
      byteLength,
      region: "heap",
      released: false,
    });

    this.memory.fill(0, usedBlock.offset, usedBlock.offset + byteLength);

    return new HeapHandle(id, this);
  }

  free(pointer: IHandle) {
    if (pointer.region === "stack") {
      throw new Error("Для стэка используйте pop()");
    }

    const meta = this.#getMeta(pointer);
    const block = this.#heapBlocks.getByOffset(meta.offset);

    if (!block || block.isFree || block.handleId !== pointer.id) {
      throw new Error("Метаданные кучи повреждены");
    }

    meta.released = true;
    block.isFree = true;
    block.handleId = null;

    this.memory.fill(0, meta.offset, meta.offset + meta.byteLength);
    this.#heapBlocks.mergeBlock(block);
  }

  write(pointer: IHandle, data: Uint8Array) {
    const meta = this.#getMeta(pointer);

    if (data.byteLength > meta.byteLength) {
      throw new RangeError("Буффер слишком большой");
    }

    this.memory.set(data, meta.offset);

    if (data.byteLength < meta.byteLength) {
      this.memory.fill(
        0,
        meta.offset + data.byteLength,
        meta.offset + meta.byteLength,
      );
    }
  }

  deref(pointer: IHandle) {
    const meta = this.#getMeta(pointer);

    return new Uint8Array(
      this.memory.buffer,
      this.memory.byteOffset + meta.offset,
      meta.byteLength,
    );
  }

  getOffset(pointer: IHandle): number {
    return this.#getMeta(pointer, true).offset;
  }

  getByteLength(pointer: IHandle): number {
    return this.#getMeta(pointer, true).byteLength;
  }

  #getMeta(pointer: IHandle, allowReleased = false) {
    const meta = this.#metaById.get(pointer.id);

    if (!meta || meta.region !== pointer.region) {
      throw new Error("Некорректный указатель");
    }

    if (!allowReleased && meta.released) {
      throw new Error("Указатель уже освобожден");
    }

    return meta;
  }
}
