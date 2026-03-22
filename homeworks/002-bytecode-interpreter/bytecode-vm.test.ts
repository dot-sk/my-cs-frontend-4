import { describe, expect, test } from "bun:test";

import {
  INSTRUCTIONS as I,
  VM,
  allSounds,
  opcodeNames,
  soundFiles,
  type Pattern,
  type Runtime,
} from "./bytecode-vm";

type LogEntry = { type: "print" | "play"; pattern: Pattern };

function makeVm() {
  const log: LogEntry[] = [];
  const runtime: Runtime = {
    play(pattern) {
      log.push({ type: "play", pattern });
    },
    print(pattern) {
      log.push({ type: "print", pattern });
    },
  };
  const vm = new VM(runtime);
  return { vm, log };
}

function expectPattern(p: Pattern, expected: Pattern) {
  expect(p.bpm).toBe(expected.bpm);
  expect(p.loops).toBe(expected.loops);
  expect(p.steps.length).toBe(expected.steps.length);
  for (let i = 0; i < expected.steps.length; i++) {
    expect(p.steps[i]!.sounds).toEqual(expected.steps[i]!.sounds);
    expect(p.steps[i]!.accent).toBe(expected.steps[i]!.accent);
  }
}

describe("002-bytecode-interpreter: VM", () => {
  describe("lifecycle and step", () => {
    test("пустая программа: step сразу false, runtime не вызывается", () => {
      // Arrange
      const { vm, log } = makeVm();
      vm.load([]);

      // Act
      const hasMore = vm.step();

      // Assert
      expect(hasMore).toBe(false);
      expect(log.length).toBe(0);
    });

    test("после последней инструкции step возвращает false", () => {
      // Arrange
      const { vm } = makeVm();
      vm.load([I.REST]);

      // Act
      const afterRest = vm.step();
      const afterEnd = vm.step();

      // Assert
      expect(afterRest).toBe(false);
      expect(afterEnd).toBe(false);
    });

    test("PRINT без звуков: пустой steps и дефолты bpm/loops", () => {
      // Arrange
      const { vm, log } = makeVm();
      const program = [I.PRINT];

      // Act
      vm.load(program);
      vm.run();

      // Assert
      expect(log).toEqual([
        {
          type: "print",
          pattern: { bpm: 120, loops: 1, steps: [] },
        },
      ]);
    });

    test("PLAY без звуков: пустой steps и дефолты", () => {
      // Arrange
      const { vm, log } = makeVm();
      const program = [I.PLAY];

      // Act
      vm.load(program);
      vm.run();

      // Assert
      expect(log).toEqual([
        {
          type: "play",
          pattern: { bpm: 120, loops: 1, steps: [] },
        },
      ]);
    });
  });

  describe("BPM and LOOP boundaries", () => {
    test("BPM 60 и 240 принимаются", () => {
      // Arrange
      const program60 = [I.BPM, 60, I.PRINT];
      const program240 = [I.BPM, 240, I.PRINT];
      const vm60 = makeVm();
      const vm240 = makeVm();

      // Act
      vm60.vm.load(program60);
      vm60.vm.run();
      vm240.vm.load(program240);
      vm240.vm.run();

      // Assert
      expect(vm60.log[0]!.pattern.bpm).toBe(60);
      expect(vm240.log[0]!.pattern.bpm).toBe(240);
    });

    test("BPM 59 и 241: BPM out of range", () => {
      // Arrange
      const { vm: vm59 } = makeVm();
      vm59.load([I.BPM, 59, I.PRINT]);
      const { vm: vm241 } = makeVm();
      vm241.load([I.BPM, 241, I.PRINT]);

      // Act
      const run59 = () => vm59.run();
      const run241 = () => vm241.run();

      // Assert
      expect(run59).toThrow("BPM out of range");
      expect(run241).toThrow("BPM out of range");
    });

    test("LOOP 1 принимается", () => {
      // Arrange
      const { vm, log } = makeVm();
      const program = [I.LOOP, 1, I.PRINT];

      // Act
      vm.load(program);
      vm.run();

      // Assert
      expect(log[0]!.pattern.loops).toBe(1);
    });

    test("LOOP 0: Loop count must be >= 1", () => {
      // Arrange
      const { vm } = makeVm();
      vm.load([I.LOOP, 0, I.PRINT]);

      // Act
      const run = () => vm.run();

      // Assert
      expect(run).toThrow("Loop count must be >= 1");
    });

    test("load сбрасывает состояние", () => {
      // Arrange
      const { vm } = makeVm();
      vm.load([I.BPM, 180, I.LOOP, 3]);

      // Act
      vm.run();
      const afterFirst = { bpm: vm.bpm, loops: vm.loops };
      vm.load([I.PRINT]);
      vm.run();
      const afterSecond = { bpm: vm.bpm, loops: vm.loops };

      // Assert
      expect(afterFirst.bpm).toBe(180);
      expect(afterFirst.loops).toBe(3);
      expect(afterSecond.bpm).toBe(120);
      expect(afterSecond.loops).toBe(1);
    });
  });

  describe("missing BPM/LOOP args by RFC", () => {
    test("[BPM] без аргумента падает", () => {
      // Arrange
      const { vm } = makeVm();
      vm.load([I.BPM]);

      // Act
      const run = () => vm.run();

      // Assert
      expect(run).toThrow();
    });

    test("[LOOP] без аргумента падает", () => {
      // Arrange
      const { vm } = makeVm();
      vm.load([I.LOOP]);

      // Act
      const run = () => vm.run();

      // Assert
      expect(run).toThrow();
    });
  });

  describe("step building and REST", () => {
    test("KICK и HIHAT подряд — один шаг", () => {
      // Arrange
      const { vm, log } = makeVm();
      const program = [I.KICK, I.HIHAT, I.PRINT];

      // Act
      vm.load(program);
      vm.run();

      // Assert
      expectPattern(log[0]!.pattern, {
        bpm: 120,
        loops: 1,
        steps: [{ sounds: [I.KICK, I.HIHAT], accent: false }],
      });
    });

    test("KICK REST HIHAT — два шага", () => {
      // Arrange
      const { vm, log } = makeVm();
      const program = [I.KICK, I.REST, I.HIHAT, I.PRINT];

      // Act
      vm.load(program);
      vm.run();

      // Assert
      expectPattern(log[0]!.pattern, {
        bpm: 120,
        loops: 1,
        steps: [
          { sounds: [I.KICK], accent: false },
          { sounds: [I.HIHAT], accent: false },
        ],
      });
    });

    test("REST REST — два пустых шага", () => {
      // Arrange
      const { vm, log } = makeVm();
      const program = [I.REST, I.REST, I.PRINT];

      // Act
      vm.load(program);
      vm.run();

      // Assert
      expectPattern(log[0]!.pattern, {
        bpm: 120,
        loops: 1,
        steps: [
          { sounds: [], accent: false },
          { sounds: [], accent: false },
        ],
      });
    });

    test("два KICK подряд — два шага по одному KICK", () => {
      // Arrange
      const { vm, log } = makeVm();
      const program = [I.KICK, I.KICK, I.PRINT];

      // Act
      vm.load(program);
      vm.run();

      // Assert
      expectPattern(log[0]!.pattern, {
        bpm: 120,
        loops: 1,
        steps: [
          { sounds: [I.KICK], accent: false },
          { sounds: [I.KICK], accent: false },
        ],
      });
    });

    test("программа заканчивается на звуке без REST — хвост добивается в run и виден в PRINT", () => {
      // Arrange
      const { vm, log } = makeVm();
      const program = [I.KICK, I.PRINT];

      // Act
      vm.load(program);
      vm.run();

      // Assert
      expectPattern(log[0]!.pattern, {
        bpm: 120,
        loops: 1,
        steps: [{ sounds: [I.KICK], accent: false }],
      });
    });
  });

  describe("ACCENT behavior (observable)", () => {
    test("ACCENT перед звуком — accent на шаге", () => {
      // Arrange
      const { vm, log } = makeVm();
      const program = [I.ACCENT, I.KICK, I.PRINT];

      // Act
      vm.load(program);
      vm.run();

      // Assert
      expect(log[0]!.pattern.steps[0]!.accent).toBe(true);
    });

    test("ACCENT, два звука на шаге — accent true на всем шаге", () => {
      // Arrange
      const { vm, log } = makeVm();
      const program = [I.ACCENT, I.KICK, I.HIHAT, I.PRINT];

      // Act
      vm.load(program);
      vm.run();

      // Assert
      expect(log[0]!.pattern.steps[0]!.accent).toBe(true);
    });

    test("ACCENT REST SNARE — акцент на звуке после пустого шага", () => {
      // Arrange
      const { vm, log } = makeVm();
      const program = [I.ACCENT, I.REST, I.SNARE, I.PRINT];

      // Act
      vm.load(program);
      vm.run();

      // Assert
      expectPattern(log[0]!.pattern, {
        bpm: 120,
        loops: 1,
        steps: [
          { sounds: [], accent: false },
          { sounds: [I.SNARE], accent: true },
        ],
      });
    });
  });

  describe("PRINT/PLAY snapshots", () => {
    test("хвост звуков перед PRINT попадает в steps", () => {
      // Arrange
      const { vm, log } = makeVm();
      const program = [I.KICK, I.PRINT];

      // Act
      vm.load(program);
      vm.run();

      // Assert
      expect(log[0]!.pattern.steps.length).toBe(1);
      expect(log[0]!.pattern.steps[0]!.sounds).toEqual([I.KICK]);
    });

    test("PRINT затем PLAY — порядок вызовов и одинаковый накопленный паттерн", () => {
      // Arrange
      const { vm, log } = makeVm();
      const program = [
        I.BPM,
        120,
        I.KICK,
        I.HIHAT,
        I.REST,
        I.REST,
        I.HIHAT,
        I.REST,
        I.ACCENT,
        I.SNARE,
        I.HIHAT,
        I.REST,
        I.LOOP,
        4,
        I.PRINT,
        I.PLAY,
      ];
      const expected: Pattern = {
        bpm: 120,
        loops: 4,
        steps: [
          { sounds: [I.KICK, I.HIHAT], accent: false },
          { sounds: [], accent: false },
          { sounds: [I.HIHAT], accent: false },
          { sounds: [I.SNARE, I.HIHAT], accent: true },
        ],
      };

      // Act
      vm.load(program);
      vm.run();

      // Assert
      expect(log.length).toBe(2);
      expect(log[0]!.type).toBe("print");
      expect(log[1]!.type).toBe("play");
      expectPattern(log[0]!.pattern, expected);
      expectPattern(log[1]!.pattern, expected);
    });

    test("снимок не меняется после последующего load/run", () => {
      // Arrange
      const { vm, log } = makeVm();
      const firstProgram = [I.KICK, I.PLAY];
      const secondProgram = [I.SNARE];

      // Act
      vm.load(firstProgram);
      vm.run();
      const snapshotAfterFirst = JSON.stringify(log[0]!.pattern);

      vm.load(secondProgram);
      vm.run();

      // Assert
      expect(JSON.stringify(log[0]!.pattern)).toBe(snapshotAfterFirst);
    });
  });

  describe("unknown opcodes", () => {
    test("0x0F — Unknown opcode 0x0f", () => {
      // Arrange
      const { vm } = makeVm();
      vm.load([0x0f]);

      // Act
      const run = () => vm.run();

      // Assert
      expect(run).toThrow("Unknown opcode 0x0f");
    });

    test("0x15 без семпла — Unknown opcode", () => {
      // Arrange
      const { vm } = makeVm();
      vm.load([0x15]);

      // Act
      const run = () => vm.run();

      // Assert
      expect(run).toThrow("Unknown opcode 0x15");
    });
  });

  describe("optional export smoke", () => {
    test("opcodeNames для известных кодов", () => {
      // Arrange
      const kickCode = I.KICK;
      const restCode = I.REST;

      // Act
      const kickName = opcodeNames[kickCode];
      const restName = opcodeNames[restCode];

      // Assert
      expect(kickName).toBe("KICK");
      expect(restName).toBe("REST");
    });

    test("allSounds совпадает с ключами soundFiles", () => {
      // Arrange
      const keys = Object.keys(soundFiles)
        .map(Number)
        .sort((a, b) => a - b);

      // Act
      const sortedAllSounds = [...allSounds].sort((a, b) => a - b);

      // Assert
      expect(sortedAllSounds).toEqual(keys);
    });
  });
});
