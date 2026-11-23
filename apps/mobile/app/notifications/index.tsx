import React, { useCallback, useLayoutEffect, useRef } from "react";
import {
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useNavigation } from "expo-router";
import { useNotifications, Notification } from "../../hooks/useNotifications";
import { useTheme } from "../../theme/useTheme";

// ── Swipeable notification row ────────────────────────────────────────────────

interface NotificationRowProps {
  item: Notification;
  onMarkRead: (id: string) => void;
}

function NotificationRow({ item, onMarkRead }: NotificationRowProps) {
  const { theme } = useTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        // Only allow leftward swipe.
        if (gs.dx < 0) translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -60 && !item.read && !isAnimating.current) {
          // Swipe threshold crossed — animate out then mark as read.
          isAnimating.current = true;
          Animated.timing(translateX, {
            toValue: -120,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            onMarkRead(item.id);
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start(() => {
              isAnimating.current = false;
            });
          });
        } else {
          // Snap back.
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  const unreadDotColor = item.read
    ? "transparent"
    : theme.colors.brand.primary;

  return (
    <View style={styles.rowWrapper}>
      {/* Revealed "Mark Read" action underneath */}
      <View style={[styles.swipeAction, { backgroundColor: theme.colors.brand.primary }]}>
        <Text style={styles.swipeActionText}>Mark Read</Text>
      </View>

      <Animated.View
        style={[
          styles.row,
          { backgroundColor: theme.colors.surface.surface1, transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        {/* Unread indicator dot */}
        <View style={[styles.unreadDot, { backgroundColor: unreadDotColor }]} />

        <View style={styles.rowContent}>
          <Text style={[styles.rowType, { color: theme.colors.brand.accent }]}>
            {item.type.replace(/_/g, " ")}
          </Text>
          <Text style={[styles.rowMessage, { color: theme.colors.text.primary }]}>
            {item.message}
          </Text>
          <Text style={[styles.rowTime, { color: theme.colors.text.secondary }]}>
            {new Date(item.created_at).toLocaleString()}
          </Text>
        </View>

        {!item.read && (
          <TouchableOpacity
            onPress={() => onMarkRead(item.id)}
            style={[styles.markReadButton, { borderColor: theme.colors.brand.primary }]}
            accessibilityRole="button"
            accessibilityLabel="Mark notification as read"
          >
            <Text style={[styles.markReadButtonText, { color: theme.colors.brand.primary }]}>
              Read
            </Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { notifications, loading, refresh, markAsRead, markAllAsRead } = useNotifications();

  // Inject "Mark all as read" into the header.
  useLayoutEffect(() => {
    navigation.setOptions({
      title: "Notifications",
      headerRight: () => (
        <Pressable
          onPress={markAllAsRead}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="Mark all notifications as read"
        >
          <Text style={[styles.headerButtonText, { color: theme.colors.brand.primary }]}>
            Mark all read
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, markAllAsRead, theme]);

  const handleMarkRead = useCallback(
    (id: string) => {
      markAsRead(id);
    },
    [markAsRead]
  );

  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <NotificationRow item={item} onMarkRead={handleMarkRead} />
    ),
    [handleMarkRead]
  );

  return (
    <FlatList<Notification>
      style={[styles.container, { backgroundColor: theme.colors.surface.background }]}
      contentContainerStyle={
        notifications.length === 0 ? styles.emptyContainer : styles.listContent
      }
      data={notifications}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🔔</Text>
          <Text style={[styles.emptyTitle, { color: theme.colors.text.primary }]}>
            No notifications
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.text.secondary }]}>
            You're all caught up. New activity will appear here.
          </Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refresh}
          tintColor={theme.colors.brand.primary}
          colors={[theme.colors.brand.primary]}
        />
      }
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  rowWrapper: {
    marginHorizontal: 12,
    marginVertical: 4,
    borderRadius: 10,
    overflow: "hidden",
  },
  swipeAction: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 120,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  swipeActionText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
    flexShrink: 0,
  },
  rowContent: {
    flex: 1,
  },
  rowType: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  rowMessage: {
    fontSize: 15,
    marginBottom: 4,
    lineHeight: 20,
  },
  rowTime: {
    fontSize: 12,
  },
  markReadButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 8,
  },
  markReadButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  headerButton: {
    marginRight: 16,
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
