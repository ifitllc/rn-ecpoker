import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useGame } from '../state/GameProvider';
import { applyRound, formatRank } from '../utils/scoreEngine';
import { Player, RoundRecord } from '../types';
import { hasSupabaseConfig, supabase } from '../services/supabaseClient';

const PLAYER_COL_WIDTH = 150;
const ROUND_COL_WIDTH = 90;
const ROW_HEIGHT = 64;

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface GameOption {
  gameUuid: string;
  createdAt: string;
  totalEntries: number;
  label: string;
}

interface HistoricalPlayer {
  id: string;
  name: string;
  seatNo: number;
  rank: number;
}

type RoundSnapshot = Record<string, number | null>;

interface HistoricalGameData {
  players: HistoricalPlayer[];
  roundSnapshots: RoundSnapshot[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const formatGameLabel = (createdAt: string, gameUuid: string): string => {
  const d = new Date(createdAt);
  const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const uuidDisplay =
    gameUuid.length > 16 ? `....-${gameUuid.slice(-12)}` : gameUuid;
  return `${dateStr}, ${uuidDisplay}`;
};

const buildRoundTimeline = (players: Player[], history: RoundRecord[]) => {
  const rankMap = new Map<string, number>();
  players.forEach((p) => rankMap.set(p.id, 2));

  const snapshots: RoundSnapshot[] = [];

  history.forEach((round, idx) => {
    const activePlayers = players
      .filter((p) => p.joinedRound <= idx)
      .map((p) => ({ ...p, rank: rankMap.get(p.id) ?? 2 }));

    if (activePlayers.length) {
      const { updatedPlayers } = applyRound(activePlayers, {
        dealerSeat: round.dealerSeat,
        firstCallerId: round.firstCallerId,
        helperIds: round.helperIds,
        houseWon: round.houseWon,
        levelSteps: round.levelSteps ?? 1,
      });
      updatedPlayers.forEach((p) => rankMap.set(p.id, p.rank));
    }

    const snapshot: RoundSnapshot = {};
    players.forEach((p) => {
      snapshot[p.id] = p.joinedRound <= idx ? rankMap.get(p.id) ?? 2 : null;
    });
    snapshots.push(snapshot);
  });

  return snapshots;
};

/* ------------------------------------------------------------------ */
/*  Supabase queries                                                  */
/* ------------------------------------------------------------------ */

const fetchRecentGames = async (
  currentGameId: string,
): Promise<GameOption[]> => {
  if (!hasSupabaseConfig || !supabase) return [];

  try {
    const { data, error } = await supabase
      .from('scores')
      .select('game_uuid, created_at')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error || !data) return [];

    const gameMap = new Map<string, { createdAt: string; count: number }>();
    (data as { game_uuid: string; created_at: string }[]).forEach((row) => {
      const existing = gameMap.get(row.game_uuid);
      if (!existing) {
        gameMap.set(row.game_uuid, { createdAt: row.created_at, count: 1 });
      } else {
        existing.count++;
        if (row.created_at > existing.createdAt) {
          existing.createdAt = row.created_at;
        }
      }
    });

    const games: GameOption[] = [];
    gameMap.forEach((value, key) => {
      if (value.count > 10 && key !== currentGameId) {
        games.push({
          gameUuid: key,
          createdAt: value.createdAt,
          totalEntries: value.count,
          label: formatGameLabel(value.createdAt, key),
        });
      }
    });

    games.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return games.slice(0, 10);
  } catch (err) {
    console.error('Failed to fetch recent games', err);
    return [];
  }
};

const fetchHistoricalGameData = async (
  gameUuid: string,
): Promise<HistoricalGameData | null> => {
  if (!hasSupabaseConfig || !supabase) return null;

  try {
    const { data, error } = await supabase
      .from('scores')
      .select('player_id, seat_no, rank, created_at, players(name)')
      .eq('game_uuid', gameUuid)
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) return null;

    const rows = (data as unknown) as {
      player_id: string;
      seat_no: number;
      rank: number;
      created_at: string;
      players: { name: string } | null;
    }[];

    // Group rows by created_at to identify rounds
    const roundGroups = new Map<string, typeof rows>();
    rows.forEach((row) => {
      const key = row.created_at;
      if (!roundGroups.has(key)) roundGroups.set(key, []);
      roundGroups.get(key)!.push(row);
    });

    // Build player list from the latest round snapshot
    const sortedTimestamps = [...roundGroups.keys()].sort();
    const latestRound =
      roundGroups.get(sortedTimestamps[sortedTimestamps.length - 1])!;

    const playerMap = new Map<string, HistoricalPlayer>();
    latestRound.forEach((row) => {
      playerMap.set(row.player_id, {
        id: row.player_id,
        name: row.players?.name ?? 'Unknown',
        seatNo: row.seat_no,
        rank: row.rank,
      });
    });

    // Collect players that only appear in earlier rounds
    rows.forEach((row) => {
      if (!playerMap.has(row.player_id)) {
        playerMap.set(row.player_id, {
          id: row.player_id,
          name: row.players?.name ?? 'Unknown',
          seatNo: row.seat_no,
          rank: row.rank,
        });
      }
    });

    const players = [...playerMap.values()].sort(
      (a, b) => a.seatNo - b.seatNo,
    );

    // Build round snapshots
    const roundSnapshots: RoundSnapshot[] = sortedTimestamps.map((ts) => {
      const group = roundGroups.get(ts)!;
      const snapshot: RoundSnapshot = {};
      players.forEach((p) => {
        snapshot[p.id] = null;
      });
      group.forEach((row) => {
        snapshot[row.player_id] = row.rank;
      });
      return snapshot;
    });

    return { players, roundSnapshots };
  } catch (err) {
    console.error('Failed to fetch historical game data', err);
    return null;
  }
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

const DashboardScreen = () => {
  const { players, history, undoLastRound, currentDealerSeat, gameId } =
    useGame();

  /* --- historical-game state --- */
  const [recentGames, setRecentGames] = useState<GameOption[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [historicalData, setHistoricalData] =
    useState<HistoricalGameData | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isCurrentGame = selectedGameId === null;

  // Fetch recent games on mount / when gameId changes
  useEffect(() => {
    fetchRecentGames(gameId).then(setRecentGames);
  }, [gameId]);

  // Load historical data when a past game is selected
  useEffect(() => {
    if (selectedGameId) {
      setLoading(true);
      fetchHistoricalGameData(selectedGameId)
        .then(setHistoricalData)
        .finally(() => setLoading(false));
    } else {
      setHistoricalData(null);
    }
  }, [selectedGameId]);

  /* --- current-game derived data --- */
  const sortedBySeat = useMemo(
    () => [...players].sort((a, b) => a.seatNo - b.seatNo),
    [players],
  );
  const sortedByRank = useMemo(
    () =>
      [...players].sort((a, b) => b.rank - a.rank || a.seatNo - b.seatNo),
    [players],
  );
  const roundLabels = useMemo(
    () => history.map((_, idx) => `R${idx + 1}`),
    [history],
  );
  const roundTimeline = useMemo(
    () => buildRoundTimeline(sortedBySeat, history),
    [sortedBySeat, history],
  );

  /* --- historical derived data --- */
  const histSortedBySeat = useMemo(
    () => historicalData?.players ?? [],
    [historicalData],
  );
  const histSortedByRank = useMemo(
    () =>
      historicalData
        ? [...historicalData.players].sort(
            (a, b) => b.rank - a.rank || a.seatNo - b.seatNo,
          )
        : [],
    [historicalData],
  );
  const histRoundLabels = useMemo(
    () =>
      historicalData?.roundSnapshots.map((_, idx) => `R${idx + 1}`) ?? [],
    [historicalData],
  );

  /* --- unified display data --- */
  const displayPlayers = isCurrentGame ? sortedByRank : histSortedByRank;
  const displaySeatPlayers = isCurrentGame ? sortedBySeat : histSortedBySeat;
  const displayRoundLabels = isCurrentGame ? roundLabels : histRoundLabels;
  const displaySnapshots = isCurrentGame
    ? roundTimeline
    : historicalData?.roundSnapshots ?? [];

  /* --- dropdown label --- */
  const selectedLabel = isCurrentGame
    ? 'Current Game'
    : recentGames.find((g) => g.gameUuid === selectedGameId)?.label ??
      'Unknown';

  const handleSelectGame = useCallback((gameUuid: string | null) => {
    setSelectedGameId(gameUuid);
    setDropdownOpen(false);
  }, []);

  /* --- dropdown items for FlatList --- */
  const dropdownItems = useMemo(
    () => [
      { gameUuid: null as string | null, label: 'Current Game' },
      ...recentGames.map((g) => ({
        gameUuid: g.gameUuid as string | null,
        label: g.label,
      })),
    ],
    [recentGames],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      {/* ---- Game selector dropdown ---- */}
      {recentGames.length > 0 && (
        <TouchableOpacity
          style={styles.dropdownBtn}
          onPress={() => setDropdownOpen(true)}
        >
          <Text style={styles.dropdownBtnText} numberOfLines={1}>
            {selectedLabel}
          </Text>
          <Text style={styles.dropdownArrow}>▼</Text>
        </TouchableOpacity>
      )}

      {/* ---- Dropdown modal ---- */}
      <Modal
        visible={dropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDropdownOpen(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Game</Text>
            <FlatList
              data={dropdownItems}
              keyExtractor={(item) => item.gameUuid ?? 'current'}
              renderItem={({ item }) => {
                const active =
                  item.gameUuid === selectedGameId ||
                  (item.gameUuid === null && isCurrentGame);
                return (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      active && styles.modalItemSelected,
                    ]}
                    onPress={() => handleSelectGame(item.gameUuid)}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        active && styles.modalItemTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ---- Header ---- */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Leaderboard</Text>
        {isCurrentGame && (
          <TouchableOpacity style={styles.undoBtn} onPress={undoLastRound}>
            <Text style={styles.undoText}>Undo</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color="#f4d35e"
          style={{ marginTop: 32 }}
        />
      ) : (
        <>
          {/* ---- Leaderboard cards ---- */}
          <View style={{ gap: 8 }}>
            {displayPlayers.map((item) => {
              const isPlayer = 'status' in item;
              return (
                <View key={item.id} style={styles.card}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Text style={styles.rank}>{formatRank(item.rank)}</Text>
                    <Text style={styles.name}>{item.name}</Text>
                    {isCurrentGame &&
                      isPlayer &&
                      (item as Player).seatNo === currentDealerSeat && (
                        <Text style={styles.star}>*</Text>
                      )}
                  </View>
                  <Text style={styles.meta}>
                    Seat {item.seatNo}
                    {isCurrentGame && isPlayer
                      ? ` · ${(item as Player).status === 'active' ? 'Active' : 'Frozen'}`
                      : ''}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* ---- Round progress ---- */}
          <Text style={styles.subtitle}>Round Progress</Text>
          {displayRoundLabels.length === 0 ? (
            <Text style={styles.placeholder}>No rounds recorded yet.</Text>
          ) : (
            <View style={styles.tableWrapper}>
              <View style={styles.tableRowGroup}>
                <View style={styles.frozenColumn}>
                  <View
                    style={[
                      styles.playerCell,
                      styles.headerCell,
                      styles.frozenHeader,
                    ]}
                  >
                    <Text style={styles.headerText}>Player</Text>
                  </View>
                  {displaySeatPlayers.map((player) => (
                    <View
                      key={player.id}
                      style={[styles.playerCell, styles.frozenCell]}
                    >
                      <Text
                        style={styles.name}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {player.name}
                      </Text>
                      {isCurrentGame &&
                        'status' in player &&
                        (player as Player).status === 'frozen' && (
                          <Text
                            style={styles.meta}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            Frozen
                          </Text>
                        )}
                    </View>
                  ))}
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator
                  style={styles.roundsScroll}
                  contentContainerStyle={{ paddingRight: 10 }}
                >
                  <View>
                    <View style={styles.tableHeaderRow}>
                      {displayRoundLabels.map((label) => (
                        <View
                          key={label}
                          style={[styles.headerCell, styles.roundCell]}
                        >
                          <Text style={styles.headerText}>{label}</Text>
                        </View>
                      ))}
                    </View>

                    {displaySeatPlayers.map((player) => (
                      <View key={player.id} style={styles.tableRow}>
                        {displayRoundLabels.map((_, roundIdx) => {
                          const value =
                            displaySnapshots[roundIdx]?.[player.id];
                          const display =
                            value == null ? '—' : formatRank(value);
                          return (
                            <View
                              key={`${player.id}-${roundIdx}`}
                              style={[styles.cell, styles.roundCell]}
                            >
                              <Text style={styles.cellText}>{display}</Text>
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
};

export default DashboardScreen;

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12 },
  scrollContent: { paddingBottom: 24, gap: 12 },
  title: { color: '#f4d35e', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#dfe7dd', fontSize: 16, fontWeight: '700' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  /* ---- dropdown ---- */
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#10261d',
    borderColor: '#1f5a3c',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dropdownBtnText: {
    color: '#e8f1ec',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  dropdownArrow: { color: '#7fa28b', fontSize: 12, marginLeft: 8 },
  /* ---- modal ---- */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '88%',
    maxHeight: '60%',
    backgroundColor: '#0d1d17',
    borderRadius: 14,
    borderColor: '#1f5a3c',
    borderWidth: 1,
    paddingVertical: 14,
  },
  modalTitle: {
    color: '#f4d35e',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalItem: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomColor: '#1f5a3c',
    borderBottomWidth: 1,
  },
  modalItemSelected: { backgroundColor: '#143022' },
  modalItemText: { color: '#e8f1ec', fontSize: 14 },
  modalItemTextSelected: { color: '#f4d35e', fontWeight: '700' },
  /* ---- leaderboard ---- */
  card: {
    backgroundColor: '#10261d',
    padding: 12,
    borderRadius: 12,
    borderColor: '#1f5a3c',
    borderWidth: 1,
  },
  rank: { color: '#fefae0', fontSize: 18, fontWeight: '800' },
  name: { color: '#e8f1ec', fontSize: 16, fontWeight: '700' },
  meta: { color: '#7fa28b', fontSize: 12, marginTop: 4 },
  star: { color: '#f4d35e', fontSize: 18, marginLeft: 4 },
  undoBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#3a3f46',
  },
  undoText: { color: '#fefae0', fontWeight: '700' },
  placeholder: { color: '#7fa28b', marginBottom: 8 },
  /* ---- round-progress table ---- */
  tableWrapper: {
    borderColor: '#1f5a3c',
    borderWidth: 1,
    borderRadius: 12,
    backgroundColor: '#0d1d17',
  },
  tableRowGroup: { flexDirection: 'row' },
  frozenColumn: {
    borderRightColor: '#1f5a3c',
    borderRightWidth: 1,
    backgroundColor: '#0f261c',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomColor: '#1f5a3c',
    borderBottomWidth: 1,
    height: ROW_HEIGHT,
    alignItems: 'center',
  },
  headerCell: {
    height: ROW_HEIGHT,
    paddingHorizontal: 10,
    borderRightColor: '#1f5a3c',
    borderRightWidth: 1,
    backgroundColor: '#143022',
    justifyContent: 'center',
  },
  headerText: { color: '#f4d35e', fontWeight: '800', textAlign: 'center' },
  tableRow: {
    flexDirection: 'row',
    borderBottomColor: '#1f5a3c',
    borderBottomWidth: 1,
    height: ROW_HEIGHT,
    alignItems: 'center',
  },
  playerCell: {
    width: PLAYER_COL_WIDTH,
    height: ROW_HEIGHT,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRightColor: '#1f5a3c',
    borderRightWidth: 1,
    justifyContent: 'center',
  },
  frozenHeader: { borderBottomColor: '#1f5a3c', borderBottomWidth: 1 },
  frozenCell: {
    borderBottomColor: '#1f5a3c',
    borderBottomWidth: 1,
  },
  roundsScroll: { flex: 1 },
  cell: {
    width: ROUND_COL_WIDTH,
    height: ROW_HEIGHT,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRightColor: '#1f5a3c',
    borderRightWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { color: '#e8f1ec', fontWeight: '700' },
  roundCell: { width: ROUND_COL_WIDTH },
});
