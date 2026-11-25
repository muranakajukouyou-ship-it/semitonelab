import { useState } from 'react';
import { playNote, playFreq, noteLabel, NOTE_NAMES_JA } from './audio';

// ============================================================
// 半音ラボ — 音感トレーナー
// 「頭の中の音程が半音ずれる」癖を補正するための3モード構成
//   1. 音当て      ：鳴った音を鍵盤で当てる
//   2. 440Hzチェック：鳴った音が440Hzぴったりか、高低を当てる
//   3. 頭の中チェック：音名だけ見て頭で鳴らし、答え合わせ＋ずれ傾向を記録
// ============================================================

const LOW = 60; // C4（ド）
const HIGH = 72; // C5（高いド）
const QUESTIONS = 10; // 1ラウンドの問題数

type Mode = 'quiz' | 'freq' | 'inner';
type Tone = 'good' | 'semi' | 'bad' | '';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ------------------------------------------------------------
// 鍵盤コンポーネント（C4〜C5の1オクターブ＋1音）
// marks: { [midi]: 'correct' | 'wrong' | 'target' } で色付け
// ------------------------------------------------------------
function Piano({
  onKey,
  marks = {},
  disabled = false,
}: {
  onKey: (midi: number) => void;
  marks?: Record<number, 'correct' | 'wrong' | 'target'>;
  disabled?: boolean;
}) {
  const whites = [60, 62, 64, 65, 67, 69, 71, 72];
  // 黒鍵：左端からの位置（白鍵の境目に合わせる）
  const blacks: Array<{ midi: number; afterWhite: number }> = [
    { midi: 61, afterWhite: 0 },
    { midi: 63, afterWhite: 1 },
    { midi: 66, afterWhite: 3 },
    { midi: 68, afterWhite: 4 },
    { midi: 70, afterWhite: 5 },
  ];
  const whiteW = 100 / whites.length;

  return (
    <div className="piano" aria-label="ピアノ鍵盤">
      {whites.map((m) => (
        <button
          key={m}
          type="button"
          className={`white-key mark-${marks[m] ?? 'none'}`}
          disabled={disabled}
          onClick={() => onKey(m)}
        >
          <span className="key-label">{NOTE_NAMES_JA[m % 12]}</span>
        </button>
      ))}
      {blacks.map(({ midi, afterWhite }) => (
        <button
          key={midi}
          type="button"
          aria-label={noteLabel(midi)}
          className={`black-key mark-${marks[midi] ?? 'none'}`}
          style={{ left: `calc(${(afterWhite + 1) * whiteW}% )` }}
          disabled={disabled}
          onClick={() => onKey(midi)}
        />
      ))}
    </div>
  );
}

// ------------------------------------------------------------
// モード1：音当てクイズ
// ------------------------------------------------------------
function QuizMode() {
  const [phase, setPhase] = useState<'idle' | 'asking' | 'feedback' | 'done'>('idle');
  const [target, setTarget] = useState<number>(LOW);
  const [picked, setPicked] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [score, setScore] = useState(0);
  const [semiMiss, setSemiMiss] = useState(0); // 半音だけ外した回数
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<Tone>('');

  const nextQuestion = (n: number) => {
    const t = randInt(LOW, HIGH);
    setTarget(t);
    setPicked(null);
    setTone('');
    setCount(n);
    setPhase('asking');
    setMessage('どの音でしょう？ もう一度聴いてもOK');
    window.setTimeout(() => playNote(t), 200);
  };

  const start = () => {
    setScore(0);
    setSemiMiss(0);
    nextQuestion(1);
  };

  const answer = (midi: number) => {
    if (phase !== 'asking') return;
    setPicked(midi);
    const diff = midi - target;
    if (diff === 0) {
      setScore((s) => s + 1);
      setTone('good');
      setMessage('正解！');
    } else if (Math.abs(diff) === 1) {
      setSemiMiss((s) => s + 1);
      setTone('semi');
      setMessage(
        `惜しい！ 半音${diff > 0 ? '高い' : '低い'}。正解は ${noteLabel(target)}`,
      );
    } else {
      setTone('bad');
      setMessage(`残念… 正解は ${noteLabel(target)} でした`);
    }
    setPhase('feedback');
  };

  const marks: Record<number, 'correct' | 'wrong' | 'target'> = {};
  if (phase === 'feedback' && picked !== null) {
    marks[target] = 'target';
    if (picked !== target) marks[picked] = 'wrong';
  }

  const resultComment =
    score >= 9
      ? 'すごい、ほぼ絶対音感の耳！'
      : score >= 7
        ? 'いい耳してます。この調子！'
        : score >= 5
          ? '半音の壁、もう少しで越えられます'
          : 'まずは「440Hzチェック」で基準の音を体に入れるのがおすすめ';

  return (
    <section className="panel">
      <h2>音当てクイズ</h2>
      <p className="panel-desc">
        鳴った音を鍵盤で当ててください。全{QUESTIONS}問。半音だけ外したら、そのことも教えてくれます。
      </p>

      {phase === 'idle' && (
        <button type="button" className="primary-btn" onClick={start}>
          スタート
        </button>
      )}

      {(phase === 'asking' || phase === 'feedback') && (
        <>
          <div className="status-row">
            <span>
              第 {count} / {QUESTIONS} 問
            </span>
            <span>スコア {score}</span>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => playNote(target)}
            >
              🔊 もう一度聴く
            </button>
          </div>
          <Piano onKey={answer} marks={marks} disabled={phase === 'feedback'} />
          <p
            className={`feedback ${phase === 'feedback' ? 'show' : ''} tone-${tone}`}
          >
            {message}
          </p>
          {phase === 'feedback' && (
            <button
              type="button"
              className="primary-btn"
              onClick={() =>
                count >= QUESTIONS ? setPhase('done') : nextQuestion(count + 1)
              }
            >
              {count >= QUESTIONS ? '結果を見る' : '次の問題へ'}
            </button>
          )}
        </>
      )}

      {phase === 'done' && (
        <div className="result">
          <p className="result-score">
            {QUESTIONS}問中 {score} 問正解
          </p>
          <p>{resultComment}</p>
          <p className="result-semi">
            半音外しは {semiMiss} 回でした。ここが伸びしろです。
          </p>
          <button type="button" className="primary-btn" onClick={start}>
            もう1ラウンド
          </button>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------
// モード2：440Hzチェック
// 鳴った音が「440Hzぴったり／高い／低い」を当てる。
// ずれ幅はセント（半音＝100セント）で 0 / ±25 / ±40 / ±60 から出題。
// 基準の440Hzはいつでも聴き直せる＝耳の基準を作る訓練。
// ------------------------------------------------------------
const CENTS_POOL = [0, 0, -25, 25, -40, 40, -60, 60];

function centsToHz(cents: number): number {
  return 440 * Math.pow(2, cents / 1200);
}

function FreqMode() {
  const [phase, setPhase] = useState<'idle' | 'asking' | 'feedback' | 'done'>('idle');
  const [cents, setCents] = useState(0);
  const [count, setCount] = useState(0);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState('');
  const [tone, setTone] = useState<Tone>('');

  const nextQuestion = (n: number) => {
    const c = CENTS_POOL[randInt(0, CENTS_POOL.length - 1)];
    setCents(c);
    setTone('');
    setCount(n);
    setPhase('asking');
    setMessage('この音、440Hz（ラ）ぴったりでしょうか？');
    window.setTimeout(() => playFreq(centsToHz(c)), 200);
  };

  const start = () => {
    setScore(0);
    nextQuestion(1);
  };

  const answer = (a: -1 | 0 | 1) => {
    if (phase !== 'asking') return;
    const actual = cents === 0 ? 0 : cents > 0 ? 1 : -1;
    const hzText = `${centsToHz(cents).toFixed(1)}Hz`;
    const centsText =
      cents === 0 ? 'ぴったり440Hz' : `${cents > 0 ? '+' : ''}${cents}セント`;
    if (a === actual) {
      setScore((s) => s + 1);
      setTone('good');
      setMessage(`正解！ 実際は ${hzText}（${centsText}）でした`);
    } else if (a === 0 && Math.abs(cents) === 25) {
      setTone('semi');
      setMessage(
        `惜しい！ わずかに${cents > 0 ? '高い' : '低い'}音でした（${hzText}／${centsText}）`,
      );
    } else {
      setTone('bad');
      setMessage(`残念… 実際は ${hzText}（${centsText}）でした`);
    }
    setPhase('feedback');
  };

  return (
    <section className="panel">
      <h2>440Hzチェック</h2>
      <p className="panel-desc">
        鳴った音が、基準のラ（A4＝440Hz）ぴったりか、高いか低いかを当ててください。
        「基準の440Hz」ボタンでいつでも本物を聴き直せます。
      </p>

      {phase === 'idle' && (
        <>
          <button
            type="button"
            className="ghost-btn"
            onClick={() => playFreq(440)}
            style={{ marginBottom: 14 }}
          >
            🔊 まず基準の440Hzを聴く
          </button>
          <br />
          <button type="button" className="primary-btn" onClick={start}>
            スタート
          </button>
        </>
      )}

      {(phase === 'asking' || phase === 'feedback') && (
        <>
          <div className="status-row">
            <span>
              第 {count} / {QUESTIONS} 問
            </span>
            <span>スコア {score}</span>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => playFreq(centsToHz(cents))}
            >
              🔊 もう一度聴く
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => playFreq(440)}
            >
              基準の440Hz
            </button>
          </div>
          <div className="choice-row">
            <button
              type="button"
              className="choice-btn"
              disabled={phase === 'feedback'}
              onClick={() => answer(-1)}
            >
              低い
            </button>
            <button
              type="button"
              className="choice-btn"
              disabled={phase === 'feedback'}
              onClick={() => answer(0)}
            >
              ぴったり440Hz
            </button>
            <button
              type="button"
              className="choice-btn"
              disabled={phase === 'feedback'}
              onClick={() => answer(1)}
            >
              高い
            </button>
          </div>
          <p
            className={`feedback ${phase === 'feedback' ? 'show' : ''} tone-${tone}`}
          >
            {message}
          </p>
          {phase === 'feedback' && (
            <button
              type="button"
              className="primary-btn"
              onClick={() =>
                count >= QUESTIONS ? setPhase('done') : nextQuestion(count + 1)
              }
            >
              {count >= QUESTIONS ? '結果を見る' : '次の問題へ'}
            </button>
          )}
        </>
      )}

      {phase === 'done' && (
        <div className="result">
          <p className="result-score">
            {QUESTIONS}問中 {score} 問正解
          </p>
          <p>
            {score >= 8
              ? '440Hzの基準が体に入ってます。調律師の耳！'
              : score >= 5
                ? '基準の音が掴めてきました'
                : 'まずは基準の440Hzを何度も聴いて、体に覚えさせるのが近道です'}
          </p>
          <button type="button" className="primary-btn" onClick={start}>
            もう1ラウンド
          </button>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------
// モード3：頭の中チェック（このアプリの目玉）
// 頭の中で鳴らした音と本物の音を比べて、ずれ方を自己申告。
// 記録が貯まると「自分のずれの傾向」が見える＝補正の手がかり。
// ------------------------------------------------------------
type InnerKind = 'match' | 'low' | 'high' | 'off';
type InnerStats = Record<InnerKind, number>;

const INNER_KEY = 'semitone-lab-inner-stats';
const INNER_BUTTONS: Array<{ kind: InnerKind; label: string }> = [
  { kind: 'match', label: '合ってた' },
  { kind: 'low', label: '半音低かった' },
  { kind: 'high', label: '半音高かった' },
  { kind: 'off', label: '全然違った' },
];

function loadInnerStats(): InnerStats {
  try {
    const raw = localStorage.getItem(INNER_KEY);
    if (raw) return { match: 0, low: 0, high: 0, off: 0, ...JSON.parse(raw) };
  } catch {
    /* 読めなければ初期値で始める */
  }
  return { match: 0, low: 0, high: 0, off: 0 };
}

function InnerMode() {
  const [target, setTarget] = useState(() => randInt(LOW, HIGH));
  const [phase, setPhase] = useState<'imagine' | 'rated'>('imagine');
  const [played, setPlayed] = useState(false);
  const [stats, setStats] = useState<InnerStats>(loadInnerStats);
  const [lastMessage, setLastMessage] = useState('');
  const [tone, setTone] = useState<Tone>('');

  const total = stats.match + stats.low + stats.high + stats.off;

  const rate = (kind: InnerKind) => {
    const next = { ...stats, [kind]: stats[kind] + 1 };
    setStats(next);
    try {
      localStorage.setItem(INNER_KEY, JSON.stringify(next));
    } catch {
      /* 保存できなくても続行 */
    }
    setTone(kind === 'match' ? 'good' : kind === 'off' ? 'bad' : 'semi');
    setLastMessage(
      kind === 'match'
        ? '頭の中の音、ぴったりでした！'
        : kind === 'low'
          ? '頭の中の音が半音低かった。次は半音高めにイメージしてみましょう'
          : kind === 'high'
            ? '頭の中の音が半音高かった。次は半音低めにイメージしてみましょう'
            : '今日はたまたま。続けると傾向が見えてきます',
    );
    setPhase('rated');
  };

  const next = () => {
    setTarget(randInt(LOW, HIGH));
    setPlayed(false);
    setPhase('imagine');
  };

  const resetStats = () => {
    const zero: InnerStats = { match: 0, low: 0, high: 0, off: 0 };
    setStats(zero);
    try {
      localStorage.removeItem(INNER_KEY);
    } catch {
      /* noop */
    }
  };

  // 傾向コメント：いちばん多いずれ方を指摘する
  const tendency = (() => {
    if (total < 3) return 'あと少し記録が貯まると、あなたの「ずれの傾向」が表示されます。';
    const entries: Array<[InnerKind, number]> = [
      ['low', stats.low],
      ['high', stats.high],
      ['match', stats.match],
      ['off', stats.off],
    ];
    entries.sort((a, b) => b[1] - a[1]);
    const [topKind, topCount] = entries[0];
    const pct = Math.round((topCount / total) * 100);
    if (topKind === 'match') return `今のところ「合ってた」が最多（${pct}%）。頭の中の音、育ってます。`;
    if (topKind === 'low')
      return `傾向：頭の中の音が「半音低い」ことが多いです（${pct}%）。歌う前に半音高めをイメージするのが補正のコツ。`;
    if (topKind === 'high')
      return `傾向：頭の中の音が「半音高い」ことが多いです（${pct}%）。歌う前に半音低めをイメージするのが補正のコツ。`;
    return '傾向：まだバラつきが大きいです。音当てと並行すると安定してきます。';
  })();

  return (
    <section className="panel">
      <h2>頭の中チェック</h2>
      <p className="panel-desc">
        音名だけを見て、まず頭の中でその音を鳴らしてください（声に出してもOK）。
        そのあと本物の音を聴いて、どれくらい合っていたかを申告します。
      </p>

      <div className="inner-target">
        <span className="inner-target-label">頭の中で鳴らす音</span>
        <span className="inner-target-note">{noteLabel(target)}</span>
      </div>

      {phase === 'imagine' && (
        <>
          <button
            type="button"
            className="primary-btn"
            onClick={() => {
              playNote(target);
              setPlayed(true);
            }}
          >
            🔊 答え合わせ（本物の音を聴く）
          </button>
          {played && (
            <div className="choice-row">
              {INNER_BUTTONS.map(({ kind, label }) => (
                <button
                  key={kind}
                  type="button"
                  className="choice-btn"
                  onClick={() => rate(kind)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {phase === 'rated' && (
        <>
          <p className={`feedback show tone-${tone}`}>{lastMessage}</p>
          <button type="button" className="primary-btn" onClick={next}>
            次の音へ
          </button>
        </>
      )}

      <div className="inner-stats">
        <h3>あなたの記録（{total}回）</h3>
        <div className="stat-grid">
          <div>
            <span className="stat-num">{stats.match}</span>
            <span className="stat-label">合ってた</span>
          </div>
          <div>
            <span className="stat-num">{stats.low}</span>
            <span className="stat-label">半音低かった</span>
          </div>
          <div>
            <span className="stat-num">{stats.high}</span>
            <span className="stat-label">半音高かった</span>
          </div>
          <div>
            <span className="stat-num">{stats.off}</span>
            <span className="stat-label">全然違った</span>
          </div>
        </div>
        <p className="tendency">{tendency}</p>
        {total > 0 && (
          <button type="button" className="ghost-btn" onClick={resetStats}>
            記録をリセット
          </button>
        )}
      </div>
    </section>
  );
}

// ------------------------------------------------------------
// アプリ全体
// ------------------------------------------------------------
const MODES: Array<{ id: Mode; label: string }> = [
  { id: 'quiz', label: '音当て' },
  { id: 'freq', label: '440Hzチェック' },
  { id: 'inner', label: '頭の中チェック' },
];

export default function App() {
  const [mode, setMode] = useState<Mode>('quiz');

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo-script">Semitone Lab</div>
        <h1>半音ラボ</h1>
        <p className="app-subtitle">
          頭の中の音程の「半音ずれ」を補正する、シンプルな音感トレーナー
        </p>
      </header>

      <nav className="mode-tabs">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`tab ${mode === m.id ? 'active' : ''}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </nav>

      <main>
        {mode === 'quiz' && <QuizMode />}
        {mode === 'freq' && <FreqMode />}
        {mode === 'inner' && <InnerMode />}
      </main>

      <footer className="app-footer">
        <p>
          音は Web Audio API でその場で合成しています（音源ファイル不使用）。
          基準ピッチ A4 = 440Hz。
        </p>
      </footer>
    </div>
  );
}
