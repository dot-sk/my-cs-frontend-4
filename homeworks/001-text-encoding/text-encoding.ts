import {
  BitStream,
} from "./bit-stream.ts";
import { ALPHABET } from "./constants.ts";

// пробел + топ 3 буквы с вики
const GROUP_TOP_4 = [" ", "о", "е", "а"] as const;
const GROUP_TOP_8 = ["и", "н", "т", "с", "р", "в", "л", "к"] as const;
const GROUP_TOP_16 = ["м", "д", "п", "у", "я", "ы", "ь", "г", "з", "б", "ч", "й", "ж", "х", "ш", "ю"] as const;

const PREFIX_BIT_LENGTH = 2;
const ALPHABET_INDEX_BIT_LENGTH = 7;
const PREFIX_FALLBACK = 0b11;

const FREQUENCY_GROUPS = [
  { chars: GROUP_TOP_4, prefix: 0b00, indexBitLength: 2 },
  { chars: GROUP_TOP_8, prefix: 0b01, indexBitLength: 3 },
  { chars: GROUP_TOP_16, prefix: 0b10, indexBitLength: 4 },
] as const;

const PREFIX_TO_INDEX_BIT_LENGTH = new Map<number, number>([
  ...FREQUENCY_GROUPS.map(({ prefix, indexBitLength }) => [prefix, indexBitLength] as const),
  [PREFIX_FALLBACK, ALPHABET_INDEX_BIT_LENGTH],
]);

export type EncodedSymbol = Readonly<{
  bits: number; // упакованные биты, в которых есть и префикс, и индекс символа внутри группы
  bitLength: number; // сколько бит в числе bits реально занято данными
}>;

export type EncodedText = Readonly<{
  bytes: Uint8Array; // упакованные биты всех символов подряд
  bitLength: number; // сколько бит в bytes реально занято данными, остаток в конце это просто padding
}>;

function encodeSymbolFromGroup(symbol: string, group: readonly string[], prefix: number, indexBitLength: number): EncodedSymbol | null {
  const symbolIndex = group.indexOf(symbol);

  if (symbolIndex === -1) {
    return null;
  }

  return {
    bits: BitStream.packPrefixAndValue(prefix, symbolIndex, indexBitLength),
    bitLength: PREFIX_BIT_LENGTH + indexBitLength,
  };
}

function decodeSymbolFromGroup(bits: number, group: readonly string[], prefix: number, indexBitLength: number): string | null {
  // отбрасываем младшие биты (индекс), чтобы достать префикс из старших
  const actualPrefix = bits >> indexBitLength;

  if (actualPrefix !== prefix) {
    return null;
  }

  // отбрасываем старшие биты (префикс), чтобы достать индекс из младших
  const symbolIndex = BitStream.unpackValue(bits, indexBitLength);
  return group[symbolIndex] ?? null;
}

export function encodeSymbol(symbol: string): EncodedSymbol {
  for (const { chars, prefix, indexBitLength } of FREQUENCY_GROUPS) {
    const encoding = encodeSymbolFromGroup(symbol, chars, prefix, indexBitLength);

    if (encoding !== null) {
      return encoding;
    }
  }

  const alphabetIndex = ALPHABET.indexOf(symbol);

  if (alphabetIndex === -1) {
    throw new Error(`Символ ${JSON.stringify(symbol)} не поддерживается схемой кодирования`);
  }

  return {
    bits: BitStream.packPrefixAndValue(PREFIX_FALLBACK, alphabetIndex, ALPHABET_INDEX_BIT_LENGTH),
    bitLength: PREFIX_BIT_LENGTH + ALPHABET_INDEX_BIT_LENGTH,
  };
}

export function decodeSymbol(bits: number, bitLength: number): string {
  if (!Number.isInteger(bits) || bits < 0) {
    throw new Error(`Ожидалось неотрицательное целое значение битов, получено: ${bits}`);
  }

  if (!Number.isInteger(bitLength) || bitLength <= 0) {
    throw new Error(`Ожидалась положительная длина в битах, получено: ${bitLength}`);
  }

  // 1 << bitLength это максимум+1 для данного количества бит, например 1 << 4 = 16, а в 4 бита влезает 0..15
  if (bits >= 1 << bitLength) {
    throw new Error(`Значение ${bits} не помещается в ${bitLength} бит`);
  }

  for (const { chars, prefix, indexBitLength } of FREQUENCY_GROUPS) {
    if (bitLength === PREFIX_BIT_LENGTH + indexBitLength) {
      const symbol = decodeSymbolFromGroup(bits, chars, prefix, indexBitLength);

      if (symbol !== null) {
        return symbol;
      }
    }
  }

  if (bitLength === PREFIX_BIT_LENGTH + ALPHABET_INDEX_BIT_LENGTH) {
    // сдвигаем вправо на длину индекса, чтобы остался только префикс в старших битах
    const prefix = bits >> ALPHABET_INDEX_BIT_LENGTH;

    if (prefix !== PREFIX_FALLBACK) {
      throw new Error(`Некорректный fallback-префикс: ${prefix}`);
    }

    const symbolIndex = BitStream.unpackValue(bits, ALPHABET_INDEX_BIT_LENGTH);
    const symbol = ALPHABET[symbolIndex];

    if (symbol === undefined) {
      throw new Error(`Индекс ${symbolIndex} выходит за пределы ALPHABET`);
    }

    return symbol;
  }

  throw new Error(`Длина ${bitLength} бит не соответствует ни одному формату символа`);
}

export function encodeText(text: string): EncodedText {
  const encodedSymbols = [...text].map(encodeSymbol);
  const bitLength = encodedSymbols.reduce((sum, s) => sum + s.bitLength, 0);
  const stream = BitStream.forWrite(bitLength);

  for (const { bits, bitLength } of encodedSymbols) {
    stream.writeBits(bits, bitLength);
  }

  return {
    bytes: stream.toUint8Array(),
    bitLength,
  };
}

export function decodeText(bytes: Uint8Array, bitLength: number): string {
  const stream = BitStream.forRead(bytes, bitLength);
  let result = "";

  while (stream.hasMoreBits()) {
    const prefix = stream.readBits(PREFIX_BIT_LENGTH);
    const indexBitLength = PREFIX_TO_INDEX_BIT_LENGTH.get(prefix);

    if (indexBitLength === undefined) {
      throw new Error(`Неизвестный префикс: ${prefix}`);
    }

    const packed = stream.readPackedWithKnownPrefix(prefix, PREFIX_BIT_LENGTH, indexBitLength);
    result += decodeSymbol(packed.bits, packed.bitLength);
  }

  return result;
}

for (const symbol of ALPHABET) {
  encodeSymbol(symbol);
}