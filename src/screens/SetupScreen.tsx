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
    swapPlayerSeat,
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
  const [nameError, setNameError] = useState<string | null>(null);
  const [checkingName, setCheckingName] = useState(false);
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);
  const listRef = useRef<FlatList<Player>>(null);

  const generateId = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

  const nextSeat = useMemo(() => {
    if (!players.length) return 1;
    return Math.max(...players.map((p) => p.seatNo)) + 1;
  }, [players]);

  const maxSeat = useMemo(() => {
    if (!players.length) return 0;
    return Math.max(...players.map((p) => p.seatNo));
  }, [players]);

  useEffect(() => {
    let cancelled = false;
      const loadRecent = async () => {
        if (!hasSupabaseConfig || !supabase) return;
        setLoadingRecent(true);
        const { data, error } = await supabase
          .from('players')
          .select('id, name, updated_at')
          .order('updated_at', { ascending: false })
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

    const checkNameExists = async (candidate: string) => {
      if (!hasSupabaseConfig || !supabase) return null;
      const { data, error } = await supabase
        .from('players')
        .select('id')
        .ilike('name', candidate)
        .limit(1)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') {
        console.warn('Failed to check duplicate player name', error.message);
        return null;
      }
      return data?.id ?? null;
    };

    const handleAdd = async (override?: { name?: string; seatNo?: number; playerId?: string }) => {
      if (checkingName) return;
      const parsed = override?.seatNo ?? parseInt(seat, 10);
      const seatNo = Number.isNaN(parsed) ? nextSeat : parsed;
      const trimmed = (override?.name ?? name).trim();
      if (!trimmed) return;

      if (swapSourceId) {
        // Prefer explicit target seat if selected; otherwise use typed seat
        const targetSeatFromId = players.find((p) => p.id === swapTargetId)?.seatNo;
        const seatTarget = targetSeatFromId ?? seatNo;
        swapPlayerSeat(swapSourceId, seatTarget);
        setSwapSourceId(null);
        setSwapTargetId(null);
        setSelectedRecentId(null);
        setName('');
        setSeat('');
        setSeatDirty(false);
        setNameError(null);
        return;
      }

      setCheckingName(true);
      const existingId = override?.playerId ?? (await checkNameExists(trimmed));
      setCheckingName(false);

      const playerId = override?.playerId ?? selectedRecentId ?? existingId ?? generateId();

      setNameError(null);
      addPlayer(trimmed, seatNo, { persist: false, id: playerId });

      if (hasSupabaseConfig && supabase) {
        const now = new Date().toISOString();
        const payload = { id: playerId, name: trimmed, updated_at: now } as const;
        const { error } = await supabase.from('players').upsert(payload);
        if (error) console.warn('Failed to upsert player timestamp', error.message);
      }

      setName('');
      setSeat(String(seatNo + 1));
      setSeatDirty(false);
      setSelectedRecentId(null);
    };

    const handleSelectPlayer = (item: Player) => {
        if (swapSourceId && swapSourceId !== item.id) {
          setSeat(String(item.seatNo));
        setSwapTargetId(item.id);
          setSeatDirty(true);
          setNameError(null);
          return;
        }
        setName(item.name);
        setSeat(String(item.seatNo));
      setSelectedRecentId(item.id);
      setSwapTargetId(null);
        setSeatDirty(true);
        setNameError(null);
      };

    const renderPlayer = ({ item }: { item: Player }) => (
      <TouchableOpacity
        style={[styles.playerRow, item.seatNo === currentDealerSeat && styles.dealerRow]}
        onPress={() => handleSelectPlayer(item)}
        activeOpacity={0.8}
      >
        <View>
          <Text style={styles.playerName}>{item.name}</Text>
          <Text style={styles.playerMeta}>Seat {item.seatNo} · Rank {item.rank}</Text>
        </View>
        <View style={styles.rowActions}>
          <TouchableOpacity
            style={[styles.swapBtn, swapSourceId === item.id && styles.swapBtnActive]}
            onPress={() => {
              setSwapSourceId((prev) => (prev === item.id ? null : item.id));
                setSwapTargetId(null);
              setName(item.name);
              setSeat(String(item.seatNo));
              setSelectedRecentId(item.id);
              setSeatDirty(true);
              setNameError(null);
            }}
            accessibilityLabel={`Select ${item.name} to swap seats`}
          >
            <Text style={[styles.swapText, swapSourceId === item.id && styles.swapTextActive]}>⇆</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.swapBtn}
            onPress={() => swapPlayerSeat(item.id, item.seatNo - 1)}
            disabled={item.seatNo <= 1}
            accessibilityLabel={`Move ${item.name} up`}
          >
            <Text style={styles.swapText}>↑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.swapBtn}
            onPress={() => swapPlayerSeat(item.id, item.seatNo + 1)}
            disabled={item.seatNo >= maxSeat}
            accessibilityLabel={`Move ${item.name} down`}
          >
            <Text style={styles.swapText}>↓</Text>
          </TouchableOpacity>
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
      </TouchableOpacity>
    );

    const lastRecentTap = useRef<number>(0);

    const handleRecentPress = (p: { id: string; name: string }) => {
      const now = Date.now();
      const isDouble = now - lastRecentTap.current < 300;
      lastRecentTap.current = now;
      if (swapSourceId && swapSourceId !== p.id) {
        setSwapTargetId(p.id);
        setSeatDirty(true);
        setSeat('');
        setName(p.name);
      } else {
        setSelectedRecentId(p.id);
        setName(p.name);
        setSeatDirty(false);
      }
      if (isDouble) void handleAdd({ name: p.name, playerId: p.id });
    };

    const actionLabel = swapSourceId ? 'Swap seats' : selectedRecentId ? 'Update player' : 'Add player';
    const actionIcon = swapSourceId ? '⇆' : selectedRecentId ? '✏️' : '➕';

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
              setNameError(null);
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
          <TouchableOpacity
            style={[styles.primaryBtn, styles.addBtn]}
            onPress={handleAdd}
            accessibilityLabel={actionLabel}
          >
            <Text style={[styles.primaryText, styles.addText]}>{actionIcon}</Text>
        </TouchableOpacity>
      </View>

      {nameError && <Text style={styles.errorText}>{nameError}</Text>}

      <View style={styles.suggestionBox}>
        <View style={styles.suggestionHeader}>
          <Text style={styles.suggestionTitle}>Recent players</Text>
          {loadingRecent && <Text style={styles.suggestionMeta}>Loading...</Text>}
          {!hasSupabaseConfig && <Text style={styles.suggestionMeta}>Supabase not configured</Text>}
        </View>
        {swapSourceId && (
            <Text style={styles.swapHint}>
              已选择 {recentPlayers.find((p) => p.id === swapSourceId)?.name ?? '玩家'}，再选目标并点 {actionIcon} 确认交换
            </Text>
        )}
        <View style={styles.chipRow}>
          {recentChoices.length === 0 && !loadingRecent ? (
            <Text style={styles.suggestionMeta}>No players found</Text>
          ) : (
            recentChoices.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.suggestionChip, p.disabled && styles.suggestionChipDisabled]}
                onPress={() => {
                  const isSelf = swapSourceId === p.id;
                  if (isSelf) return;
                  if (p.disabled && !swapSourceId) return;
                  handleRecentPress(p);
                }}
                disabled={p.disabled && !swapSourceId}
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
  errorText: { color: '#f65a5a', fontSize: 12, marginTop: 4 },
  addBtn: {
    backgroundColor: '#2fd67f',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 14,
  },
  addText: { color: '#0b1c13', fontSize: 20 },
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
  swapBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#1f5a3c',
  },
  swapBtnActive: {
    backgroundColor: '#f4d35e',
  },
  swapText: { color: '#fefae0', fontWeight: '800', fontSize: 14 },
  swapTextActive: { color: '#122013' },
  swapHint: { color: '#dfe7dd', fontSize: 12, marginTop: 4 },
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
