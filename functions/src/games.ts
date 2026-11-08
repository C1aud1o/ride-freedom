// Tabella dei giochi ammessi in classifica e limiti di plausibilità.
// I limiti sono volutamente larghi: servono a fermare i punteggi impossibili, non i campioni.
// DA TARARE con i dati veri (vedi "dubbi aperti" in docs/account-architettura.md).

export interface GameRule {
  /** true = vince il valore più basso (tempo in secondi) */
  lowerIsBetter: boolean;
  /** valori ammessi per score */
  minScore: number;
  maxScore: number;
  /** punti massimi al minuto di gioco (solo per i giochi a punti) */
  maxPerMinute?: number;
  /** durata minima e massima di una partita, in secondi */
  minDuration: number;
  maxDuration: number;
  /** numero di tappe (solo per i giochi con più tracciati) */
  stages?: number;
}

// le chiavi sono quelle di `games` in js/app.js
export const GAMES: Record<string, GameRule> = {
  horde: { lowerIsBetter: false, minScore: 0, maxScore: 2_000_000, maxPerMinute: 60_000, minDuration: 20, maxDuration: 3 * 3600 },
  shooter: { lowerIsBetter: false, minScore: 0, maxScore: 2_000_000, maxPerMinute: 60_000, minDuration: 20, maxDuration: 3 * 3600 },
  gruppetto: { lowerIsBetter: false, minScore: 0, maxScore: 500_000, maxPerMinute: 20_000, minDuration: 20, maxDuration: 3 * 3600 },
  mattoni: { lowerIsBetter: false, minScore: 0, maxScore: 500_000, maxPerMinute: 20_000, minDuration: 20, maxDuration: 3 * 3600 },
  planata: { lowerIsBetter: false, minScore: 0, maxScore: 500_000, maxPerMinute: 20_000, minDuration: 20, maxDuration: 3 * 3600 },
  // Turbo Pedali 3D: tempo della gara (s), una classifica per tappa
  racer: { lowerIsBetter: true, minScore: 30, maxScore: 3 * 3600, minDuration: 30, maxDuration: 3 * 3600, stages: 32 },
};

/**
 * Potenza media massima credibile per una durata (W), larga per un professionista:
 * ~2000 W per 5 s, ~1000 W per 1 min, ~600 W per 5 min, ~500 W per 20 min, ~450 W oltre l'ora.
 */
export function maxPlausibleAvgW(durationSec: number): number {
  const d = Math.max(1, durationSec);
  return Math.round(430 + 1700 * Math.exp(-d / 25) + 380 * Math.exp(-d / 600));
}
