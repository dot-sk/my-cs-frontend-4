import { describe, it, expect } from "bun:test";
import { Deque, LinkedList } from "./010-deque";

describe("LinkedList", () => {
  it("should pushBack", () => {
    const ll = new LinkedList();
    ll.pushBack("123");
    expect(ll.length).toBe(1);
    expect(ll.head!.value).toBe("123");
    expect(ll.tail!.value).toBe("123");
  });
  it("should popBack", () => {
    const ll = new LinkedList();
    ll.pushBack("123");
    const result = ll.popBack();
    expect(result).toBe("123");
    expect(ll.length).toBe(0);
    expect(ll.head).toBeNull();
    expect(ll.tail).toBeNull();
  });
  it("should pushBack a list", () => {
    const ll = new LinkedList();
    ll.pushBack("1");
    ll.pushBack("2");
    ll.pushBack("3");
    ll.popBack();

    expect(ll.tail?.value).toBe("2");
    expect(ll.head?.value).toBe("1");
    expect(ll.tail?.prev?.value).toBe("1");
    expect(ll.head?.next?.value).toBe("2");
  });
  it("shoud pushFront", () => {
    const ll = new LinkedList();
    ll.pushFront(1);
    expect(ll.head?.value).toBe(1);
    expect(ll.tail?.value).toBe(1);
    expect(ll.length).toBe(1);
  });
  it("should pushFront a list", () => {
    const ll = new LinkedList();
    ll.pushFront(1);
    ll.pushFront(2);
    ll.pushFront(3);
    expect(ll.length).toBe(3);
    expect(ll.head?.value).toBe(3);
    expect(ll.tail?.value).toBe(1);
  });
  it("should popFront", () => {
    const ll = new LinkedList();
    ll.pushFront(1);
    ll.pushFront(2);
    ll.pushBack(0);
    ll.popFront();

    expect(ll.length).toBe(2);
    expect(ll.head?.value).toBe(1);
  });
  it("should clear links after popBack", () => {
    const ll = new LinkedList();
    ll.pushBack(1);
    ll.pushBack(2);
    ll.popBack();

    expect(ll.tail?.value).toBe(1);
    expect(ll.tail?.next).toBeNull();
  });
  it("should clear links after popFront", () => {
    const ll = new LinkedList();
    ll.pushBack(1);
    ll.pushBack(2);
    ll.popFront();

    expect(ll.head?.value).toBe(2);
    expect(ll.head?.prev).toBeNull();
  });
  it("should pop zero values", () => {
    const ll = new LinkedList();
    ll.pushBack(0);
    expect(ll.popBack()).toBe(0);

    ll.pushFront(0);
    expect(ll.popFront()).toBe(0);
  });
});

describe("Deque", () => {
  it("should return null from empty deque", () => {
    const d = new Deque<number>(() => new Uint8Array(4));

    expect(d.pop()).toBeNull();
    expect(d.shift()).toBeNull();
    expect(d.length).toBe(0);
  });

  it("should push and pop from back", () => {
    const d = new Deque<number>(() => new Uint8Array(4));

    expect(d.push(0)).toBe(1);
    expect(d.push(1)).toBe(2);
    expect(d.push(2)).toBe(3);
    expect(d.length).toBe(3);

    expect(d.pop()).toBe(2);
    expect(d.pop()).toBe(1);
    expect(d.pop()).toBe(0);
    expect(d.pop()).toBeNull();
    expect(d.length).toBe(0);
  });

  it("should push across block boundary", () => {
    const d = new Deque<number>(() => new Uint8Array(4));

    d.push(1);
    d.push(2);
    d.push(3);
    d.push(4);
    d.push(5);

    expect(d.length).toBe(5);
    expect(d.pop()).toBe(5);
    expect(d.pop()).toBe(4);
    expect(d.pop()).toBe(3);
    expect(d.pop()).toBe(2);
    expect(d.pop()).toBe(1);
    expect(d.pop()).toBeNull();
  });

  it("should unshift and shift from front", () => {
    const d = new Deque<number>(() => new Uint8Array(4));

    expect(d.unshift(1)).toBe(1);
    expect(d.unshift(2)).toBe(2);
    expect(d.unshift(3)).toBe(3);
    expect(d.length).toBe(3);

    expect(d.shift()).toBe(3);
    expect(d.shift()).toBe(2);
    expect(d.shift()).toBe(1);
    expect(d.shift()).toBeNull();
    expect(d.length).toBe(0);
  });

  it("should support mixed operations on both ends", () => {
    const d = new Deque<number>(() => new Uint8Array(4));

    d.push(1);
    d.push(2);
    d.unshift(0);

    expect(d.pop()).toBe(2);
    expect(d.shift()).toBe(0);

    d.push(3);
    d.unshift(4);

    expect(d.shift()).toBe(4);
    expect(d.pop()).toBe(3);
    expect(d.shift()).toBe(1);
    expect(d.shift()).toBeNull();
    expect(d.length).toBe(0);
  });
});
