import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useGame } from '../state/GameProvider';
import { formatRank } from '../utils/scoreEngine';
import { RoundRecord } from '../types';

const DashboardScreen = () => {
  const { players, history, undoLastRound, currentDealerSeat } = useGame();

  const sorted = [...players].sort((a, b) => b.rank - a.rank || a.seatNo - b.seatNo);

  const renderHistory = ({ item }: { item: RoundRecord }) => (
    <View style={styles.historyRow}>
      <Text style={styles.historyText}>Dealer Seat {item.dealerSeat} {item.houseWon ? 'House Win' : 'House Lose'}</Text>
      <Text style={styles.historyMeta}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Leaderboard</Text>
      <FlatList
        data={sorted}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.rank}>{formatRank(item.rank)}</Text>
              <Text style={styles.name}>{item.name}</Text>
              {item.seatNo === currentDealerSeat && <Text style={styles.star}>*</Text>}
            </View>
            <Text style={styles.meta}>Seat {item.seatNo} · {item.status === 'active' ? 'Active' : 'Frozen'}</Text>
          </View>
        )}
        ListFooterComponent={<View style={{ height: 12 }} />}
        contentContainerStyle={{ gap: 8 }}
      />

      <View style={styles.historyHeader}>
        <Text style={styles.subtitle}>Round History</Text>
        <TouchableOpacity style={styles.undoBtn} onPress={undoLastRound}>
          <Text style={styles.undoText}>Undo</Text>
        </TouchableOpacity>
      </View>
      <FlatList data={[...history].reverse()} keyExtractor={(r) => r.id} renderItem={renderHistory} contentContainerStyle={{ gap: 6 }} />
    </View>
  );
};

export default DashboardScreen;

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12 },
  title: { color: '#f4d35e', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#dfe7dd', fontSize: 16, fontWeight: '700' },
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
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  historyRow: {
    backgroundColor: '#0d1d17',
    padding: 10,
    borderRadius: 10,
    borderColor: '#1f5a3c',
    borderWidth: 1,
  },
  historyText: { color: '#e8f1ec', fontWeight: '600' },
  historyMeta: { color: '#7fa28b', fontSize: 12 },
  undoBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#3a3f46',
  },
  undoText: { color: '#fefae0', fontWeight: '700' },
});
