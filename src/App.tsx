import React, { useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import { GameProvider } from './state/GameProvider';
import SetupScreen from './screens/SetupScreen';
import DashboardScreen from './screens/DashboardScreen';
import GameScreen from './screens/GameScreen';

const tabs = [
  { key: 'setup', label: 'Setup' },
  { key: 'dashboard', label: 'Leaderboard' },
  { key: 'game', label: 'Scoring' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

const AppInner = () => {
  const [tab, setTab] = useState<TabKey>('setup');

  const renderTab = () => {
    if (tab === 'setup') return <SetupScreen onNavigate={setTab} />;
    if (tab === 'dashboard') return <DashboardScreen />;
    return <GameScreen />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.tabBar}>
        {tabs.map((t) => (
          <TouchableOpacity key={t.key} style={[styles.tabButton, tab === t.key && styles.tabButtonActive]} onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.content}>{renderTab()}</View>
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1f1a',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    backgroundColor: '#173328',
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#1f5a3c',
  },
  tabText: {
    color: '#b4c7b6',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#f4d35e',
  },
  content: {
    flex: 1,
    padding: 16,
  },
});
