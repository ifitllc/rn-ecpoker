import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView, Platform, StatusBar } from 'react-native';
import { useGame } from '../state/GameProvider';
import { formatRank } from '../utils/scoreEngine';

const GameScreen = () => {
  const { players, previewRound, confirmPendingRound, currentDealerSeat, undoLastRound, roundIndex, togglePlayerStatus } = useGame();
  const sortedPlayers = useMemo(() => [...players].sort((a, b) => a.seatNo - b.seatNo), [players]);
  const activePlayers = sortedPlayers.filter((p) => p.status === 'active');

  const [firstCallerId, setFirstCallerId] = useState<string | null>(null);
  const [helperIds, setHelperIds] = useState<string[]>([]);
  const [houseWon, setHouseWon] = useState(true);
  const [levelSteps, setLevelSteps] = useState(1);

  const maxHouseSize = activePlayers.length === 6
    ? 3
    : Math.max(1, Math.floor((activePlayers.length - 1) / 2));

  const totalHouseSelected = useMemo(() => {
    const helperCount = helperIds.length;
    const first = firstCallerId ? 1 : 0;
    return first + helperCount;
  }, [firstCallerId, helperIds]);

  const toggleHouseMember = (id: string, frozen: boolean) => {
    if (frozen) return;
    if (firstCallerId === id) {
      setFirstCallerId(null);
      return;
    }
    if (helperIds.includes(id)) {
      setHelperIds((prev) => prev.filter((h) => h !== id));
      return;
    }
    if (!firstCallerId) {
      setFirstCallerId(id);
      return;
    }
    if (totalHouseSelected >= maxHouseSize) return;
    setHelperIds((prev) => [...prev, id]);
  };

  const commitRound = (outcome: boolean) => {
    const callerId = firstCallerId;
    if (!callerId) {
      Alert.alert('请选择第一个叫牌的庄家');
      return null;
    }
    const helpers = helperIds.filter((id) => id !== callerId);
    const steps = Math.max(1, levelSteps);
    const round = {
      dealerSeat: currentDealerSeat,
      firstCallerId: callerId,
      helperIds: helpers,
      houseWon: outcome,
      levelSteps: steps,
    } as const;
    previewRound(round);
    return round;
  };

  const submit = () => {
    const round = commitRound(houseWon);
    if (!round) return;
    confirmPendingRound();
    setHelperIds([]);
    setFirstCallerId(null);
    setHouseWon(true);
    setLevelSteps(1);
  };

  const handleOutcomeSelect = (outcome: boolean) => {
    // 仅切换胜负选择，不立刻结算，防止 Round No 先行递增
    setHouseWon(outcome);
    commitRound(outcome);
  };

  const houseIds = useMemo(() => new Set([firstCallerId, ...helperIds]), [firstCallerId, helperIds]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Round {roundIndex + 1}</Text>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        <View style={styles.listHeader}>
          <Text style={styles.label}>Players (seat order)</Text>
          <Text style={styles.meta}>庄家上限: {maxHouseSize} 人</Text>
        </View>

        <View style={styles.playerList}>
          {sortedPlayers.map((p) => {
            const isHouse = houseIds.has(p.id);
            const isFirst = p.id === firstCallerId;
            const isHelper = helperIds.includes(p.id);
            const isDealerMark = p.status === 'active' && p.seatNo === currentDealerSeat;
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.playerRow,
                  p.status !== 'active' && styles.frozenRow,
                  isDealerMark && styles.dealerRow,
                ]}
                onPress={() => toggleHouseMember(p.id, p.status !== 'active')}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.playerName}>
                    {p.seatNo}. {p.name} {isDealerMark ? ' *' : ''}
                  </Text>
                  <Text style={styles.playerMeta}>Rank: {formatRank(p.rank)}</Text>
                </View>
                <View style={styles.tags}>
                  {isFirst && <Text style={styles.firstFlag}>🟢</Text>}
                  {isHelper && <Text style={styles.helperFlag}>🔵</Text>}
                  <TouchableOpacity
                    style={styles.freezeBtn}
                    onPress={() => togglePlayerStatus(p.id, p.status === 'active' ? 'frozen' : 'active')}
                  >
                    <Text style={styles.freezeText}>{p.status === 'active' ? 'Freeze' : 'Unfreeze'}</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>

      <View style={styles.bottomBarWrapper} pointerEvents="box-none">
        <View style={styles.bottomBar}>
          <View style={styles.levelRow}>
            <Text style={styles.label}>升级</Text>
            <View style={styles.stepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setLevelSteps((v) => Math.max(1, v - 1))}>
                <Text style={styles.stepText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.levelValue}>{levelSteps}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setLevelSteps((v) => v + 1)}>
                <Text style={styles.stepText}>+</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.undoBtn} onPress={undoLastRound}>
              <Text style={styles.secondaryText}>撤销</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.toggleRow}>
            <TouchableOpacity style={[styles.toggleBtn, houseWon && styles.toggleActive]} onPress={() => handleOutcomeSelect(true)}>
              <Text style={styles.toggleText}>庄家赢</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, !houseWon && styles.toggleActive]} onPress={() => handleOutcomeSelect(false)}>
              <Text style={styles.toggleText}>闲家赢</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={[styles.primaryBtn, styles.primaryFlex]} onPress={submit}>
            <Text style={styles.primaryText}>确认并下一轮 *</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default GameScreen;

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12, paddingBottom: 16 },
  title: { color: '#f4d35e', fontSize: 20, fontWeight: '700' },
  meta: { color: '#7fa28b' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playerList: { gap: 8 },
  scrollArea: { flex: 1 },
  scrollContent: { paddingBottom: 220, gap: 12 },
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
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f5a3c',
  },
  stepText: { color: '#fefae0', fontWeight: '800', fontSize: 18 },
  levelValue: { color: '#e8f1ec', fontWeight: '800', fontSize: 16, minWidth: 28, textAlign: 'center' },
  undoBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f5a3c',
    backgroundColor: '#10261d',
    marginLeft: 'auto',
  },
  primaryBtn: {
    backgroundColor: '#f4d35e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryText: { color: '#122013', fontWeight: '800', fontSize: 16 },
  bottomBarWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bottomBar: {
    gap: 12,
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: 40, android: (StatusBar.currentHeight ?? 0) + 24, default: 32 }),
    paddingHorizontal: 16,
    backgroundColor: '#0f1f1a',
  },
  secondaryBtn: {
    borderColor: '#1f5a3c',
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryText: { color: '#b4c7b6', fontWeight: '700' },
  primaryFlex: { flex: 1 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#10261d',
    borderWidth: 1,
    borderColor: '#1f5a3c',
    gap: 8,
  },
  frozenRow: { backgroundColor: '#3a3f46', opacity: 0.7 },
  dealerRow: { borderColor: '#f4d35e' },
  playerName: { color: '#e8f1ec', fontSize: 16, fontWeight: '700' },
  playerMeta: { color: '#7fa28b', fontSize: 12 },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  firstFlag: { fontSize: 16 },
  helperFlag: { fontSize: 16 },
  freezeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#1f5a3c',
  },
  freezeText: { color: '#fefae0', fontWeight: '700', fontSize: 12 },
});
