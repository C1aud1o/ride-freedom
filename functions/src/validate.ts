// Validazione di un punteggio inviato dall'app. Funzioni pure: si testano senza emulatore.
import { GAMES, GameRule, maxPlausibleAvgW } from './games';

export interface ScoreInput {
  game: string;
  stage?: number;
  score: number;
  durationSec: number;
  avgW: number;
  maxW: number;
  /** identificativo casuale della partita generato dall'app: evita doppioni se la rete ripete la chiamata */
  runId: string;
}

export type Check = { ok: true; value: ScoreInput; rule: GameRule; boardId: string } | { ok: false; reason: string };

const isInt = (v: unknown, lo: number, hi: number): v is number => Number.isInteger(v) && (v as number) >= lo && (v as number) <= hi;
const isNum = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;

export function validateScore(raw: unknown): Check {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'payload' };
  const d = raw as Record<string, unknown>;
  const allowed = new Set(['game', 'stage', 'score', 'durationSec', 'avgW', 'maxW', 'runId']);
  if (Object.keys(d).some((k) => !allowed.has(k))) return { ok: false, reason: 'campi' };
  if (typeof d.game !== 'string' || !Object.prototype.hasOwnProperty.call(GAMES, d.game)) return { ok: false, reason: 'gioco' };
  const rule = GAMES[d.game];
  if (typeof d.runId !== 'string' || !/^[A-Za-z0-9_-]{8,40}$/.test(d.runId)) return { ok: false, reason: 'runId' };
  if (!isInt(d.durationSec, rule.minDuration, rule.maxDuration)) return { ok: false, reason: 'durata' };
  if (!isNum(d.score, rule.minScore, rule.maxScore)) return { ok: false, reason: 'punteggio' };
  if (!rule.lowerIsBetter && !Number.isInteger(d.score)) return { ok: false, reason: 'punteggio' };
  if (!isInt(d.avgW, 0, 2500) || !isInt(d.maxW, 0, 3000) || d.avgW > d.maxW) return { ok: false, reason: 'potenza' };
  if (d.avgW > maxPlausibleAvgW(d.durationSec)) return { ok: false, reason: 'potenza' };
  // un tempo di gara non può essere più corto della partita giocata (margine 5 s per menu e conto alla rovescia)
  if (rule.lowerIsBetter && (d.score as number) > d.durationSec + 5) return { ok: false, reason: 'tempo' };
  if (rule.maxPerMinute && (d.score as number) > (rule.maxPerMinute * d.durationSec) / 60 + 1000) return { ok: false, reason: 'ritmo' };
  let boardId: string = d.game;
  if (rule.stages) {
    if (!isInt(d.stage, 0, rule.stages - 1)) return { ok: false, reason: 'tappa' };
    boardId = `${d.game}-s${d.stage}`;
  } else if (d.stage !== undefined) return { ok: false, reason: 'tappa' };
  // per i tempi si tiene il decimo di secondo
  const score = rule.lowerIsBetter ? Math.round((d.score as number) * 10) / 10 : (d.score as number);
  return { ok: true, rule, boardId, value: { ...(d as unknown as ScoreInput), score } };
}

/** Chiave di ordinamento: sempre "più alto è meglio", così basta un solo indice. */
export const sortKeyOf = (rule: GameRule, score: number): number => (rule.lowerIsBetter ? -score : score);

/** Settimana ISO 8601 in UTC, es. "2026-W45" (le classifiche settimanali cambiano il lunedì 00:00 UTC). */
export function isoWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // giovedì della stessa settimana
  const year = d.getUTCFullYear();
  const week = Math.ceil(((d.getTime() - Date.UTC(year, 0, 1)) / 864e5 + 1) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Mese "2026-11" in UTC, per le sfide del mese. */
export const monthKey = (date: Date): string => date.toISOString().slice(0, 7);
