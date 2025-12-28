import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useGame } from '../state/GameProvider';
import { Player } from '../types';
import { supabase, hasSupabaseConfig } from '../services/supabaseClient';

const SetupScreen: React.FC<{ onNavigate: (key: 'dashboard' | 'game' | 'setup') => void }> = ({ onNavigate }) => {
  const {
    players,
    history,
    addPlayer,
    removePlayer,
    togglePlayerStatus,
    currentDealerSeat,
    startNewGame,
    resetGame,
  } = useGame();
  const [name, setName] = useState('');
  const [seat, setSeat] = useState('');
  const [seatDirty, setSeatDirty] = useState(false);
  const [recentPlayers, setRecentPlayers] = useState<{ id: string; name: string }[]>([]);
  const [selectedRecentId, setSelectedRecentId] = useState<string | null>(null);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const listRef = useRef<FlatList<Player>>(null);

  const nextSeat = useMemo(() => {
    if (!players.length) return 1;
    return Math.max(...players.map((p) => p.seatNo)) + 1;
  }, [players]);

  useEffect(() => {
    let cancelled = false;
    const loadRecent = async () => {
      if (!hasSupabaseConfig || !supabase) return;
      setLoadingRecent(true);
      const { data, error } = await supabase
        .from('players')
        .select('id, name, created_at')
        .order('created_at', { ascending: true })
        .limit(12);
      if (!cancelled) {
        if (!error && data) setRecentPlayers(data.map(({ id, name }) => ({ id, name })));
        setLoadingRecent(false);
      }
    };
    loadRecent();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!seat && !seatDirty) setSeat(String(nextSeat));
  }, [nextSeat, seat, seatDirty]);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [players.length]);

  const existingNames = useMemo(() => new Set(players.map((p) => p.name.trim().toLowerCase())), [players]);
  const recentChoices = useMemo(
    () =>
      recentPlayers.map((p) => ({ ...p, disabled: existingNames.has(p.name.trim().toLowerCase()) })),
    [recentPlayers, existingNames],
  );

  const handleAdd = () => {
    const parsed = parseInt(seat, 10);
    const seatNo = Number.isNaN(parsed) ? nextSeat : parsed;
    if (!name) return;
    addPlayer(name.trim(), seatNo, { persist: !selectedRecentId, id: selectedRecentId ?? undefined });
    setName('');
    setSeat(String(seatNo + 1));
    setSeatDirty(false);
    setSelectedRecentId(null);
  };

  const renderPlayer = ({ item }: { item: Player }) => (
    <View style={[styles.playerRow, item.seatNo === currentDealerSeat && styles.dealerRow]}>
      <View>
        <Text style={styles.playerName}>{item.name}</Text>
        <Text style={styles.playerMeta}>Seat {item.seatNo} · Rank {item.rank}</Text>
      </View>
      <View style={styles.rowActions}>
        <TouchableOpacity
          style={[styles.chip, item.status === 'active' ? styles.activeChip : styles.frozenChip]}
          onPress={() => togglePlayerStatus(item.id, item.status === 'active' ? 'frozen' : 'active')}
          accessibilityLabel={item.status === 'active' ? 'Freeze player' : 'Unfreeze player'}
        >
          <Text
            style={[styles.chipText, item.status === 'frozen' ? styles.freezeIconFrozen : styles.freezeIconIdle]}
          >
            {item.status === 'active' ? '⛔' : '🚫'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => removePlayer(item.id)}
          accessibilityLabel={`Remove ${item.name}`}
        >
          <Text style={styles.removeText}>🗑️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Setup Game</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Add player</Text>
        <TextInput
          value={name}
          onChangeText={(val) => {
            setName(val);
            setSelectedRecentId(null);
          }}
          onFocus={() => setSelectedRecentId(null)}
          style={styles.input}
          placeholder="Name"
          placeholderTextColor="#789"
        />
        <TextInput
          value={seat}
          onChangeText={setSeat}
          onFocus={() => setSeatDirty(true)}
          keyboardType="number-pad"
          style={[styles.input, styles.inputSmall]}
          placeholder="Seat"
          placeholderTextColor="#789"
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd} accessibilityLabel="Add player">
          <Text style={styles.primaryText}>➕</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.suggestionBox}>
        <View style={styles.suggestionHeader}>
          <Text style={styles.suggestionTitle}>Recent players</Text>
          {loadingRecent && <Text style={styles.suggestionMeta}>Loading...</Text>}
          {!hasSupabaseConfig && <Text style={styles.suggestionMeta}>Supabase not configured</Text>}
        </View>
        <View style={styles.chipRow}>
          {recentChoices.length === 0 && !loadingRecent ? (
            <Text style={styles.suggestionMeta}>No players found</Text>
          ) : (
            recentChoices.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.suggestionChip, p.disabled && styles.suggestionChipDisabled]}
                onPress={() => {
                  if (p.disabled) return;
                  setSelectedRecentId(p.id);
                  setName(p.name);
                  setSeatDirty(false);
                }}
                disabled={p.disabled}
              >
                <Text style={[styles.chipText, p.disabled && styles.suggestionChipTextDisabled]}>{p.name}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={players}
        keyExtractor={(p) => p.id}
        renderItem={renderPlayer}
        contentContainerStyle={{ gap: 8, paddingBottom: 32 }}
      />

      <View style={styles.footer}> 
        <TouchableOpacity
          style={[styles.ghostBtn, styles.footerBtn]}
          onPress={() => { resetGame(); setName(''); setSeat(''); setSeatDirty(false); setSelectedRecentId(null); }}
          accessibilityLabel="Reset"
        >
          <Text style={[styles.secondaryText, styles.footerIcon]}>⟳</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.primaryBtn, styles.footerBtn]}
          onPress={() => {
            if (history.length === 0) startNewGame();
            onNavigate('game');
          }}
          accessibilityLabel="Start scoring"
        >
          <Text style={[styles.primaryText, styles.startIcon, styles.footerIcon]}>▶️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default SetupScreen;

const styles = StyleSheet.create({
  container: { flex: 1, gap: 12 },
  title: { color: '#f4d35e', fontSize: 20, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { color: '#dfe7dd', width: 90 },
  input: {
    flex: 1,
    backgroundColor: '#10261d',
    color: '#e2f0e5',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  inputSmall: { flex: 0.4 },
  primaryBtn: {
    backgroundColor: '#1f5a3c',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    minWidth: 72,
    alignItems: 'center',
  },
  primaryText: { color: '#fefae0', fontWeight: '800', fontSize: 16 },
  startIcon: { color: '#4ade80' },
  footerIcon: { fontSize: 28 },
  secondaryBtn: {
    borderColor: '#1f5a3c',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    minWidth: 72,
    alignItems: 'center',
  },
  secondaryText: { color: '#b4c7b6', fontWeight: '700', fontSize: 15 },
  ghostBtn: {
    borderColor: '#3a3f46',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#0f1f1a',
    minWidth: 72,
    alignItems: 'center',
  },
  footerBtn: { flex: 1 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#10261d',
  },
  dealerRow: {
    borderColor: '#f4d35e',
    borderWidth: 1,
  },
  playerName: { color: '#e8f1ec', fontSize: 16, fontWeight: '600' },
  playerMeta: { color: '#7fa28b', fontSize: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeChip: { backgroundColor: '#1f5a3c' },
  frozenChip: { backgroundColor: '#3a3f46' },
  chipText: { color: '#fefae0', fontWeight: '700' },
  freezeIconFrozen: { color: '#f65a5a' },
  freezeIconIdle: { color: '#9aa5a6' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#3a3f46',
  },
  removeText: { color: '#fefae0', fontWeight: '800', fontSize: 14 },
  footer: { flexDirection: 'row', gap: 10, marginTop: 8 },
  suggestionBox: {
    backgroundColor: '#0f241c',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1f5a3c',
    gap: 6,
  },
  suggestionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  suggestionTitle: { color: '#dfe7dd', fontWeight: '700' },
  suggestionMeta: { color: '#7fa28b', fontSize: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#10261d',
    borderWidth: 1,
    borderColor: '#1f5a3c',
  },
  suggestionChipDisabled: {
    opacity: 0.4,
  },
  suggestionChipTextDisabled: {
    color: '#7a857f',
  },
});
