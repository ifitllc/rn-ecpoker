import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useGame } from '../state/GameProvider';
import { applyRound, formatRank } from '../utils/scoreEngine';
import { Player, RoundRecord } from '../types';

const PLAYER_COL_WIDTH = 150;
const ROUND_COL_WIDTH = 90;
const ROW_HEIGHT = 64;

const buildRoundTimeline = (players: Player[], history: RoundRecord[]) => {
  const rankMap = new Map<string, number>();
  players.forEach((p) => rankMap.set(p.id, 2));

  const snapshots: Record<string, number | null>[] = [];

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

    const snapshot: Record<string, number | null> = {};
    players.forEach((p) => {
      snapshot[p.id] = p.joinedRound <= idx ? rankMap.get(p.id) ?? 2 : null;
    });
    snapshots.push(snapshot);
  });

  return snapshots;
};

const DashboardScreen = () => {
  const { players, history, undoLastRound, currentDealerSeat } = useGame();
  const sortedBySeat = useMemo(() => [...players].sort((a, b) => a.seatNo - b.seatNo), [players]);
  const sortedByRank = useMemo(
    () => [...players].sort((a, b) => b.rank - a.rank || a.seatNo - b.seatNo),
    [players],
  );
  const roundLabels = useMemo(() => history.map((_, idx) => `R${idx + 1}`), [history]);
  const roundTimeline = useMemo(() => buildRoundTimeline(sortedBySeat, history), [sortedBySeat, history]);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Leaderboard</Text>
        <TouchableOpacity style={styles.undoBtn} onPress={undoLastRound}>
          <Text style={styles.undoText}>Undo</Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: 8 }}>
        {sortedByRank.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.rank}>{formatRank(item.rank)}</Text>
              <Text style={styles.name}>{item.name}</Text>
              {item.seatNo === currentDealerSeat && <Text style={styles.star}>*</Text>}
            </View>
            <Text style={styles.meta}>Seat {item.seatNo} · {item.status === 'active' ? 'Active' : 'Frozen'}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.subtitle}>Round Progress</Text>
      {history.length === 0 ? (
        <Text style={styles.placeholder}>No rounds recorded yet.</Text>
      ) : (
        <View style={styles.tableWrapper}>
          <View style={styles.tableRowGroup}>
            <View style={styles.frozenColumn}>
              <View style={[styles.playerCell, styles.headerCell, styles.frozenHeader]}>
                <Text style={styles.headerText}>Player</Text>
              </View>
              {sortedBySeat.map((player) => (
                <View key={player.id} style={[styles.playerCell, styles.frozenCell]}>
                  <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">{player.name}</Text>
                  <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">{player.status === 'frozen' ? 'Frozen' : ''}</Text>
                </View>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.roundsScroll} contentContainerStyle={{ paddingRight: 10 }}>
              <View>
                <View style={styles.tableHeaderRow}>
                  {roundLabels.map((label) => (
                    <View key={label} style={[styles.headerCell, styles.roundCell]}>
                      <Text style={styles.headerText}>{label}</Text>
                    </View>
                  ))}
                </View>

                {sortedBySeat.map((player) => (
                  <View key={player.id} style={styles.tableRow}>
                    {roundLabels.map((_, roundIdx) => {
                      const value = roundTimeline[roundIdx]?.[player.id];
                      const display = value == null ? '—' : formatRank(value);
                      return (
                        <View key={`${player.id}-${roundIdx}`} style={[styles.cell, styles.roundCell]}>
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
    </ScrollView>
  );
};

export default DashboardScreen;

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12 },
  scrollContent: { paddingBottom: 24, gap: 12 },
  title: { color: '#f4d35e', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#dfe7dd', fontSize: 16, fontWeight: '700' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
