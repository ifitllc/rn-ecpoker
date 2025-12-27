import { Player, RoundInput, ScoringResult } from '../types';

const MIN_RANK = 0; // allow tracking below 2 when dealer loses badly

const clampRank = (rank: number) => Math.max(MIN_RANK, rank);

const calcNonHouseLevels = (nonHouseScore: number, deckCount: number) => {
  const base = 80 * deckCount;
  if (nonHouseScore < base) return 0;
  const extra = Math.floor((nonHouseScore - base) / (40 * deckCount));
  return 1 + extra;
};

const calcHouseBonus = (nonHouseScore: number, deckCount: number) => {
  if (nonHouseScore === 0) return 3;
  if (nonHouseScore < 40 * deckCount) return 1;
  return 0;
};

export const formatRank = (rank: number) => {
  const labels: Record<number, string> = {
    11: 'J',
    12: 'Q',
    13: 'K',
    14: 'A',
    15: 'NT',
    16: 'R1-2',
    17: 'R1-3',
  };
  return labels[rank] ?? rank.toString();
};

export const applyRound = (
  players: Player[],
  round: RoundInput,
): ScoringResult => {
  const houseIds = new Set([round.firstCallerId, ...round.helperIds]);
  const delta: Record<string, number> = {};

  const updatedPlayers: Player[] = players.map((p) => {
    let change = 0;
    const isHouse = houseIds.has(p.id);

    if (round.houseWon) {
      if (isHouse) {
        change += 1;
        change += calcHouseBonus(round.nonHouseScore, round.deckCount);
        if (p.id === round.firstCallerId) change += 1;
      }
    } else {
      if (isHouse && p.id === round.firstCallerId) {
        change -= 1;
      }
      if (!isHouse) {
        const levels = calcNonHouseLevels(round.nonHouseScore, round.deckCount);
        change += levels;
      }
    }

    const rank = clampRank(p.rank + change);
    delta[p.id] = change;
    return { ...p, rank };
  });

  return { updatedPlayers, delta };
};

export const nextDealerSeat = (current: number, players: Player[]) => {
  const ordered = [...players].sort((a, b) => a.seatNo - b.seatNo);
  const active = ordered.filter((p) => p.status === 'active');
  if (!active.length) return current;
  const idx = active.findIndex((p) => p.seatNo === current);
  const next = idx === -1 ? 0 : (idx + 1) % active.length;
  return active[next].seatNo;
};
