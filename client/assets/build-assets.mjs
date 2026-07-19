// Builds the Android launcher/splash sources from the official ERP ATLAS logo
// (client/src/assets/logo-atlas.png — the one shown on the login screen).
//
// Run:  node assets/build-assets.mjs && npx @capacitor/assets generate --android
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = (name) => join(here, name);
const LOGO = join(here, '..', 'src', 'assets', 'logo-atlas.png');

// The brand file stacks the "A" symbol over the words "ERP ATLAS". At launcher
// sizes (48px on mdpi) that text is an unreadable smudge, so the icon uses the
// symbol alone. Bounds measured on the 1024² source, text band starts at y=715.
const MARK = { left: 245, top: 219, width: 534, height: 436 };
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENT = { r: 255, g: 255, b: 255, alpha: 0 };

const mark = (size) =>
  sharp(LOGO).extract(MARK).resize(size, size, { fit: 'contain', background: TRANSPARENT }).png().toBuffer();

const canvas = (size, background, input) =>
  sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input, gravity: 'centre' }])
    .png();

// ── Launcher icon (legacy square) ───────────────────────────────────────────
await canvas(1024, WHITE, await mark(760)).toFile(out('icon.png'));

// ── Adaptive icon foreground. Do NOT pre-shrink for the safe zone here:
//    @capacitor/assets wraps this layer in `<inset android:inset="16.7%">`,
//    which already maps it into the centre 66% that launchers never crop.
//    Padding it twice leaves a tiny logo adrift in a white circle.
await canvas(1024, TRANSPARENT, await mark(950)).toFile(out('icon-foreground.png'));
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: WHITE } })
  .png()
  .toFile(out('icon-background.png'));

// ── Splash: the complete logo, wordmark included — it is readable at that size
//    and matches what users see on the login screen.
const SPLASH = 2732;
const fullLogo = await sharp(LOGO)
  .trim({ threshold: 25 })
  .resize(1000, 1000, { fit: 'contain', background: WHITE })
  .png()
  .toBuffer();

for (const name of ['splash.png', 'splash-dark.png']) {
  await canvas(SPLASH, WHITE, fullLogo).toFile(out(name));
}

console.log('✅ ATLAS assets generated from the official logo');
