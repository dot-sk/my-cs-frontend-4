/**
 * Виртуальная машина байткода в стиле драм-машины TR-808
 *
 * Программа — массив чисел; VM ходит по ней (ip), исполняет инструкции
 * и при PLAY/PRINT вызывает переданный Runtime (побочные эффекты в момент исполнения)
 */

/**
 * Набор инструкций
 *
 * два диапазона кодов:
 * - 0x00..0x0F — управляющие команды (фиксированный набор)
 * - 0x10..0x1F — звуки (можно расширять)
 */
export const INSTRUCTIONS = {
  // управляющие команды
  REST: 0x00, // разделитель шагов
  LOOP: 0x01, // +аргумент: сколько раз повторить паттерн
  BPM: 0x02, // +аргумент: темп (60-240)
  ACCENT: 0x03, // следующий шаг будет громче
  PLAY: 0x04, // плэй
  PRINT: 0x05, // напечатать паттерн

  // звуки
  KICK: 0x10, // Бас-бочка
  SNARE: 0x11, // Малый барабан
  HIHAT: 0x12, // Хай-хэт
  OPEN_HH: 0x13, // Открытый хай-хэт
  CLAP: 0x14, // Хлопок
} as const;

/** Маппинг звуков на wav-файлы */
export const soundFiles: Record<number, string> = {
  [INSTRUCTIONS.KICK]: "Kick Basic.wav",
  [INSTRUCTIONS.SNARE]: "Snare Mid.wav",
  [INSTRUCTIONS.HIHAT]: "Hihat.wav",
  [INSTRUCTIONS.OPEN_HH]: "Open Hat Short.wav",
  [INSTRUCTIONS.CLAP]: "Clap.wav",
};

/** Обратный маппинг */
export const opcodeNames: Record<number, string> = Object.fromEntries(
  Object.entries(INSTRUCTIONS).map(([name, code]) => [code, name]),
);

/** Все звуковые опкоды */
export const allSounds = Object.keys(soundFiles).map(Number);

function isSound(opcode: number): boolean {
  return opcode >= 0x10;
}

export type Step = {
  sounds: number[];
  accent: boolean;
};

export type Pattern = {
  bpm: number;
  loops: number;
  steps: Step[];
};

/** Побочные эффекты исполнения PLAY / PRINT (внедряется снаружи) */
export interface Runtime {
  play(pattern: Pattern): void;
  print(pattern: Pattern): void;
}

export class VM {
  private program: number[] = [];

  ip = 0;
  bpm = 120;
  loops = 1;
  accent = false;
  private steps: Step[] = [];
  private currentStep: Step = { sounds: [], accent: false };

  constructor(private readonly runtime: Runtime) {}

  /** Загрузить программу и сбросить состояние исполнения */
  load(program: number[]) {
    this.program = [...program];
    this.ip = 0;
    this.bpm = 120;
    this.loops = 1;
    this.accent = false;
    this.steps = [];
    this.currentStep = { sounds: [], accent: false };
  }

  /** Выполнить одну инструкцию. true — если после этого ещё есть код */
  step(): boolean {
    if (this.ip >= this.program.length) return false;

    const I = INSTRUCTIONS;
    const opcode = this.program[this.ip]!;

    switch (opcode) {
      case I.BPM: {
        if (this.ip + 1 >= this.program.length) {
          throw new SyntaxError("BPM requires an argument");
        }
        const value = this.program[this.ip + 1]!;
        if (value < 60 || value > 240)
          throw new SyntaxError("BPM out of range");
        this.bpm = value;
        this.ip += 2;
        break;
      }

      case I.LOOP: {
        if (this.ip + 1 >= this.program.length) {
          throw new SyntaxError("LOOP requires an argument");
        }
        const value = this.program[this.ip + 1]!;
        if (value < 1) throw new SyntaxError("Loop count must be >= 1");
        this.loops = value;
        this.ip += 2;
        break;
      }

      case I.ACCENT: {
        this.accent = true;
        this.ip += 1;
        break;
      }

      case I.REST: {
        this.steps.push(this.currentStep);
        this.currentStep = { sounds: [], accent: false };
        this.ip += 1;
        break;
      }

      case I.PRINT: {
        this.finishStep();
        this.runtime.print(this.snapshotPattern());
        this.ip += 1;
        break;
      }

      case I.PLAY: {
        this.finishStep();
        this.runtime.play(this.snapshotPattern());
        this.ip += 1;
        break;
      }

      default: {
        if (isSound(opcode) && soundFiles[opcode]) {
          if (this.currentStep.sounds.includes(opcode)) {
            this.finishStep();
          }
          this.currentStep.sounds.push(opcode);
          if (this.accent) {
            this.currentStep.accent = true;
            this.accent = false;
          }
          this.ip += 1;
        } else {
          throw new SyntaxError(
            `Unknown opcode 0x${opcode.toString(16).padStart(2, "0")}`,
          );
        }
      }
    }

    return this.ip < this.program.length;
  }

  /** Исполнить до конца программы */
  run() {
    while (this.step()) {}
    this.finishStep();
  }

  private finishStep() {
    if (this.currentStep.sounds.length > 0) {
      this.steps.push(this.currentStep);
    }
    this.currentStep = { sounds: [], accent: false };
  }

  private snapshotPattern(): Pattern {
    return {
      bpm: this.bpm,
      loops: this.loops,
      steps: this.steps.map((s) => ({ ...s, sounds: [...s.sounds] })),
    };
  }
}
