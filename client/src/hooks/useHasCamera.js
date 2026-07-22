import { useEffect, useState } from 'react';
import { isNative } from '../native';
import { hasCamera } from '../lib/webScanner';

/**
 * Vrai quand l'appareil peut scanner : l'APK, ou le site ouvert sur un
 * téléphone / une tablette. Faux sur un PC sans webcam — les entrées de scan
 * disparaissent alors d'elles-mêmes au lieu de mener à un écran d'erreur.
 *
 * La détection est asynchrone (enumerateDevices) : on part de `false` sur le web
 * pour ne jamais faire clignoter un bouton inutilisable, et de `true` dans l'APK
 * où la caméra est garantie.
 */
export default function useHasCamera() {
  const [available, setAvailable] = useState(isNative());

  useEffect(() => {
    if (isNative()) return;
    let alive = true;
    hasCamera().then((ok) => { if (alive) setAvailable(ok); });
    return () => { alive = false; };
  }, []);

  return available;
}
