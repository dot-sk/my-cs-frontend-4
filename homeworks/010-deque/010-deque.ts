class ListNode<T> {
  public prev?: ListNode<T> | null;
  public next?: ListNode<T> | null;
  public value: T;

  constructor(value: T, prev?: ListNode<T> | null, next?: ListNode<T> | null) {
    this.value = value;

    if (prev) {
      this.prev = prev;
      prev.next = this;
    }

    if (next) {
      this.next = next;
      next.prev = this;
    }
  }
}

export class LinkedList<T> {
  public head: ListNode<T> | null = null;
  public tail: ListNode<T> | null = null;
  public length = 0;

  constructor() {}

  pushBack(value: T) {
    const node = new ListNode(value, this.tail);
    this.tail = node;
    if (this.head === null) {
      this.head = this.tail;
    }
    this.length++;
  }
  popBack(): T | null {
    if (this.length === 0) {
      return null;
    }

    const temp = this.tail;
    this.tail = temp?.prev || null;

    if (this.tail !== null) {
      this.tail.next = null;
    }

    if (this.head === temp) {
      this.head = null;
    }

    this.length--;

    return temp!.value;
  }

  pushFront(value: T) {
    const node = new ListNode(value, undefined, this.head);
    this.head = node;

    if (this.tail === null) {
      this.tail = node;
    }

    this.length++;
  }

  popFront(): T | null {
    if (this.length === 0) {
      return null;
    }

    const temp = this.head;
    this.head = temp?.next || null;

    if (this.head !== null) {
      this.head.prev = null;
    }

    this.length--;

    if (this.tail === temp) {
      this.tail = null;
    }

    return temp!.value;
  }
}

export class Deque<T extends number> {
  private firstIndex = 0;
  private lastIndex = 0;
  private buildBlock: () => Uint8Array;

  public ll: LinkedList<Uint8Array> = new LinkedList();
  public length = 0;
  public blockSize: number = 0;

  constructor(buildBlock: () => Uint8Array) {
    this.buildBlock = buildBlock;
    const block = this.buildBlock();
    this.blockSize = block.length;

    if (this.blockSize < 2) {
      throw new TypeError(
        `Размер блока должен быть больше 2, сейчас ${this.blockSize}`,
      );
    }

    this.ll.pushBack(block);
  }

  push(value: T) {
    return this.pushBack(value);
  }
  pop() {
    if (this.length === 0) {
      return null;
    }
    const temp = this.ll.tail!.value[this.lastIndex];
    this.length--;
    this.lastIndex--;

    if (this.lastIndex < 0) {
      this.ll.popBack();
      this.lastIndex = this.blockSize - 1;
    }

    return temp;
  }

  shift() {
    if (this.length === 0) {
      return null;
    }

    this.firstIndex++;
    const temp = this.ll.head!.value[this.firstIndex];
    this.length--;

    if (this.length === 0) {
      this.firstIndex = 0;
      this.lastIndex = 0;
      return temp;
    }

    if (this.firstIndex >= this.blockSize - 1) {
      this.ll.popFront();
      this.firstIndex = -1;
    }

    return temp;
  }

  unshift(value: T) {
    if (this.firstIndex < 0) {
      this.ll.pushFront(this.buildBlock());
      this.firstIndex = this.blockSize - 1;
    }

    this.ll.head!.value[this.firstIndex] = value;
    this.firstIndex--;
    this.length++;

    return this.length;
  }

  pushBack(value: T) {
    if (this.lastIndex === null) {
      this.lastIndex = Math.floor(this.blockSize / 2);
    }

    this.lastIndex++;
    this.length++;

    if (this.lastIndex >= this.blockSize) {
      this.ll.pushBack(this.buildBlock());
      this.lastIndex = 0;
    }

    this.ll.tail!.value![this.lastIndex] = value;

    return this.length;
  }
}
