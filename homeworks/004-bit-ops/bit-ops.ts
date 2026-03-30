export function cyclicLeftShift(num: number, shift: number): number {
  // потому что числа становятся int32 при битовых операциях
  if (shift % 32 === 0) {
    return num >>> 0;
  }

  const normalizedShift = (shift | 0) % 32;

  if (normalizedShift < 0) {
    return cyclicRightShift(num, -normalizedShift);
  }

  // сдвигаем число влево на shift и добавляем к нему результат логического сдвига числа вправо на (32 - shift)
  return ((num << normalizedShift) | (num >>> (32 - normalizedShift))) >>> 0;
}

export function cyclicRightShift(num: number, shift: number): number {
  // потому что числа становятся int32 при битовых операциях
  if (shift % 32 === 0) {
    return num >>> 0;
  }

  const normalizedShift = (shift | 0) % 32;

  if (normalizedShift < 0) {
    return cyclicLeftShift(num, -normalizedShift);
  }

  // сдвигаем число логически вправо на shift и добавляем к нему результат сдвига числа влево на (32 - shift)
  // >>> — вызывает ToUint32 → старший бит = просто бит => для корректного сравнения с float64 числами
  return ((num >>> normalizedShift) | (num << (32 - normalizedShift))) >>> 0;
}
