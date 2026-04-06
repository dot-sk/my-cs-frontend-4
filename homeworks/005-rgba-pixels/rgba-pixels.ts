type RGBA = [red: number, green: number, blue: number, alpha: number];
type RGBAObject = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
};

export enum TraverseMode {
  RowMajor,
  ColMajor,
}

interface Image {
  data: ArrayLike<unknown>;
  width: number;
  height: number;

  get(x: number, y: number): RGBA;
  set(x: number, y: number, rgba: RGBA): void;
}

export class FlatArrayImage implements Image {
  data: number[];
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Array(width * height * 4).fill(0).map((_, i) => i % 255);
  }

  get(x: number, y: number): RGBA {
    const pixel = [0, 0, 0, 0] as RGBA;
    const baseIndex = (y * this.width + x) * 4;
    for (let i = 0; i < 4; i++) {
      pixel[i] = this.data[baseIndex + i];
    }
    return pixel;
  }

  set(x: number, y: number, rgba: RGBA): void {
    const baseIndex = (y * this.width + x) * 4;
    for (let i = 0; i < 4; i++) {
      this.data[baseIndex + i] = rgba[i];
    }
  }
}

export class ArrayOfArraysImage implements Image {
  data: RGBA[];
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.data = new Array(width * height).fill(0).map((_, i) => {
      return [i % 255, i % 255, i % 255, 1];
    });
  }

  get(x: number, y: number): RGBA {
    const index = y * this.width + x;
    return [...this.data[index]];
  }

  set(x: number, y: number, rgba: RGBA): void {
    const index = y * this.width + x;
    this.data[index] = rgba;
  }
}

export class ArrayOfObjectsImage implements Image {
  data: RGBAObject[];
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.data = new Array(width * height).fill(0).map((_, i) => ({
      red: i % 255,
      green: i % 255,
      blue: i % 255,
      alpha: 1,
    }));
  }

  get(x: number, y: number): RGBA {
    const index = y * this.width + x;
    const pixel = this.data[index];
    return [pixel.red, pixel.green, pixel.blue, pixel.alpha];
  }

  set(x: number, y: number, rgba: RGBA): void {
    const index = y * this.width + x;
    const [red, green, blue, alpha] = rgba;
    this.data[index] = { red, green, blue, alpha };
  }
}

export class Uint32Image implements Image {
  data: Uint32Array;
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;

    this.data = new Uint32Array(width * height).map((_, i) => {
      const r = (i & 0xff) << 24;
      const g = (i & 0xff) << 16;
      const b = (i & 0xff) << 8;
      const a = 0xff;
      return r | g | b | a;
    });
  }

  get(x: number, y: number): RGBA {
    const index = y * this.width + x;
    const pixel = this.data[index];
    // извлекаем компоненты цвета из 32-битного числа
    // R занимает биты с 32 по 25, G — с 24 по 17, B — с 16 по 9, A — с 8 по 1
    const r = (pixel >> 24) & 0xff;
    const g = (pixel >> 16) & 0xff;
    const b = (pixel >> 8) & 0xff;
    const a = pixel & 0xff;
    return [r, g, b, a];
  }

  set(x: number, y: number, rgba: RGBA): void {
    const index = y * this.width + x;
    const [r, g, b, a] = rgba;
    // упаковываем компоненты цвета в 32-битное число
    this.data[index] =
      ((r & 0xff) << 24) | ((g & 0xff) << 16) | ((b & 0xff) << 8) | (a & 0xff);
  }
}

export interface PixelStream {
  getPixel(x: number, y: number): RGBA;
  setPixel(x: number, y: number, rgba: RGBA): RGBA;
  forEach(
    mode: TraverseMode,
    callback: (rgba: RGBA, x: number, y: number) => void,
  ): void;
}

export class PixelStream implements PixelStream {
  constructor(private image: Image) {}

  getPixel(x: number, y: number): RGBA {
    return this.image.get(x, y);
  }

  setPixel(x: number, y: number, rgba: RGBA): RGBA {
    const oldPixel = this.image.get(x, y);
    this.image.set(x, y, rgba);
    return oldPixel;
  }

  forEach(
    mode: TraverseMode,
    callback: (rgba: RGBA, x: number, y: number) => void,
  ): void {
    if (mode === TraverseMode.RowMajor) {
      for (let y = 0; y < this.image.height; y++) {
        for (let x = 0; x < this.image.width; x++) {
          const pixel = this.getPixel(x, y);
          callback(pixel, x, y);
        }
      }
    } else if (mode === TraverseMode.ColMajor) {
      for (let x = 0; x < this.image.width; x++) {
        for (let y = 0; y < this.image.height; y++) {
          const pixel = this.getPixel(x, y);
          callback(pixel, x, y);
        }
      }
    }
  }
}
