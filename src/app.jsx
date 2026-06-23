import React, { useState, useEffect, useRef, useCallback } from "react";

/* =========================================================================
   Fala, Papagaio! — prática de pronúncia em inglês para crianças
   - O app fala a frase (speechSynthesis)
   - A criança repete no microfone (SpeechRecognition)
   - Avalia a pronúncia palavra por palavra e dá estrelas (estilo Duolingo)
   ========================================================================= */

const PHRASES = [
  { en: "Hello!", pt: "Olá!", emoji: "👋" },
  { en: "Good morning.", pt: "Bom dia.", emoji: "🌞" },
  { en: "Thank you.", pt: "Obrigado.", emoji: "🙏" },
  { en: "How are you?", pt: "Como você está?", emoji: "😊" },
  { en: "I like apples.", pt: "Eu gosto de maçãs.", emoji: "🍎" },
  { en: "The cat is happy.", pt: "O gato está feliz.", emoji: "🐱" },
  { en: "What is your name?", pt: "Qual é o seu nome?", emoji: "🙋" },
  { en: "I love my family.", pt: "Eu amo minha família.", emoji: "❤️" },
  { en: "Let's play together.", pt: "Vamos brincar juntos.", emoji: "🧸" },
  { en: "See you tomorrow.", pt: "Até amanhã.", emoji: "👋" },
];

/* ---------- gerador de frases dinâmicas (offline, por templates) ---------- */
const NOUNS = [
  { en: "apple", pt: "maçã", g: "f", emoji: "🍎" },
  { en: "banana", pt: "banana", g: "f", emoji: "🍌" },
  { en: "dog", pt: "cachorro", g: "m", emoji: "🐶" },
  { en: "cat", pt: "gato", g: "m", emoji: "🐱" },
  { en: "ball", pt: "bola", g: "f", emoji: "⚽" },
  { en: "book", pt: "livro", g: "m", emoji: "📖" },
  { en: "car", pt: "carro", g: "m", emoji: "🚗" },
  { en: "fish", pt: "peixe", g: "m", emoji: "🐟" },
  { en: "bird", pt: "passarinho", g: "m", emoji: "🐦" },
  { en: "flower", pt: "flor", g: "f", emoji: "🌸" },
  { en: "house", pt: "casa", g: "f", emoji: "🏠" },
  { en: "tree", pt: "árvore", g: "f", emoji: "🌳" },
  { en: "star", pt: "estrela", g: "f", emoji: "⭐" },
  { en: "duck", pt: "pato", g: "m", emoji: "🦆" },
];
const ADJS = [
  { en: "happy", pt: { m: "feliz", f: "feliz" }, emoji: "😊" },
  { en: "big", pt: { m: "grande", f: "grande" }, emoji: "🐘" },
  { en: "small", pt: { m: "pequeno", f: "pequena" }, emoji: "🐭" },
  { en: "red", pt: { m: "vermelho", f: "vermelha" }, emoji: "🔴" },
  { en: "blue", pt: { m: "azul", f: "azul" }, emoji: "🔵" },
  { en: "funny", pt: { m: "engraçado", f: "engraçada" }, emoji: "🤡" },
];
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const enArticle = (w) => (/^[aeiou]/i.test(w) ? "an" : "a");

// Cada template recebe um substantivo (n) e um adjetivo (a) e devolve { en, pt, emoji }
const TEMPLATES = [
  (n) => ({ en: `I see ${enArticle(n.en)} ${n.en}.`, pt: `Eu vejo ${n.g === "f" ? "uma" : "um"} ${n.pt}.`, emoji: n.emoji }),
  (n) => ({ en: `I have ${enArticle(n.en)} ${n.en}.`, pt: `Eu tenho ${n.g === "f" ? "uma" : "um"} ${n.pt}.`, emoji: n.emoji }),
  (n) => ({ en: `This is my ${n.en}.`, pt: `${n.g === "f" ? "Esta é minha" : "Este é meu"} ${n.pt}.`, emoji: n.emoji }),
  (n) => ({ en: `I like the ${n.en}.`, pt: `Eu gosto d${n.g === "f" ? "a" : "o"} ${n.pt}.`, emoji: n.emoji }),
  (n, a) => ({ en: `The ${n.en} is ${a.en}.`, pt: `${n.g === "f" ? "A" : "O"} ${n.pt} é ${a.pt[n.g]}.`, emoji: a.emoji }),
];

const makePhrase = () => rand(TEMPLATES)(rand(NOUNS), rand(ADJS));

function generateRound(n = 10) {
  const out = [];
  const seen = new Set();
  let guard = 0;
  while (out.length < n && guard < 300) {
    guard++;
    const p = makePhrase();
    if (seen.has(p.en)) continue;
    seen.add(p.en);
    out.push(p);
  }
  return out;
}

/* ---------- avaliação de pronúncia ---------- */
const normalize = (s) =>
  s.toLowerCase().replace(/[^a-z0-9\s']/g, " ").replace(/\s+/g, " ").trim();
const tokenize = (s) => normalize(s).split(" ").filter(Boolean);

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
  return d[m][n];
}
const wordSim = (a, b) =>
  a === b ? 1 : 1 - levenshtein(a, b) / Math.max(a.length, b.length);

function scoreAttempt(target, said) {
  const tw = tokenize(target);
  const sw = tokenize(said);
  if (sw.length === 0) return { ratio: 0, matched: tw.map((w) => ({ word: w, ok: false })) };
  const used = new Array(sw.length).fill(false);
  const matched = tw.map((word) => {
    let bestI = -1, best = 0;
    sw.forEach((w, i) => {
      if (used[i]) return;
      const sim = wordSim(word, w);
      if (sim > best) { best = sim; bestI = i; }
    });
    if (best >= 0.7 && bestI >= 0) { used[bestI] = true; return { word, ok: true }; }
    return { word, ok: false };
  });
  const ok = matched.filter((m) => m.ok).length;
  return { ratio: ok / tw.length, matched };
}

function bestOf(target, alternatives) {
  let best = { ratio: -1, matched: [], said: "" };
  alternatives.forEach((alt) => {
    const r = scoreAttempt(target, alt);
    if (r.ratio > best.ratio) best = { ...r, said: alt };
  });
  return best;
}

const starsFor = (ratio) => (ratio >= 0.85 ? 3 : ratio >= 0.5 ? 2 : ratio > 0 ? 1 : 0);

const FEEDBACK = {
  3: ["Perfeito! 🎉", "Pronúncia incrível!", "Você arrasou! 🌟"],
  2: ["Muito bem! 👏", "Quase perfeito!", "Mandou bem!"],
  1: ["Bom começo! 💪", "Tente mais uma vez.", "Você consegue!"],
  0: ["Não consegui ouvir 🎤", "Fale mais perto do microfone.", "Vamos de novo!"],
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ---------- mascote papagaio ---------- */
function Parrot({ emotion }) {
  return (
    <div className={`parrot parrot--${emotion}`}>
      {emotion === "listening" && (
        <div className="waves" aria-hidden>
          <span></span><span></span><span></span>
        </div>
      )}
      {emotion === "happy" && (
        <div className="sparkles" aria-hidden>
          <span>⭐</span><span>✨</span><span>💚</span><span>⭐</span>
        </div>
      )}
      <svg viewBox="0 0 200 210" width="160" height="168" role="img" aria-label="Papagaio">
        {/* cauda */}
        <g className="tail">
          <path d="M70 150 Q40 200 58 205 Q72 190 92 168 Z" fill="#14B8C4" />
          <path d="M84 158 Q70 205 88 206 Q98 190 104 170 Z" fill="#FFC53D" />
        </g>
        {/* corpo */}
        <ellipse cx="104" cy="128" rx="56" ry="60" fill="#18A35A" />
        <ellipse cx="112" cy="138" rx="34" ry="42" fill="#9BE8B6" />
        {/* asa */}
        <g className="wing" style={{ transformOrigin: "70px 110px" }}>
          <path d="M70 92 Q40 110 56 162 Q74 150 84 110 Z" fill="#0E7C42" />
        </g>
        {/* cabeça */}
        <g className="head" style={{ transformOrigin: "104px 78px" }}>
          {/* crista */}
          <path d="M96 24 Q92 6 104 12 Q102 24 108 28 Z" fill="#ED5C2D" />
          <path d="M108 22 Q112 2 120 14 Q112 24 116 30 Z" fill="#FFC53D" />
          <circle cx="104" cy="74" r="46" fill="#1FB866" />
          {/* bochecha */}
          <circle cx="74" cy="92" r="11" fill="#FF9D7A" opacity="0.7" />
          {/* olho */}
          <circle cx="100" cy="66" r="20" fill="#fff" />
          <circle className="pupil" cx="104" cy="68" r="11" fill="#163A33" />
          <circle cx="108" cy="64" r="4" fill="#fff" />
          {/* bico */}
          <path d="M58 70 Q30 78 52 96 Q70 92 78 80 Q70 70 58 70 Z" fill="#FF7A4D" />
          <path d="M52 86 Q44 92 56 95 Q66 92 66 86 Z" fill="#ED5C2D" />
        </g>
      </svg>
    </div>
  );
}

/* ---------- estrelinhas ---------- */
const Stars = ({ value, size = 22 }) => (
  <span className="stars" style={{ fontSize: size }}>
    {[0, 1, 2].map((i) => (
      <span key={i} className={i < value ? "on" : "off"}>★</span>
    ))}
  </span>
);

/* ============================ APP ============================ */
function App() {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState("idle"); // idle | listening | result | done
  const [result, setResult] = useState(null);
  const [phrases, setPhrases] = useState(PHRASES);
  const [scores, setScores] = useState(() => PHRASES.map(() => 0));
  const [supported, setSupported] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const [confetti, setConfetti] = useState([]);

  const recRef = useRef(null);
  const voicesRef = useRef([]);
  const audioRef = useRef(null);
  const phrase = phrases[index];
  const total = scores.reduce((a, b) => a + b, 0);

  const emotion =
    mode === "listening" ? "listening"
    : mode === "result" && result?.stars >= 2 ? "happy"
    : mode === "result" ? "try"
    : mode === "done" ? "happy"
    : "idle";

  /* vozes */
  useEffect(() => {
    const load = () => { voicesRef.current = window.speechSynthesis?.getVoices() || []; };
    load();
    if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = load;
  }, []);

  /* detecta suporte a reconhecimento */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSupported(false);
    return () => { try { recRef.current?.abort(); } catch (_) {} };
  }, []);

  const speak = useCallback((text, slow = false) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v =
      voicesRef.current.find((x) => /en[-_]US/i.test(x.lang)) ||
      voicesRef.current.find((x) => /^en/i.test(x.lang));
    if (v) u.voice = v;
    u.lang = v?.lang || "en-US";
    u.rate = slow ? 0.6 : 0.9;
    u.pitch = 1.1;
    window.speechSynthesis.speak(u);
  }, []);

  /* ---- sons (sintetizados na hora, sem arquivos) ---- */
  const play = useCallback(
    (name) => {
      if (!soundOn) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!audioRef.current) audioRef.current = new AC();
      const ctx = audioRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const tone = (freq, start, dur, type = "triangle", vol = 0.22) => {
        const t0 = ctx.currentTime + start;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.03);
      };
      const seqs = {
        win: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.09, 0.28)),
        good: () => [587.33, 880].forEach((f, i) => tone(f, i * 0.1, 0.24)),
        try: () => { tone(330, 0, 0.18, "sine", 0.16); tone(247, 0.12, 0.24, "sine", 0.16); },
        pop: () => tone(660, 0, 0.08, "square", 0.12),
      };
      (seqs[name] || seqs.pop)();
    },
    [soundOn]
  );

  const celebrate = useCallback(() => {
    const colors = ["#18A35A", "#FF7A4D", "#14B8C4", "#FFC53D", "#ED5C2D"];
    const pieces = Array.from({ length: 36 }, (_, i) => ({
      id: i + "-" + Date.now(),
      left: Math.random() * 100,
      delay: Math.random() * 0.3,
      dur: 1.1 + Math.random() * 0.8,
      color: colors[i % colors.length],
      rot: Math.random() * 360,
    }));
    setConfetti(pieces);
    setTimeout(() => setConfetti([]), 2200);
  }, []);

  const evaluate = useCallback(
    (alternatives) => {
      const best = bestOf(phrase.en, alternatives);
      const stars = starsFor(best.ratio);
      setResult({ ...best, stars, msg: pick(FEEDBACK[stars]) });
      setMode("result");
      setScores((prev) => {
        const next = [...prev];
        if (stars > next[index]) next[index] = stars;
        return next;
      });
      if (navigator.vibrate) navigator.vibrate(stars >= 3 ? [60, 40, 60] : stars >= 1 ? 40 : 15);
      play(stars >= 3 ? "win" : stars === 2 ? "good" : "try");
      if (stars >= 3) celebrate();
    },
    [phrase.en, index, celebrate, play]
  );

  const showError = useCallback((msg) => {
    setResult({
      ratio: 0,
      matched: tokenize(phrase.en).map((w) => ({ word: w, ok: false })),
      said: "", stars: 0, msg,
    });
    setMode("result");
  }, [phrase.en]);

  const startListening = useCallback(async () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }

    // Pede a permissão do microfone de forma explícita (prompt claro + permissão fica salva)
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop()); // libera o aparelho, mantém a permissão
      } catch (err) {
        showError(
          err?.name === "NotAllowedError"
            ? "Microfone bloqueado 🎤 Toque no cadeado da barra de endereço → Permissões → Microfone → Permitir e recarregue."
            : err?.name === "NotFoundError"
            ? "Nenhum microfone foi encontrado no aparelho."
            : "Não consegui acessar o microfone. Confira as permissões do Chrome."
        );
        return;
      }
    }

    window.speechSynthesis?.cancel();
    try { recRef.current?.abort(); } catch (_) {}
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 5;
    rec.continuous = false;
    rec.onresult = (e) => {
      const alts = Array.from(e.results[0]).map((r) => r.transcript);
      evaluate(alts);
    };
    rec.onerror = (e) => {
      const map = {
        "not-allowed": "Microfone bloqueado 🎤 Toque no cadeado → Microfone → Permitir e recarregue.",
        "service-not-allowed": "Permita o microfone para este site e tente de novo 🎤",
        "audio-capture": "Nenhum microfone foi encontrado no aparelho.",
        "no-speech": "Não ouvi nada. Fale mais perto e tente de novo 🎤",
        "network": "Sem internet para reconhecer a fala. Confira a conexão.",
      };
      showError(map[e.error] || pick(FEEDBACK[0]));
    };
    rec.onend = () => setMode((m) => (m === "listening" ? "idle" : m));
    recRef.current = rec;
    setResult(null);
    setMode("listening");
    play("pop");
    try { rec.start(); } catch (_) {}
  }, [evaluate, phrase.en, showError, play]);

  const goNext = useCallback(() => {
    try { recRef.current?.abort(); } catch (_) {}
    setResult(null);
    if (index + 1 >= phrases.length) { setMode("done"); celebrate(); }
    else { setIndex((i) => i + 1); setMode("idle"); }
  }, [index, celebrate, phrases.length]);

  const restart = useCallback(() => {
    setScores(phrases.map(() => 0));
    setIndex(0); setResult(null); setMode("idle");
  }, [phrases.length]);

  // Gera um conjunto novo de frases dinamicamente e recomeça
  const regenerate = useCallback(() => {
    const fresh = generateRound(10);
    setPhrases(fresh);
    setScores(fresh.map(() => 0));
    setIndex(0); setResult(null); setMode("idle");
    play("pop");
  }, [play]);

  const maxStars = phrases.length * 3;

  return (
    <div className="screen">
      <style>{CSS}</style>

      {confetti.length > 0 && (
        <div className="confetti" aria-hidden>
          {confetti.map((c) => (
            <span key={c.id} style={{
              left: c.left + "%", background: c.color,
              animationDelay: c.delay + "s", animationDuration: c.dur + "s",
              transform: `rotate(${c.rot}deg)`,
            }} />
          ))}
        </div>
      )}

      {/* topo */}
      <header className="top">
        <div className="brand">
          <span className="brand-bird">🦜</span>
          <span className="brand-name">Fala, Papagaio!</span>
        </div>
        <div className="top-right">
          <button
            className="icon-btn"
            onClick={() => setSoundOn((s) => !s)}
            aria-label={soundOn ? "Desligar som" : "Ligar som"}
            title={soundOn ? "Som ligado" : "Som desligado"}
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
          <button
            className="icon-btn"
            onClick={regenerate}
            aria-label="Gerar frases novas"
            title="Frases novas"
          >
            🎲
          </button>
          <div className="score-pill">⭐ {total}<span className="score-max">/{maxStars}</span></div>
        </div>
      </header>

      {mode === "done" ? (
        <main className="card done">
          <Parrot emotion="happy" />
          <h1 className="done-title">Você terminou! 🎉</h1>
          <div className="done-stars">⭐ {total} de {maxStars} estrelas</div>
          <p className="done-sub">
            {total >= maxStars * 0.8 ? "Pronúncia campeã! 🏆"
              : total >= maxStars * 0.5 ? "Muito bom! Continue praticando 💪"
              : "Bom trabalho! Vamos treinar mais? 😊"}
          </p>
          <div className="action-row">
            <button className="btn btn-ghost big" onClick={restart}>Jogar de novo</button>
            <button className="btn btn-primary big" onClick={regenerate}>🎲 Frases novas</button>
          </div>
        </main>
      ) : (
        <main className="card">
          {/* progresso */}
          <div className="progress">
            <div className="progress-count">{index + 1} / {phrases.length}</div>
            <div className="dots">
              {phrases.map((_, i) => (
                <span key={i} className={
                  "dot " + (i === index ? "now " : "") + (scores[i] > 0 ? "got" : "")
                } />
              ))}
            </div>
          </div>

          <Parrot emotion={emotion} />

          {/* frase */}
          <div className="phrase">
            <div className="phrase-emoji">{phrase.emoji}</div>
            {mode === "result" ? (
              <div className="phrase-en">
                {result.matched.map((m, i) => (
                  <span key={i} className={(m.ok ? "w-ok" : "w-miss") + " w-click"} onClick={() => speak(m.word)}>{m.word} </span>
                ))}
              </div>
            ) : (
              <div className="phrase-en">
                {phrase.en.split(" ").map((word, i) => (
                  <span key={i} className="w-click" onClick={() => speak(word)}>{word} </span>
                ))}
              </div>
            )}
            <div className="phrase-pt">{phrase.pt}</div>
          </div>

          {/* área de resultado */}
          {mode === "result" && (
            <div className={"result " + (result.stars >= 2 ? "good" : "soft")}>
              <Stars value={result.stars} size={30} />
              <div className="result-msg">{result.msg}</div>
              {result.said && <div className="result-said">Ouvi: “{result.said}”</div>}
            </div>
          )}

          {/* listen */}
          <div className="listen-row">
            <button className="btn btn-soft" onClick={() => speak(phrase.en, false)}>🔊 Ouvir</button>
            <button className="btn btn-soft" onClick={() => speak(phrase.en, true)}>🐢 Devagar</button>
          </div>

          {/* ação principal */}
          {!supported ? (
            <div className="notice">
              O microfone funciona melhor no <b>Google Chrome</b> (no celular ou no
              computador). Você ainda pode ouvir e treinar! 🎧
            </div>
          ) : mode === "result" ? (
            <div className="action-row">
              <button className="btn btn-ghost" onClick={startListening}>🔁 Tentar de novo</button>
              <button className="btn btn-primary" onClick={goNext}>
                {index + 1 >= PHRASES.length ? "Terminar 🌟" : "Próxima →"}
              </button>
            </div>
          ) : (
            <button
              className={"btn btn-mic " + (mode === "listening" ? "rec" : "")}
              onClick={startListening}
              disabled={mode === "listening"}
            >
              {mode === "listening" ? "🎙️ Ouvindo..." : "🎤 Falar"}
            </button>
          )}
        </main>
      )}

      <footer className="foot">Repita a frase em voz alta e ganhe estrelas ⭐</footer>
    </div>
  );
}

/* ============================ ESTILO ============================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@600;700;800&display=swap');

* { box-sizing: border-box; }
.screen {
  --green:#18A35A; --green-d:#0E7C42; --coral:#FF7A4D; --coral-d:#ED5C2D;
  --teal:#14B8C4; --yellow:#FFC53D; --ink:#163A33; --muted:#7E978F;
  min-height: 100vh;
  font-family:'Nunito',system-ui,sans-serif;
  color: var(--ink);
  background: linear-gradient(165deg,#FFF8E7 0%, #E2F6F0 60%, #D6F0FF 100%);
  display:flex; flex-direction:column; align-items:center;
  padding: 14px 14px 24px; position:relative; overflow-x:hidden;
}
.top {
  width:100%; max-width:460px; display:flex; align-items:center;
  justify-content:space-between; margin-bottom:10px;
}
.brand { display:flex; align-items:center; gap:8px; }
.brand-bird { font-size:26px; }
.brand-name { font-family:'Baloo 2',cursive; font-weight:800; font-size:22px; color:var(--green-d); }
.score-pill {
  font-family:'Baloo 2',cursive; font-weight:800; font-size:16px; color:var(--coral-d);
  background:#fff; border:2px solid #ffe1cf; padding:5px 12px; border-radius:999px;
  box-shadow:0 3px 0 #ffe1cf;
}
.score-max { color:var(--muted); font-size:13px; }
.top-right { display:flex; align-items:center; gap:8px; }
.icon-btn {
  font-size:18px; line-height:1; border:2px solid #eef7f2; background:#fff;
  width:38px; height:38px; border-radius:50%; cursor:pointer; box-shadow:0 3px 0 #e7f0eb;
  display:flex; align-items:center; justify-content:center; transition:transform .08s;
  -webkit-tap-highlight-color:transparent;
}
.icon-btn:active { transform:translateY(2px); }
.icon-btn:focus-visible { outline:3px solid #14B8C4; outline-offset:2px; }

.card {
  width:100%; max-width:460px; background:#fff;
  border-radius:28px; padding:18px 18px 22px;
  box-shadow:0 14px 34px rgba(20,80,60,.16); border:3px solid #eef7f2;
  display:flex; flex-direction:column; align-items:center; gap:12px;
}

.progress { width:100%; display:flex; flex-direction:column; gap:8px; align-items:center; }
.progress-count { font-family:'Baloo 2',cursive; font-weight:700; color:var(--muted); font-size:14px; }
.dots { display:flex; gap:7px; flex-wrap:wrap; justify-content:center; }
.dot { width:11px; height:11px; border-radius:50%; background:#e3ece8; transition:.2s; }
.dot.got { background:var(--yellow); }
.dot.now { background:var(--green); transform:scale(1.35); box-shadow:0 0 0 4px rgba(24,163,90,.18); }

/* mascote */
.parrot { position:relative; height:172px; display:flex; align-items:flex-end; justify-content:center; }
.parrot--idle svg { animation:bob 3s ease-in-out infinite; }
.parrot--try svg { animation:wobble 0.6s ease; }
.parrot--happy svg { animation:jump 0.5s ease 2; }
.parrot--listening .head { animation:tilt 1s ease-in-out infinite alternate; }
.parrot--happy .wing { animation:flap 0.3s ease-in-out infinite; }
.parrot--listening .pupil { animation:look 1s ease-in-out infinite alternate; }

@keyframes bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
@keyframes jump { 0%,100%{transform:translateY(0)} 40%{transform:translateY(-22px)} }
@keyframes wobble { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-5deg)} 75%{transform:rotate(5deg)} }
@keyframes tilt { from{transform:rotate(-7deg)} to{transform:rotate(7deg)} }
@keyframes flap { 0%,100%{transform:rotate(0)} 50%{transform:rotate(-22deg)} }
@keyframes look { from{transform:translateX(-2px)} to{transform:translateX(3px)} }

.waves { position:absolute; right:18px; top:30px; display:flex; gap:5px; align-items:center; }
.waves span { width:6px; border-radius:4px; background:var(--teal); animation:eq .7s ease-in-out infinite; }
.waves span:nth-child(1){height:14px; animation-delay:0s}
.waves span:nth-child(2){height:26px; animation-delay:.15s}
.waves span:nth-child(3){height:18px; animation-delay:.3s}
@keyframes eq { 0%,100%{transform:scaleY(.5)} 50%{transform:scaleY(1.2)} }

.sparkles span { position:absolute; font-size:20px; animation:floatUp 1.4s ease-out infinite; }
.sparkles span:nth-child(1){left:8px; top:20px; animation-delay:0s}
.sparkles span:nth-child(2){right:14px; top:8px; animation-delay:.3s}
.sparkles span:nth-child(3){left:24px; top:60px; animation-delay:.55s}
.sparkles span:nth-child(4){right:30px; top:54px; animation-delay:.8s}
@keyframes floatUp { 0%{opacity:0; transform:translateY(8px) scale(.6)} 30%{opacity:1} 100%{opacity:0; transform:translateY(-26px) scale(1)} }

/* frase */
.phrase { text-align:center; }
.phrase-emoji { font-size:40px; line-height:1; }
.phrase-en { font-family:'Baloo 2',cursive; font-weight:800; font-size:30px; line-height:1.15; margin-top:4px; }
.phrase-pt { color:var(--muted); font-weight:700; font-size:15px; margin-top:2px; }
.w-ok { color:var(--green); }
.w-miss { color:#C7CFCB; text-decoration:underline; text-decoration-color:#FFB199; text-decoration-thickness:2px; }
.w-click { cursor:pointer; border-radius:6px; padding:0 3px; transition:background .1s; }
.w-click:hover { background:rgba(20,184,196,.18); }
.w-click:active { background:rgba(20,184,196,.35); }

/* resultado */
.result { width:100%; text-align:center; border-radius:18px; padding:12px; }
.result.good { background:#EAF9F0; }
.result.soft { background:#FFF3EC; }
.stars .on { color:var(--yellow); } .stars .off { color:#E3ECE8; }
.result-msg { font-family:'Baloo 2',cursive; font-weight:800; font-size:20px; margin-top:2px; }
.result-said { font-size:13px; color:var(--muted); margin-top:4px; }

/* botões */
.listen-row { display:flex; gap:10px; }
.action-row { width:100%; display:flex; gap:10px; }
.btn {
  font-family:'Baloo 2',cursive; font-weight:800; border:none; cursor:pointer;
  border-radius:16px; padding:12px 18px; font-size:16px; transition:transform .08s, filter .15s;
  -webkit-tap-highlight-color:transparent;
}
.btn:active { transform:translateY(2px); }
.btn:focus-visible { outline:3px solid #14B8C4; outline-offset:2px; }
.btn-soft { background:#EAF4FF; color:#1668A8; box-shadow:0 4px 0 #cfe5fb; }
.btn-ghost { flex:1; background:#F1F4F2; color:var(--ink); box-shadow:0 4px 0 #dde6e1; }
.btn-primary { flex:1; background:var(--green); color:#fff; box-shadow:0 5px 0 var(--green-d); }
.btn-mic {
  width:100%; background:var(--coral); color:#fff; font-size:21px; padding:16px;
  box-shadow:0 6px 0 var(--coral-d);
}
.btn-mic.rec { background:#E23B5A; box-shadow:0 6px 0 #B11E3C; animation:pulse 1s ease-in-out infinite; }
.btn.big { padding:15px 22px; font-size:19px; }
@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }

.notice {
  width:100%; background:#FFF6E0; border:2px dashed var(--yellow);
  color:#9a6b00; border-radius:16px; padding:12px; font-weight:700; font-size:14px; text-align:center;
}

/* done */
.done { gap:8px; }
.done-title { font-family:'Baloo 2',cursive; font-size:28px; margin:4px 0 0; }
.done-stars { font-family:'Baloo 2',cursive; font-weight:800; font-size:22px; color:var(--coral-d); }
.done-sub { color:var(--muted); font-weight:700; margin:0 0 6px; }

.foot { margin-top:14px; color:var(--muted); font-weight:700; font-size:13px; text-align:center; }

/* confete */
.confetti { position:fixed; inset:0; pointer-events:none; z-index:50; }
.confetti span {
  position:absolute; top:-14px; width:10px; height:14px; border-radius:2px;
  animation-name:fall; animation-timing-function:linear; animation-fill-mode:forwards;
}
@keyframes fall { to { transform:translateY(110vh) rotate(540deg); opacity:.9; } }

@media (prefers-reduced-motion: reduce) {
  .parrot svg, .parrot .head, .parrot .wing, .parrot .pupil,
  .waves span, .sparkles span, .btn-mic.rec, .confetti span { animation:none !important; }
}
`;

import { createRoot } from "react-dom/client";
const rootEl = document.getElementById("root");
createRoot(rootEl).render(<App />);
