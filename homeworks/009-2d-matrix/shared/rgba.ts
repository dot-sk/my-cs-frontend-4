import type { HexColor, RGBAInput, RGBARef, RGBATuple, View } from "./types";

/** Класс с акцессорами на прототипе – расшаривается между всеми инстансами,
 * аллокация в `view` сводится к одному объекту с двумя полями */
class RGBAColorRef implements RGBARef {
  constructor(
    public bytes: Uint8Array,
    public offset: number,
  ) {}

  get red() {
    return this.bytes[this.offset];
  }
  set red(value: number) {
    this.bytes[this.offset] = value;
  }
  get green() {
    return this.bytes[this.offset + 1];
  }
  set green(value: number) {
    this.bytes[this.offset + 1] = value;
  }
  get blue() {
    return this.bytes[this.offset + 2];
  }
  set blue(value: number) {
    this.bytes[this.offset + 2] = value;
  }
  get alpha() {
    return this.bytes[this.offset + 3];
  }
  set alpha(value: number) {
    this.bytes[this.offset + 3] = value;
  }
}

export class RGBA {
  static BYTES_PER_ELEMENT = 4;

  // конвертация из hex в RGBA, альфа канал для hex не поддерживаем, ставим 255
  // пример: "#ff00ff" -> [255, 0, 255, 255], "#FFF" -> [255, 255, 255, 255]
  static hexToRGBA(hex: HexColor): RGBATuple {
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }

    const num = parseInt(hex.slice(1), 16);
    const r = (num >> 16) & 0xff;
    const g = (num >> 8) & 0xff;
    const b = num & 0xff;
    // альфа канал для хекса не поддеживаем, ставим 255
    const a = 255;
    return [r, g, b, a];
  }

  static set(bytes: Uint8Array, index: number, value: RGBAInput): void {
    const rgba = typeof value === "string" ? RGBA.hexToRGBA(value) : value;
    const offset = index * RGBA.BYTES_PER_ELEMENT;

    bytes[offset] = rgba[0];
    bytes[offset + 1] = rgba[1];
    bytes[offset + 2] = rgba[2];
    bytes[offset + 3] = rgba[3];
  }

  static get(bytes: Uint8Array, index: number): RGBATuple {
    const offset = index * RGBA.BYTES_PER_ELEMENT;
    const r = bytes[offset];
    const g = bytes[offset + 1];
    const b = bytes[offset + 2];
    const a = bytes[offset + 3];
    return [r, g, b, a];
  }

  static view(bytes: Uint8Array, index: number): RGBARef {
    return new RGBAColorRef(bytes, index * RGBA.BYTES_PER_ELEMENT);
  }
}

RGBA satisfies View<RGBATuple, RGBAInput, RGBARef>;
