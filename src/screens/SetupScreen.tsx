import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useGame } from '../state/GameProvider';
import { Player } from '../types';
import { supabase, hasSupabaseConfig } from '../services/supabaseClient';

const SetupScreen: React.FC<{ onNavigate: (key: 'dashboard' | 'game' | 'setup') => void }> = ({ onNavigate }) => {
  const { players, addPlayer, togglePlayerStatus, currentDealerSeat, startNewGame, resetGame } = useGame();
  const [name, setName] = useState('');
  const [seat, setSeat] = useState('');
  const [recentPlayers, setRecentPlayers] = useState<{ id: string; name: string }[]>([]);
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
    if (!seat) setSeat(String(nextSeat));
  }, [nextSeat, seat]);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [players.length]);

  const handleAdd = () => {
    const parsed = parseInt(seat, 10);
    const seatNo = Number.isNaN(parsed) ? nextSeat : parsed;
    if (!name) return;
    addPlayer(name.trim(), seatNo);
    setName('');
    setSeat(String(seatNo + 1));
  };

  const renderPlayer = ({ item }: { item: Player }) => (
    <View style={[styles.playerRow, item.seatNo === currentDealerSeat && styles.dealerRow]}>
      <View>
        <Text style={styles.playerName}>{item.name}</Text>
        <Text style={styles.playerMeta}>Seat {item.seatNo} · Rank {item.rank}</Text>
      </View>
      <TouchableOpacity
        style={[styles.chip, item.status === 'active' ? styles.activeChip : styles.frozenChip]}
        onPress={() => togglePlayerStatus(item.id, item.status === 'active' ? 'frozen' : 'active')}
      >
        <Text style={styles.chipText}>{item.status === 'active' ? 'Freeze' : 'Unfreeze'}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Setup Game</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Add player</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={styles.input}
          placeholder="Name"
          placeholderTextColor="#789"
        />
        <TextInput
          value={seat}
          onChangeText={setSeat}
          keyboardType="number-pad"
          style={[styles.input, styles.inputSmall]}
          placeholder="Seat"
          placeholderTextColor="#789"
        />
        <TouchableOpacity style={styles.primaryBtn} onPress={handleAdd}>
          <Text style={styles.primaryText}>Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.suggestionBox}>
        <View style={styles.suggestionHeader}>
          <Text style={styles.suggestionTitle}>Recent players</Text>
          {loadingRecent && <Text style={styles.suggestionMeta}>Loading...</Text>}
          {!hasSupabaseConfig && <Text style={styles.suggestionMeta}>Supabase not configured</Text>}
        </View>
        <View style={styles.chipRow}>
          {recentPlayers.length === 0 && !loadingRecent ? (
            <Text style={styles.suggestionMeta}>No players found</Text>
          ) : (
            recentPlayers.map((p) => (
              <TouchableOpacity key={p.id} style={styles.suggestionChip} onPress={() => setName(p.name)}>
                <Text style={styles.chipText}>{p.name}</Text>
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
        <TouchableOpacity style={styles.ghostBtn} onPress={() => { resetGame(); setName(''); setSeat(''); }}>
          <Text style={styles.secondaryText}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => onNavigate('dashboard')}>
          <Text style={styles.secondaryText}>View Leaderboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            startNewGame();
            onNavigate('game');
          }}
        >
          <Text style={styles.primaryText}>Start Scoring</Text>
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryText: { color: '#fefae0', fontWeight: '700' },
  secondaryBtn: {
    borderColor: '#1f5a3c',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryText: { color: '#b4c7b6', fontWeight: '600' },
  ghostBtn: {
    borderColor: '#3a3f46',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0f1f1a',
  },
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
});
