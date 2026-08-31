const fs = require("fs");
const path = require("path");

const SAMPLE_RATE = 44100;
const outDir = path.join(__dirname, "..", "public", "sounds");

function clamp(x) {
  return Math.max(-1, Math.min(1, x));
}

function writeWav(filePath, samples) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(Math.round(clamp(samples[i]) * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buf);
}

function mixAt(samples, startSec, duration, fn) {
  const start = Math.floor(startSec * SAMPLE_RATE);
  const n = Math.floor(duration * SAMPLE_RATE);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const idx = start + i;
    if (idx >= samples.length) break;
    samples[idx] += fn(t);
  }
}

function tone(freq, gain, tau, harmonics) {
  const hs = harmonics || [1];
  return function (t) {
    const env = Math.exp(-t / tau);
    let s = 0;
    let w = 0;
    for (let h = 0; h < hs.length; h++) {
      const amp = 1 / (h + 1);
      s += amp * Math.sin(2 * Math.PI * freq * hs[h] * t);
      w += amp;
    }
    return (gain * env * s) / w;
  };
}

function alloc(seconds) {
  return new Float64Array(Math.floor(seconds * SAMPLE_RATE));
}

function render(seconds, build) {
  const samples = alloc(seconds);
  build(samples);
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  const norm = peak > 0 ? 0.85 / peak : 1;
  for (let i = 0; i < samples.length; i++) samples[i] *= norm;
  return samples;
}

const sounds = [
  {
    id: "ping",
    name: "Ping",
    desc: "Un toque corto, tipo mensaje. Discreto.",
    samples: render(0.45, (s) => {
      mixAt(s, 0, 0.45, tone(880, 1, 0.12, [1, 2]));
    }),
  },
  {
    id: "doble-beep",
    name: "Doble beep",
    desc: "Dos pitidos, estilo datafono / POS.",
    samples: render(0.55, (s) => {
      mixAt(s, 0, 0.18, tone(980, 1, 0.07, [1]));
      mixAt(s, 0.22, 0.22, tone(980, 1, 0.09, [1]));
    }),
  },
  {
    id: "campanita",
    name: "Campanita",
    desc: "Dos notas altas, como un timbre suave.",
    samples: render(0.9, (s) => {
      mixAt(s, 0, 0.55, tone(1046.5, 1, 0.22, [1, 2.01, 3.02]));
      mixAt(s, 0.12, 0.7, tone(1568, 0.85, 0.28, [1, 2.01]));
    }),
  },
  {
    id: "chime",
    name: "Chime",
    desc: "Do-Mi-Sol. Suena a listo / exito.",
    samples: render(1.05, (s) => {
      mixAt(s, 0, 0.55, tone(523.25, 1, 0.22, [1, 2]));
      mixAt(s, 0.12, 0.6, tone(659.25, 0.95, 0.24, [1, 2]));
      mixAt(s, 0.24, 0.75, tone(783.99, 0.9, 0.32, [1, 2.01]));
    }),
  },
  {
    id: "ka-ching",
    name: "Ka-ching",
    desc: "Caja registradora light: grave + agudo.",
    samples: render(0.7, (s) => {
      mixAt(s, 0, 0.18, tone(392, 1, 0.06, [1, 2]));
      mixAt(s, 0.08, 0.55, tone(1174.7, 1, 0.18, [1, 2.004, 3]));
    }),
  },
  {
    id: "gotita",
    name: "Gotita",
    desc: "Muy suave, casi un plop. Poco invasivo.",
    samples: render(0.55, (s) => {
      mixAt(s, 0, 0.5, (t) => {
        const f = 920 - 380 * Math.min(1, t / 0.12);
        return Math.exp(-t / 0.09) * Math.sin(2 * Math.PI * f * t);
      });
    }),
  },
  {
    id: "acorde",
    name: "Acorde",
    desc: "Tres notas a la vez. Calido, no urgente.",
    samples: render(1.0, (s) => {
      mixAt(s, 0, 1.0, tone(523.25, 0.7, 0.38, [1]));
      mixAt(s, 0, 1.0, tone(659.25, 0.7, 0.4, [1]));
      mixAt(s, 0, 1.0, tone(783.99, 0.75, 0.42, [1, 2]));
    }),
  },
  {
    id: "alerta",
    name: "Alerta suave",
    desc: "Dos notas subiendo. Se nota, sin gritar.",
    samples: render(0.65, (s) => {
      mixAt(s, 0, 0.22, tone(740, 1, 0.1, [1]));
      mixAt(s, 0.2, 0.4, tone(988, 1, 0.16, [1, 2]));
    }),
  },
];

fs.mkdirSync(outDir, { recursive: true });
const manifest = sounds.map((s) => {
  const file = s.id + ".wav";
  writeWav(path.join(outDir, file), s.samples);
  return { id: s.id, name: s.name, desc: s.desc, file: "/sounds/" + file };
});
fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify(manifest, null, 2)
);
console.log("Wrote " + sounds.length + " sounds to " + outDir);
