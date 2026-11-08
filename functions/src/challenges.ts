// Sfide del mese usate dal server quando non c'è il documento challenges/{YYYY-MM} (così funziona senza lavoro a mano).
// DEVONO coincidere con js/challenges.js (id, metrica, obiettivo): c'è un test che lo controlla (tests/challenges.spec.mjs).
// La zona 2 non è qui: il server non conosce la FTP, quella sfida resta sul dispositivo.
export interface ChallengeDef { id: string; metric: 'km' | 'minutes' | 'rides' | 'kj'; target: number; }

export const DEFAULT_CHALLENGES: ChallengeDef[] = [
  { id: 'km300', metric: 'km', target: 300 },
  { id: 'rides10', metric: 'rides', target: 10 },
];
