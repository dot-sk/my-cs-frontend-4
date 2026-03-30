export function cyclicLeftShift(num: number, shift: number): number {
  // потому что числа становятся int32 при битовых операциях
  if (shift % 32 === 0) {
    return num >>> 0;
  }

  // сдвигаем число влево на shift и добавляем к нему результат логического сдвига числа вправо на (32 - shift)
  return ((num << shift) | (num >>> (32 - shift))) >>> 0;
}

export function cyclicRightShift(num: number, shift: number): number {
  // потому что числа становятся int32 при битовых операциях
  if (shift % 32 === 0) {
    return num >>> 0;
  }

  // сдвигаем число логически вправо на shift и добавляем к нему результат сдвига числа влево на (32 - shift)
  // >>> — вызывает ToUint32 → старший бит = просто бит => для корректного сравнения с float64 числами
  return ((num >>> shift) | (num << (32 - shift))) >>> 0;
}
