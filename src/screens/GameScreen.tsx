import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useGame } from '../state/GameProvider';

const GameScreen = () => {
  const { players, recordRound, currentDealerSeat, deckCount } = useGame();
  const activePlayers = players.filter((p) => p.status === 'active');

  const [firstCallerId, setFirstCallerId] = useState<string | null>(null);
  const [helperIds, setHelperIds] = useState<string[]>([]);
  const [nonHouseScore, setNonHouseScore] = useState('0');
  const [houseWon, setHouseWon] = useState(true);

  const maxHelpers = Math.max(0, Math.floor(activePlayers.length / 2) - 1);

  const toggleHelper = (id: string) => {
    setHelperIds((prev) => {
      if (prev.includes(id)) return prev.filter((h) => h !== id);
      if (prev.length >= maxHelpers) return prev;
      return [...prev, id];
    });
  };

  const submit = () => {
    if (!firstCallerId) {
      Alert.alert('请选择第一个叫牌的庄家');
      return;
    }
    const helpers = helperIds.filter((id) => id !== firstCallerId);
    const score = Number(nonHouseScore) || 0;
    recordRound({
      dealerSeat: currentDealerSeat,
      firstCallerId,
      helperIds: helpers,
      nonHouseScore: score,
      houseWon,
    });
    setHelperIds([]);
    setFirstCallerId(null);
    setNonHouseScore('0');
    setHouseWon(true);
  };

  const houseIds = useMemo(() => new Set([firstCallerId, ...helperIds]), [firstCallerId, helperIds]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scoring</Text>
      <Text style={styles.meta}>Dealer Seat: {currentDealerSeat} · Decks: {deckCount}</Text>

      <Text style={styles.label}>第一个叫牌的庄家</Text>
      <View style={styles.chipRow}>
        {activePlayers.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.chip, firstCallerId === p.id && styles.chipActive]}
            onPress={() => setFirstCallerId(p.id)}
          >
            <Text style={styles.chipText}>{p.name} ({p.seatNo})</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>帮手 (最多 {maxHelpers})</Text>
      <View style={styles.chipRow}>
        {activePlayers
          .filter((p) => p.id !== firstCallerId)
          .map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, helperIds.includes(p.id) && styles.chipActive]}
              onPress={() => toggleHelper(p.id)}
            >
              <Text style={styles.chipText}>{p.name} ({p.seatNo})</Text>
            </TouchableOpacity>
          ))}
      </View>

      <Text style={styles.label}>结果</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity style={[styles.toggleBtn, houseWon && styles.toggleActive]} onPress={() => setHouseWon(true)}>
          <Text style={styles.toggleText}>庄家赢</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.toggleBtn, !houseWon && styles.toggleActive]} onPress={() => setHouseWon(false)}>
          <Text style={styles.toggleText}>闲家赢</Text>
        </TouchableOpacity>
      </View>

      {!houseWon && (
        <View>
          <Text style={styles.label}>闲家分数</Text>
          <TextInput
            value={nonHouseScore}
            onChangeText={setNonHouseScore}
            keyboardType="number-pad"
            style={styles.input}
            placeholder="非庄家得分"
            placeholderTextColor="#789"
          />
        </View>
      )}

      <View style={styles.summary}> 
        <Text style={styles.summaryText}>庄家: {[...houseIds].filter(Boolean).length} 人</Text>
        <Text style={styles.summaryText}>闲家: {activePlayers.length - [...houseIds].filter(Boolean).length} 人</Text>
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={submit}>
        <Text style={styles.primaryText}>确认并下一轮 *</Text>
      </TouchableOpacity>
    </View>
  );
};

export default GameScreen;

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12 },
  title: { color: '#f4d35e', fontSize: 20, fontWeight: '700' },
  meta: { color: '#7fa28b' },
  label: { color: '#dfe7dd', fontWeight: '700', marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#10261d',
    borderWidth: 1,
    borderColor: '#1f5a3c',
  },
  chipActive: { backgroundColor: '#1f5a3c' },
  chipText: { color: '#e8f1ec', fontWeight: '600' },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#10261d',
    borderWidth: 1,
    borderColor: '#1f5a3c',
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: '#1f5a3c' },
  toggleText: { color: '#fefae0', fontWeight: '700' },
  input: {
    backgroundColor: '#10261d',
    color: '#e2f0e5',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryText: { color: '#e8f1ec', fontWeight: '600' },
  primaryBtn: {
    marginTop: 'auto',
    backgroundColor: '#f4d35e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#122013', fontWeight: '800', fontSize: 16 },
});
