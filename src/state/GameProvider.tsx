import React, { createContext, useContext, useMemo, useState } from 'react';
import { GameState, Player, PlayerStatus, RoundInput, RoundRecord } from '../types';
import { applyRound, nextDealerSeat } from '../utils/scoreEngine';

interface GameContextValue extends GameState {
  setDeckCount: (count: number) => void;
  addPlayer: (name: string, seatNo: number) => void;
  togglePlayerStatus: (playerId: string, status: PlayerStatus) => void;
  recordRound: (round: Omit<RoundInput, 'deckCount'>) => void;
  undoLastRound: () => void;
  advanceDealer: () => void;
}

const buildInitialState = (): GameState => ({
  gameId: Math.random().toString(36).slice(2, 10),
  deckCount: 1,
  roundIndex: 0,
  currentDealerSeat: 1,
  players: [],
  history: [],
});

const replayHistory = (players: Player[], history: RoundRecord[]) => {
  let current = players.map((p) => ({ ...p, rank: 2 }));
  history.forEach((round) => {
    const { updatedPlayers } = applyRound(current, {
      ...round,
      deckCount: round.deckCount,
    });
    current = updatedPlayers;
  });
  return current;
};

const GameContext = createContext<GameContextValue | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GameState>(buildInitialState());

  const setDeckCount = (count: number) => {
    setState((prev) => ({ ...prev, deckCount: Math.max(1, count) }));
  };

  const addPlayer = (name: string, seatNo: number) => {
    setState((prev) => {
      if (prev.players.some((p) => p.seatNo === seatNo)) return prev;
      const player: Player = {
        id: Math.random().toString(36).slice(2, 10),
        name,
        seatNo,
        rank: 2,
        status: 'active',
        joinedRound: prev.roundIndex,
      };
      return { ...prev, players: [...prev.players, player].sort((a, b) => a.seatNo - b.seatNo) };
    });
  };

  const togglePlayerStatus = (playerId: string, status: PlayerStatus) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => (p.id === playerId ? { ...p, status } : p)),
    }));
  };

  const recordRound = (round: Omit<RoundInput, 'deckCount'>) => {
    setState((prev) => {
      const record: RoundRecord = {
        id: Math.random().toString(36).slice(2, 10),
        createdAt: new Date().toISOString(),
        deckCount: prev.deckCount,
        ...round,
      };
      const { updatedPlayers } = applyRound(prev.players, { ...round, deckCount: prev.deckCount });
      const nextDealer = nextDealerSeat(round.dealerSeat, updatedPlayers);
      return {
        ...prev,
        roundIndex: prev.roundIndex + 1,
        players: updatedPlayers,
        history: [...prev.history, record],
        currentDealerSeat: nextDealer,
      };
    });
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
      };
    });
  };

  const advanceDealer = () => {
    setState((prev) => {
      const nextSeat = nextDealerSeat(prev.currentDealerSeat, prev.players);
      return { ...prev, currentDealerSeat: nextSeat };
    });
  };

  const value = useMemo(
    () => ({
      ...state,
      setDeckCount,
      addPlayer,
      togglePlayerStatus,
      recordRound,
      undoLastRound,
      advanceDealer,
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
