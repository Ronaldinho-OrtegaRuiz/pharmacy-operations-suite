/** Chime (opción 4: Do–Mi–Sol) al llegar un pago QR por WebSocket. */

const CHIME_SRC = "/sounds/chime.wav";

let audio: HTMLAudioElement | null = null;
let unlocked = false;

function getAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!audio) {
    audio = new Audio(CHIME_SRC);
    audio.preload = "auto";
  }
  return audio;
}

/** El navegador bloquea audio hasta un clic/tecla. Armar el elemento en ese gesto. */
export function unlockQrPaymentSound(): void {
  if (unlocked) return;
  const el = getAudio();
  if (!el) return;
  const previous = el.volume;
  el.volume = 0;
  const playAttempt = el.play();
  if (!playAttempt) return;
  void playAttempt
    .then(() => {
      el.pause();
      el.currentTime = 0;
      el.volume = previous || 1;
      unlocked = true;
    })
    .catch(() => {
      el.volume = previous || 1;
    });
}

export function playQrPaymentSound(): void {
  const el = getAudio();
  if (!el) return;
  el.volume = 1;
  try {
    el.currentTime = 0;
  } catch {
    // ignore
  }
  void el.play().catch(() => {
    // Autoplay bloqueado hasta que haya un gesto en la página.
  });
}
