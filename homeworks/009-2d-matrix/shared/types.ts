export type HexColor = `#${string}`;
export type RGBATuple = [number, number, number, number];
export type RGBAInput = RGBATuple | HexColor;

export type RGBARef = {
  red: number;
  green: number;
  blue: number;
  alpha: number;
};

export interface View<TGet, TSet = TGet, TRef = TGet> {
  BYTES_PER_ELEMENT: number;
  set(bytes: Uint8Array, index: number, value: TSet): void;
  get(bytes: Uint8Array, index: number): TGet;
  view(bytes: Uint8Array, index: number): TRef;
}
