import { isNative } from '../native';

// ─── Scan par la caméra du navigateur ───────────────────────────────────────
// L'APK scanne via MLKit : un plugin natif qui dessine l'aperçu caméra DERRIÈRE
// la WebView. Sur le site ce plugin n'existe pas — on ouvre donc la caméra
// nous-mêmes avec getUserMedia et on décode les images dans la page.
//
// Deux décodeurs, dans cet ordre :
//   1. BarcodeDetector — intégré à Chrome/Edge sur Android et ChromeOS. Code
//      natif : lit un QR sur une image qui bouge bien mieux que du JavaScript.
//   2. jsQR — JavaScript pur, chargé à la demande. Couvre Safari iOS et Firefox,
//      qui n'ont pas BarcodeDetector.
//
// IMPORTANT : getUserMedia n'existe que dans un contexte sécurisé — https, ou
// localhost. Ouvrir le site en http://192.168.x.x (serveur de dev sur le Wi-Fi
// de l'atelier) ne donne AUCUNE caméra. C'est une règle des navigateurs, pas
// quelque chose que le code peut contourner. Le site Vercel est en https : rien
// à faire là-bas.

/** Images décodées par seconde. La caméra tourne à 30 i/s ; tout décoder ne lit
 *  pas plus vite, ça ne fait que chauffer la tablette et vider la batterie. */
const DECODE_FPS = 10;

/** Largeur à laquelle l'image est réduite avant décodage jsQR. Un QR d'étiquette
 *  se lit aussi bien à 640 px, et ~4× plus vite qu'en 1280. */
const DECODE_WIDTH = 640;

/** L'API caméra est présente et utilisable (https ou localhost). */
export function cameraApiAvailable() {
  return typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia
    && window.isSecureContext !== false;
}

/** Le site est ouvert en http sur autre chose que localhost : la caméra sera
 *  refusée par le navigateur quoi qu'on fasse. Sert à afficher le bon message. */
export function isInsecureContext() {
  return typeof window !== 'undefined'
    && window.isSecureContext === false;
}

/** Téléphone / tablette (écran tactile) par opposition à un PC à la souris. */
function isTouchDevice() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)').matches === true;
}

/**
 * Vrai quand l'appareil a réellement une caméra pour scanner.
 * Un PC de bureau sans webcam ne déclare aucun « videoinput » : le bouton
 * Scanner n'y apparaît donc jamais, exactement comme demandé.
 */
export async function hasCamera() {
  if (isNative()) return true;
  if (!cameraApiAvailable()) return false;

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (devices.some((d) => d.kind === 'videoinput')) return true;

    // Certains navigateurs (Safari, Firefox en mode strict) ne révèlent la liste
    // qu'après autorisation. Liste vide ≠ pas de caméra : on se fie alors au
    // type de pointeur, un écran tactile étant un téléphone ou une tablette.
    if (devices.length === 0) return isTouchDevice();
    return false;
  } catch {
    return isTouchDevice();
  }
}

/** Construit la fonction de décodage la plus rapide disponible ici. */
async function makeDecoder() {
  if ('BarcodeDetector' in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes('qr_code')) {
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        return async (video) => {
          const [first] = await detector.detect(video);
          return first?.rawValue || null;
        };
      }
    } catch { /* détecteur natif inutilisable — on passe à jsQR */ }
  }

  // Import dynamique : les navigateurs qui n'en ont pas besoin ne téléchargent
  // jamais ces ~30 Ko.
  const { default: jsQR } = await import('jsqr');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  return (video) => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null; // flux pas encore prêt

    const scale = Math.min(1, DECODE_WIDTH / w);
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // dontInvert : les étiquettes ATLAS sont noires sur blanc. Chercher aussi
    // l'inverse doublerait le temps de décodage pour rien.
    return jsQR(data, width, height, { inversionAttempts: 'dontInvert' })?.data || null;
  };
}

/**
 * Ouvre la caméra dans `video` et appelle onCode(texte) à chaque QR lu.
 * Renvoie une poignée : { stop, hasTorch, setTorch }.
 * Lève une erreur si la caméra est refusée, absente ou déjà occupée — l'appelant
 * la traduit en message via describeCameraError().
 */
export async function startWebScan(video, onCode) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: { ideal: 'environment' }, // caméra arrière sur téléphone/tablette
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  });

  // À partir d'ici le flux est ouvert (voyant caméra allumé) : la moindre erreur
  // doit le refermer, sinon la caméra reste active après l'écran d'erreur.
  let decode;
  let track;
  try {
    // playsinline : sans lui, iOS ouvre la vidéo en plein écran par-dessus l'app
    // et l'opérateur perd les boutons RECHARGE / DÉCHARGE.
    video.setAttribute('playsinline', 'true');
    video.muted = true;
    video.srcObject = stream;

    try {
      await video.play();
    } catch {
      // Certains navigateurs rejettent play() puis démarrent quand même le flux.
      // Le décodage n'y perd rien : il lit les images, pas l'état de lecture.
    }

    decode = await makeDecoder();
    track = stream.getVideoTracks()[0];
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    throw err;
  }

  let stopped = false;
  let timer = null;

  const tick = async () => {
    if (stopped) return;
    try {
      const code = await decode(video);
      if (code && !stopped) onCode(code);
    } catch { /* une image illisible ne change rien, la suivante arrive dans 100 ms */ }
    if (!stopped) timer = setTimeout(tick, 1000 / DECODE_FPS);
  };
  tick();

  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
      stream.getTracks().forEach((t) => t.stop()); // éteint la LED de la caméra
      video.srcObject = null;
    },
    // Le flash n'existe que sur les caméras arrière de mobiles, jamais sur webcam
    hasTorch: !!track?.getCapabilities?.().torch,
    setTorch(on) {
      return track?.applyConstraints({ advanced: [{ torch: on }] });
    },
  };
}

/** Traduit une erreur getUserMedia en statut affichable par la page Scanner. */
export function describeCameraError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'unsupported';
    case 'NotReadableError': // caméra déjà prise par une autre app / onglet
      return 'busy';
    default:
      return 'error';
  }
}
