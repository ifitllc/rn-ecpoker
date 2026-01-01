import { Player, RoundInput, ScoringResult } from '../types';

const MIN_RANK = -20; // allow tracking below 2-x as negative values

const clampRank = (rank: number) => Math.max(MIN_RANK, rank);

const cardFaces = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '王'];

export const formatRank = (rank: number) => {
  if (rank <= 1) {
    const deficit = 2 - rank; // rank 1 -> 1 => 2-1, rank 0 ->2, etc.
    return `2-${deficit}`;
  }

  if (rank >= 2 && rank <= 10) return `${rank}`;
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  if (rank === 14) return 'A';
  if (rank === 15) return '王';

  // Above 15: R2-2 ... R2-王, R3-2 ...
  const offset = rank - 16; // 0-based beyond 15
  const group = 2 + Math.floor(offset / cardFaces.length); // R2, R3, ...
  const face = cardFaces[offset % cardFaces.length];
  return `R${group}-${face}`;
};

export const applyRound = (
  players: Player[],
  round: RoundInput,
): ScoringResult => {
  const houseIds = new Set([round.firstCallerId, ...round.helperIds]);
  const delta: Record<string, number> = {};

  const updatedPlayers: Player[] = players.map((p) => {
    const isHouse = houseIds.has(p.id);
    const isFirst = p.id === round.firstCallerId;
    let change = 0;

    if (round.houseWon) {
      if (isHouse) {
        change += round.levelSteps;
        if (isFirst) change += 1;
      }
    } else {
      if (!isHouse) {
        change += round.levelSteps;
      } else if (isFirst) {
        change -= 1;
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
  const ahead = active.find((p) => p.seatNo > current);
  return ahead ? ahead.seatNo : active[0].seatNo;
};
