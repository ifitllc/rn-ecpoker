import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { GameState, Player, PlayerStatus, RoundInput, RoundRecord } from '../types';
import { applyRound, nextDealerSeat } from '../utils/scoreEngine';
import { hasSupabaseConfig, supabase } from '../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface GameContextValue extends GameState {
  addPlayer: (name: string, seatNo: number, options?: { persist?: boolean; id?: string }) => void;
  removePlayer: (playerId: string) => void;
  togglePlayerStatus: (playerId: string, status: PlayerStatus) => void;
  swapPlayerSeat: (playerId: string, targetSeat: number) => void;
  previewRound: (round: RoundInput) => void;
  confirmPendingRound: (roundOverride?: RoundInput) => void;
  recordRound: (round: RoundInput) => void;
  undoLastRound: () => void;
  advanceDealer: () => void;
  startNewGame: () => void;
  resetGame: () => void;
}

const uuid = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback RFC4122-ish generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const generateGameId = () => uuid();
const generatePlayerId = () => uuid();

const buildInitialState = (): GameState => ({
  gameId: generateGameId(),
  roundIndex: 0,
  currentDealerSeat: 1,
  lastDealerSeat: null,
  players: [],
  history: [],
  pendingRound: null,
  pendingBasePlayers: null,
});

const STORAGE_KEY = 'ecpoker/game-state/v1';

const hydrateState = (value: Partial<GameState> | null): GameState => {
  const base = buildInitialState();
  if (!value) return base;
  return {
    ...base,
    ...value,
    players: value.players ?? base.players,
    history: value.history ?? base.history,
    lastDealerSeat: value.lastDealerSeat ?? base.lastDealerSeat,
    pendingRound: null,
    pendingBasePlayers: null,
  };
};

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
  if (!hasSupabaseConfig || !supabase) {
    console.warn('Supabase not configured; skip player persist');
    return;
  }
  const { error } = await supabase.from('players').upsert({ id: player.id, name: player.name });
  if (error) console.error('Failed to persist player', error.message);
};

const persistScores = async (gameId: string, players: Player[]) => {
  if (!hasSupabaseConfig || !supabase) {
    console.warn('Supabase not configured; skip scores persist', { hasSupabaseConfig, supabaseNull: !supabase });
    return;
  }
  const rows = players.map((p) => ({ game_uuid: gameId, player_id: p.id, seat_no: p.seatNo, rank: p.rank }));
  console.info('Persisting scores', { rows: rows.length, gameId });
  const { error } = await supabase.from('scores').insert(rows);
  if (error) {
    console.error('Failed to persist scores', error.message, { rowsCount: rows.length, gameId, rows });
  } else {
    console.info('Scores persisted', { rows: rows.length, gameId });
  }
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GameState>(buildInitialState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && mounted) {
          const parsed = JSON.parse(raw);
          const restored = parsed?.version === 1 ? (parsed.state as Partial<GameState>) : (parsed as Partial<GameState>);
          setState(hydrateState(restored));
        }
      } catch (err) {
        console.error('Failed to hydrate game state', err);
      } finally {
        if (mounted) setHydrated(true);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const persist = async () => {
      try {
        const payload = { version: 1, state: { ...state, pendingRound: null, pendingBasePlayers: null } };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (err) {
        console.error('Failed to persist game state', err);
      }
    };
    void persist();
  }, [state, hydrated]);

  const addPlayer = (name: string, seatNo: number, options?: { persist?: boolean; id?: string }) => {
    const shouldPersist = options?.persist !== false;
    let created: Player | null = null;
    setState((prev) => {
      const targetSeat = Math.max(1, seatNo);
      const shifted = prev.players.map((p) =>
        p.seatNo >= targetSeat ? { ...p, seatNo: p.seatNo + 1 } : p,
      );
      const player: Player = {
        id: options?.id ?? generatePlayerId(),
        name,
        seatNo: targetSeat,
        rank: 2,
        status: 'active',
        joinedRound: prev.roundIndex,
      };
      created = player;
      return { ...prev, players: [...shifted, player].sort((a, b) => a.seatNo - b.seatNo) };
    });
    if (created && shouldPersist) void persistPlayer(created);
  };

  const removePlayer = (playerId: string) => {
    setState((prev) => {
      const target = prev.players.find((p) => p.id === playerId);
      if (!target) return prev;
      const removedSeat = target.seatNo;
      const remaining = prev.players
        .filter((p) => p.id !== playerId)
        .map((p) => (p.seatNo > removedSeat ? { ...p, seatNo: p.seatNo - 1 } : p))
        .sort((a, b) => a.seatNo - b.seatNo);

      let nextDealer = prev.currentDealerSeat;
      if (remaining.length === 0) {
        nextDealer = 1;
      } else if (removedSeat < prev.currentDealerSeat) {
        nextDealer = Math.max(1, prev.currentDealerSeat - 1);
      } else if (removedSeat === prev.currentDealerSeat) {
        nextDealer = nextDealerSeat(prev.currentDealerSeat, remaining);
      }

      return {
        ...prev,
        players: remaining,
        currentDealerSeat: nextDealer,
        lastDealerSeat: prev.lastDealerSeat === removedSeat ? null : prev.lastDealerSeat,
      };
    });
  };

  const swapPlayerSeat = (playerId: string, targetSeat: number) => {
    setState((prev) => {
      const target = prev.players.find((p) => p.id === playerId);
      if (!target) return prev;

      const desired = Math.max(1, targetSeat);
      if (desired === target.seatNo) return prev;

      const occupant = prev.players.find((p) => p.seatNo === desired);

      const swapped = prev.players.map((p) => {
        if (p.id === playerId) return { ...p, seatNo: desired };
        if (occupant && p.id === occupant.id) return { ...p, seatNo: target.seatNo };
        return p;
      }).sort((a, b) => a.seatNo - b.seatNo);

      let nextDealer = prev.currentDealerSeat;
      const dealerSeat = prev.currentDealerSeat;

      if (dealerSeat === target.seatNo) {
        if (desired < dealerSeat) {
          nextDealer = nextDealerSeat(dealerSeat, swapped);
        } else if (desired > dealerSeat) {
          nextDealer = dealerSeat;
        }
      }

      return {
        ...prev,
        players: swapped,
        currentDealerSeat: nextDealer,
      };
    });
  };

  const togglePlayerStatus = (playerId: string, status: PlayerStatus) => {
    setState((prev) => {
      const target = prev.players.find((p) => p.id === playerId);
      if (!target) return prev;

      const players = prev.players.map((p) => (p.id === playerId ? { ...p, status } : p));

      if (status === 'frozen' && target.seatNo === prev.currentDealerSeat) {
        const nextSeat = nextDealerSeat(target.seatNo, players);
        return {
          ...prev,
          players,
          currentDealerSeat: nextSeat,
          lastDealerSeat: target.seatNo,
        };
      }

      if (status === 'active' && prev.lastDealerSeat === target.seatNo) {
        return {
          ...prev,
          players,
          currentDealerSeat: target.seatNo,
          lastDealerSeat: null,
        };
      }

      return { ...prev, players };
    });
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

  const confirmPendingRound = (roundOverride?: RoundInput) => {
    setState((prev) => {
      const round = roundOverride ?? prev.pendingRound;
      if (!round) return prev;

      const roundInput: RoundInput = { ...round, levelSteps: round.levelSteps ?? 1 } as RoundInput;
      const basePlayers = prev.pendingBasePlayers ?? prev.players;
      const { updatedPlayers } = applyRound(basePlayers, roundInput);

      void persistScores(prev.gameId, updatedPlayers);

      const nextDealer = nextDealerSeat(roundInput.dealerSeat, updatedPlayers);

      return {
        ...prev,
        roundIndex: prev.roundIndex + 1,
        history: [
          ...prev.history,
          {
            id: Math.random().toString(36).slice(2, 10),
            createdAt: new Date().toISOString(),
            ...roundInput,
            nonHouseScore: 0,
          },
        ],
        currentDealerSeat: nextDealer,
        pendingRound: null,
        pendingBasePlayers: null,
        players: updatedPlayers,
      };
    });
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
      if (prev.pendingRound && prev.pendingBasePlayers) {
        return {
          ...prev,
          players: prev.pendingBasePlayers,
          pendingRound: null,
          pendingBasePlayers: null,
        };
      }
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
        lastDealerSeat: null,
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
      removePlayer,
      togglePlayerStatus,
      swapPlayerSeat,
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
