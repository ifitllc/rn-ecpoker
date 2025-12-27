import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { useGame } from '../state/GameProvider';
import { Player } from '../types';

const SetupScreen: React.FC<{ onNavigate: (key: 'dashboard' | 'game' | 'setup') => void }> = ({ onNavigate }) => {
  const { players, deckCount, setDeckCount, addPlayer, togglePlayerStatus, currentDealerSeat } = useGame();
  const [name, setName] = useState('');
  const [seat, setSeat] = useState('');

  const handleAdd = () => {
    const seatNo = parseInt(seat, 10);
    if (!name || Number.isNaN(seatNo)) return;
    addPlayer(name.trim(), seatNo);
    setName('');
    setSeat('');
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
        <Text style={styles.label}>Decks (m)</Text>
        <TextInput
          value={String(deckCount)}
          onChangeText={(text) => setDeckCount(Number(text) || 1)}
          keyboardType="number-pad"
          style={styles.input}
          placeholder="Deck count"
          placeholderTextColor="#789"
        />
      </View>

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

      <FlatList data={players} keyExtractor={(p) => p.id} renderItem={renderPlayer} contentContainerStyle={{ gap: 8 }} />

      <View style={styles.footer}> 
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => onNavigate('dashboard')}>
          <Text style={styles.secondaryText}>View Leaderboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => onNavigate('game')}>
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
});
