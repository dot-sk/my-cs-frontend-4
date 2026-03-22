export type EncodedText = Readonly<{
  bytes: Uint8Array; // упакованные биты всех символов подряд
  bitLength: number; // сколько бит в bytes реально занято данными, остаток в конце это просто padding
}>;
