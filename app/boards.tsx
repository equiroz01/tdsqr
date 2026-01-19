import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMenuBoards } from '../src/hooks/useMenuBoards';
import { useTranslation } from '../src/i18n';
import { MenuBoard } from '../src/types';

export default function BoardsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { t } = useTranslation();
  const { boards, loading, deleteBoard } = useMenuBoards();

  const mode = params.mode === 'select' ? 'select' : 'manage';

  const handleSelectBoard = (board: MenuBoard) => {
    if (mode === 'select') {
      // Navigate back to control with selected board
      router.navigate({
        pathname: '/control',
        params: { selectedBoardId: board.id },
      });
    } else {
      // Navigate to editor
      router.push({
        pathname: '/board-editor' as any,
        params: { boardId: board.id },
      });
    }
  };

  const handleCreateBoard = () => {
    router.push({
      pathname: '/board-editor' as any,
      params: { boardId: 'new' },
    });
  };

  const handleDeleteBoard = (board: MenuBoard) => {
    Alert.alert(
      t('deleteBoard') || 'Delete Template',
      (t('deleteBoardConfirm') || 'Are you sure you want to delete "{name}"?').replace('{name}', board.name),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: () => deleteBoard(board.id),
        },
      ]
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  const renderBoard = ({ item }: { item: MenuBoard }) => {
    const itemCount = item.qrItems.length + item.slideItems.length;

    return (
      <TouchableOpacity
        style={styles.boardCard}
        onPress={() => handleSelectBoard(item)}
        onLongPress={() => handleDeleteBoard(item)}
      >
        <View style={styles.boardInfo}>
          <Text style={styles.boardName}>{item.name || t('untitled') || 'Untitled'}</Text>
          {item.description ? (
            <Text style={styles.boardDescription} numberOfLines={1}>
              {item.description}
            </Text>
          ) : null}
          <View style={styles.boardMeta}>
            <Text style={styles.boardMetaText}>
              {itemCount} {t('elements')}
            </Text>
            <Text style={styles.boardMetaSeparator}>•</Text>
            <Text style={styles.boardMetaText}>
              {formatDate(item.updatedAt)}
            </Text>
          </View>
        </View>
        <View style={styles.boardArrow}>
          <Text style={styles.boardArrowText}>›</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2DD4BF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{t('back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('templates') || 'Templates'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {mode === 'select' && (
        <Text style={styles.selectHint}>
          {t('selectBoardHint') || 'Select a template to sync with the TV'}
        </Text>
      )}

      {boards.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>{t('noBoards') || 'No templates yet'}</Text>
          <Text style={styles.emptyStateHint}>
            {t('createBoardHint') || 'Create your first template to organize your content'}
          </Text>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateBoard}>
            <Text style={styles.createButtonText}>{t('createBoard') || 'Create Template'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={boards}
            keyExtractor={(item) => item.id}
            renderItem={renderBoard}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
          <View style={styles.footer}>
            <TouchableOpacity style={styles.fabButton} onPress={handleCreateBoard}>
              <Text style={styles.fabButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {mode === 'manage' && boards.length > 0 && (
        <Text style={styles.deleteHint}>
          {t('longPressToDelete') || 'Long press to delete'}
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2D3A',
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#5EEAD4',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSpacer: {
    width: 60,
  },
  selectHint: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(45, 212, 191, 0.1)',
  },
  listContent: {
    padding: 20,
    gap: 12,
  },
  boardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16161F',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2D2D3A',
  },
  boardInfo: {
    flex: 1,
  },
  boardName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  boardDescription: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  boardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  boardMetaText: {
    fontSize: 12,
    color: '#6B7280',
  },
  boardMetaSeparator: {
    fontSize: 12,
    color: '#6B7280',
    marginHorizontal: 8,
  },
  boardArrow: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boardArrowText: {
    fontSize: 24,
    color: '#6B7280',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyStateHint: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    backgroundColor: '#2DD4BF',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    right: 20,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2DD4BF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2DD4BF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabButtonText: {
    fontSize: 28,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  deleteHint: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
    paddingBottom: 20,
  },
});
