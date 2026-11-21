/**
 * Modo "mãos livres" do tutorial: o navegador fala o próximo movimento (Web Speech API, sem
 * internet e sem mandar nada para fora) e um toque no cubo 3D avança. Assim dá para seguir o
 * tutorial com o cubo nas duas mãos, sem ler a tela.
 */
import { getLang } from '../core/i18n';

const KEY = 'cubo:handsfree';

/** texto para falar: sem HTML, setas, "·" e parênteses (viram pausas) */
export function speechText(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/[↻↺]/g, '')
    .replace(/\s*\(180°\)/g, '')
    .replace(/\s*·\s*/g, ', ')
    .replace(/\s*\(([^)]*)\)/g, ', $1')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.:])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/, '')
    .trim();
}

export const canSpeak = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

export function speak(text: string) {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel(); // a fala anterior perde a vez: o movimento novo é o que importa
  const lang = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' }[getLang()];
  const u = new SpeechSynthesisUtterance(speechText(text));
  u.lang = lang;
  const voices = synth.getVoices();
  const norm = (l: string) => l.replace('_', '-').toLowerCase();
  const voice = voices.find((v) => norm(v.lang) === lang.toLowerCase()) ?? voices.find((v) => norm(v.lang).startsWith(lang.slice(0, 2)));
  if (voice) u.voice = voice;
  u.rate = 1.05;
  synth.speak(u);
}

export function stopSpeaking() {
  if (canSpeak()) window.speechSynthesis.cancel();
}

export function loadHandsFree(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function saveHandsFree(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
}
