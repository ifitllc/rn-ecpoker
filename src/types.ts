export type PlayerStatus = 'active' | 'frozen';

export interface Player {
  id: string;
  name: string;
  seatNo: number;
  rank: number; // numeric rank (2..)
  status: PlayerStatus;
  joinedRound: number; // round index when the player joined
}

export interface RoundRecord {
  id: string;
  createdAt: string;
  dealerSeat: number;
  firstCallerId: string;
  helperIds: string[];
  nonHouseScore: number; // legacy, kept for compatibility
  houseWon: boolean;
  levelSteps: number;
}

export interface GameState {
  gameId: string;
  roundIndex: number;
  currentDealerSeat: number;
  players: Player[];
  history: RoundRecord[];
  pendingRound: RoundInput | null;
  pendingBasePlayers: Player[] | null;
}

export interface ScoreRow {
  playerId: string;
  seatNo: number;
  rank: number;
}

export interface ScoringResult {
  updatedPlayers: Player[];
  delta: Record<string, number>;
}

export interface RoundInput {
  dealerSeat: number;
  firstCallerId: string;
  helperIds: string[];
  houseWon: boolean;
  levelSteps: number;
}
