// ============================================================
// audio.ts — Web Audio API で音を鳴らす小さなエンジン
// ピアノっぽく聞こえるように、基音＋倍音を重ねて減衰させる
// 音の長さは「タン」ではなく「ターン」と響くくらい長め（約2.4秒）
//
// 音割れ対策：
//  - 倍音の合計が 1.0 を超えないよう正規化し、ピークに余裕を持たせる
//  - コンプレッサーでピークを抑える
//  - 音同士は自然に重なってOK（本物のピアノも余韻は重なる）
// ============================================================

let ctx: AudioContext | null = null;
let comp: DynamicsCompressorNode | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    // 出力段にコンプレッサーを挟んで音割れを防ぐ
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 20;
    comp.ratio.value = 8;
    comp.attack.value = 0.003;
    comp.release.value = 0.24;
    comp.connect(ctx.destination);
  }
  // ブラウザの自動再生ポリシー対策：止まっていたら再開する
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

/** MIDIノート番号 → 周波数（A4 = MIDI 69 = 440Hz） */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * 周波数を直接指定して1音鳴らす（440Hzチェック用）
 * @param freq     周波数（Hz）
 * @param duration 音の長さ（秒）
 */
export function playFreq(freq: number, duration = 2.4): void {
  const ac = getCtx();
  const t0 = ac.currentTime;

  // 全体の音量エンベロープ（立ち上がり速く、ゆるやかに減衰）
  // ピークは 0.42：2音重なっても割れない余裕を持たせる
  const master = ac.createGain();
  master.gain.setValueAtTime(0, t0);
  master.gain.linearRampToValueAtTime(0.42, t0 + 0.02);
  master.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  master.connect(comp!);

  // 倍音構成（合計が 1.0 になるよう正規化してある）
  const partials: Array<[number, number]> = [
    [1, 0.6], // 基音
    [2, 0.24], // 2倍音
    [3, 0.11], // 3倍音
    [4, 0.05], // 4倍音
  ];
  for (const [mult, amp] of partials) {
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq * mult;
    const g = ac.createGain();
    g.gain.value = amp;
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }
}

/**
 * 1音鳴らす
 * @param midi     MIDIノート番号（60 = C4 = ド）
 * @param duration 音の長さ（秒）
 */
export function playNote(midi: number, duration = 2.4): void {
  playFreq(midiToFreq(midi), duration);
}

// ---- 音名テーブル ----
export const NOTE_NAMES_JA = [
  'ド', 'ド♯', 'レ', 'レ♯', 'ミ', 'ファ', 'ファ♯', 'ソ', 'ソ♯', 'ラ', 'ラ♯', 'シ',
];
export const NOTE_NAMES_EN = [
  'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B',
];

/** 例： noteLabel(60) → "ド（C4）" */
export function noteLabel(midi: number): string {
  const ja = NOTE_NAMES_JA[midi % 12];
  const en = NOTE_NAMES_EN[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${ja}（${en}${octave}）`;
}
