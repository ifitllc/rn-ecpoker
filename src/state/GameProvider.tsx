import React, { createContext, useContext, useMemo, useState } from 'react';
import { GameState, Player, PlayerStatus, RoundInput, RoundRecord } from '../types';
import { applyRound, nextDealerSeat } from '../utils/scoreEngine';
import { hasSupabaseConfig, supabase } from '../services/supabaseClient';

interface GameContextValue extends GameState {
  addPlayer: (name: string, seatNo: number) => void;
  togglePlayerStatus: (playerId: string, status: PlayerStatus) => void;
  previewRound: (round: RoundInput) => void;
  confirmPendingRound: () => void;
  recordRound: (round: RoundInput) => void;
  undoLastRound: () => void;
  advanceDealer: () => void;
  startNewGame: () => void;
  resetGame: () => void;
}

const generateGameId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `game-${Math.random().toString(36).slice(2, 10)}`;
};

const generatePlayerId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2, 10);
};

const buildInitialState = (): GameState => ({
  gameId: generateGameId(),
  roundIndex: 0,
  currentDealerSeat: 1,
  players: [],
  history: [],
  pendingRound: null,
  pendingBasePlayers: null,
});

const replayHistory = (players: Player[], history: RoundRecord[]) => {
  let current = players.map((p) => ({ ...p, rank: 2 }));
  history.forEach((round) => {
    const { updatedPlayers } = applyRound(current, {
      dealerSeat: round.dealerSeat,
      firstCallerId: round.firstCallerId,
      helperIds: round.helperIds,
      houseWon: round.houseWon,
      levelSteps: round.levelSteps ?? 1,
    });
    current = updatedPlayers;
  });
  return current;
};

const GameContext = createContext<GameContextValue | null>(null);

const persistPlayer = async (player: Player) => {
  if (!hasSupabaseConfig || !supabase) return;
  const { error } = await supabase.from('players').upsert({ id: player.id, name: player.name });
  if (error) console.warn('Failed to persist player', error.message);
};

const persistScores = async (gameId: string, players: Player[]) => {
  if (!hasSupabaseConfig || !supabase) return;
  const rows = players.map((p) => ({ game_uuid: gameId, player_id: p.id, seat_no: p.seatNo, rank: p.rank }));
  const { error } = await supabase.from('scores').insert(rows);
  if (error) console.warn('Failed to persist scores', error.message);
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GameState>(buildInitialState());

  const addPlayer = (name: string, seatNo: number) => {
    let created: Player | null = null;
    setState((prev) => {
      if (prev.players.some((p) => p.seatNo === seatNo)) return prev;
      const player: Player = {
        id: generatePlayerId(),
        name,
        seatNo,
        rank: 2,
        status: 'active',
        joinedRound: prev.roundIndex,
      };
      created = player;
      return { ...prev, players: [...prev.players, player].sort((a, b) => a.seatNo - b.seatNo) };
    });
    if (created) void persistPlayer(created);
  };

  const togglePlayerStatus = (playerId: string, status: PlayerStatus) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => (p.id === playerId ? { ...p, status } : p)),
    }));
  };

  const previewRound = (round: RoundInput) => {
    setState((prev) => {
      const basePlayers = prev.pendingRound ? prev.pendingBasePlayers ?? prev.players : prev.players;
      const { updatedPlayers } = applyRound(basePlayers, round);
      return {
        ...prev,
        players: updatedPlayers,
        pendingRound: round,
        pendingBasePlayers: basePlayers,
      };
    });
  };

  const confirmPendingRound = () => {
    let after: (() => void) | null = null;
    setState((prev) => {
      if (!prev.pendingRound) return prev;
      const record: RoundRecord = {
        id: Math.random().toString(36).slice(2, 10),
        createdAt: new Date().toISOString(),
        ...prev.pendingRound,
        nonHouseScore: 0,
      };
      const snapshotPlayers = prev.players;
      after = () => void persistScores(prev.gameId, snapshotPlayers);
      const nextDealer = nextDealerSeat(prev.pendingRound.dealerSeat, prev.players);
      return {
        ...prev,
        roundIndex: prev.roundIndex + 1,
        history: [...prev.history, record],
        currentDealerSeat: nextDealer,
        pendingRound: null,
        pendingBasePlayers: null,
      };
    });
    if (after) after();
  };

  const recordRound = (round: RoundInput) => {
    let after: (() => void) | null = null;
    setState((prev) => {
      const roundInput: RoundInput = { ...round, levelSteps: round.levelSteps ?? 1 } as RoundInput;
      const basePlayers = prev.players;
      const { updatedPlayers } = applyRound(basePlayers, roundInput);
      const record: RoundRecord = {
        id: Math.random().toString(36).slice(2, 10),
        createdAt: new Date().toISOString(),
        ...roundInput,
        nonHouseScore: 0,
      };
      after = () => void persistScores(prev.gameId, updatedPlayers);
      const nextDealer = nextDealerSeat(roundInput.dealerSeat, updatedPlayers);
      return {
        ...prev,
        roundIndex: prev.roundIndex + 1,
        players: updatedPlayers,
        history: [...prev.history, record],
        currentDealerSeat: nextDealer,
        pendingRound: null,
        pendingBasePlayers: null,
      };
    });
    if (after) after();
  };

  const undoLastRound = () => {
    setState((prev) => {
      if (!prev.history.length) return prev;
      const nextHistory = prev.history.slice(0, -1);
      const resetPlayers = prev.players.map((p) => ({ ...p, rank: 2 }));
      const recalculated = replayHistory(resetPlayers, nextHistory);
      const lastRound = nextHistory.at(-1);
      return {
        ...prev,
        roundIndex: Math.max(0, prev.roundIndex - 1),
        players: recalculated,
        history: nextHistory,
        currentDealerSeat: lastRound ? nextDealerSeat(lastRound.dealerSeat, recalculated) : 1,
        pendingRound: null,
        pendingBasePlayers: null,
      };
    });
  };

  const advanceDealer = () => {
    setState((prev) => {
      const nextSeat = nextDealerSeat(prev.currentDealerSeat, prev.players);
      return { ...prev, currentDealerSeat: nextSeat };
    });
  };

  const startNewGame = () => {
    setState((prev) => {
      const resetPlayers = prev.players.map((p) => ({ ...p, rank: 2, joinedRound: 0 }));
      const activeSeats = resetPlayers.filter((p) => p.status === 'active').sort((a, b) => a.seatNo - b.seatNo);
      const fallbackSeat = resetPlayers.length ? resetPlayers[0].seatNo : 1;
      const nextDealer = activeSeats[0]?.seatNo ?? fallbackSeat;
      return {
        ...prev,
        gameId: generateGameId(),
        roundIndex: 0,
        history: [],
        currentDealerSeat: nextDealer,
        players: resetPlayers,
        pendingRound: null,
        pendingBasePlayers: null,
      };
    });
  };

  const resetGame = () => {
    setState(buildInitialState());
  };

  const value = useMemo(
    () => ({
      ...state,
      addPlayer,
      togglePlayerStatus,
      previewRound,
      confirmPendingRound,
      recordRound,
      undoLastRound,
      advanceDealer,
      startNewGame,
      resetGame,
    }),
    [state],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
};
