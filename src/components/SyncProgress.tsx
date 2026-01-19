import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { ms, sp, widthPercent } from '../utils/responsive';

interface SyncProgressProps {
  visible: boolean;
  progress: number; // 0-100
  currentItem?: number;
  totalItems?: number;
  status?: 'sending' | 'receiving' | 'processing';
  title?: string;
  subtitle?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PROGRESS_BAR_WIDTH = Math.min(SCREEN_WIDTH * 0.7, 300);

export function SyncProgress({
  visible,
  progress,
  currentItem,
  totalItems,
  status = 'sending',
  title,
  subtitle,
}: SyncProgressProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  useEffect(() => {
    if (visible) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [visible]);

  const getStatusIcon = () => {
    switch (status) {
      case 'sending':
        return '↑';
      case 'receiving':
        return '↓';
      case 'processing':
        return '⟳';
      default:
        return '↻';
    }
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: [0, PROGRESS_BAR_WIDTH - ms(8)],
    extrapolate: 'clamp',
  });

  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon with pulse animation */}
          <Animated.View style={[styles.iconContainer, { opacity: pulseAnim }]}>
            <Text style={styles.icon}>{getStatusIcon()}</Text>
          </Animated.View>

          {/* Title */}
          <Text style={styles.title}>
            {title || (status === 'sending' ? 'Sincronizando...' : 'Recibiendo...')}
          </Text>

          {/* Progress bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  { width: progressWidth },
                ]}
              />
            </View>
          </View>

          {/* Percentage */}
          <Text style={styles.percentage}>{Math.round(progress)}%</Text>

          {/* Item count */}
          {currentItem !== undefined && totalItems !== undefined && (
            <Text style={styles.itemCount}>
              {currentItem} / {totalItems}
            </Text>
          )}

          {/* Subtitle */}
          {subtitle && (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#16161F',
    borderRadius: ms(20),
    padding: ms(32),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D3A',
    minWidth: widthPercent(70),
    maxWidth: widthPercent(85),
  },
  iconContainer: {
    width: ms(64),
    height: ms(64),
    borderRadius: ms(32),
    backgroundColor: 'rgba(45, 212, 191, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: ms(20),
  },
  icon: {
    fontSize: sp(32),
    color: '#2DD4BF',
  },
  title: {
    fontSize: sp(18),
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: ms(24),
    textAlign: 'center',
  },
  progressBarContainer: {
    width: PROGRESS_BAR_WIDTH,
    marginBottom: ms(12),
  },
  progressBarBackground: {
    width: '100%',
    height: ms(12),
    backgroundColor: '#2D2D3A',
    borderRadius: ms(6),
    overflow: 'hidden',
    padding: ms(2),
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2DD4BF',
    borderRadius: ms(4),
  },
  percentage: {
    fontSize: sp(32),
    fontWeight: 'bold',
    color: '#2DD4BF',
    marginBottom: ms(8),
  },
  itemCount: {
    fontSize: sp(14),
    color: '#9CA3AF',
    marginBottom: ms(4),
  },
  subtitle: {
    fontSize: sp(12),
    color: '#6B7280',
    textAlign: 'center',
    marginTop: ms(8),
  },
});
