import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "./useWallet";

const INDEXER_URL = process.env.EXPO_PUBLIC_INDEXER_URL || "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface UseNotificationsReturn {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

// ── Mock fallback ─────────────────────────────────────────────────────────────

function mockNotifications(): Notification[] {
  return [
    {
      id: "notif-1",
      type: "FOLLOW",
      message: "Someone followed you.",
      read: false,
      created_at: new Date(Date.now() - 3_600_000).toISOString(),
    },
    {
      id: "notif-2",
      type: "LIKE_RECEIVED",
      message: "Your post received a like.",
      read: false,
      created_at: new Date(Date.now() - 7_200_000).toISOString(),
    },
    {
      id: "notif-3",
      type: "TIP_RECEIVED",
      message: "You received a tip.",
      read: true,
      created_at: new Date(Date.now() - 86_400_000).toISOString(),
    },
  ];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNotifications(): UseNotificationsReturn {
  const { address } = useWallet();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!address) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${INDEXER_URL}/api/notifications?address=${encodeURIComponent(address)}`,
        { signal: AbortSignal.timeout(5_000) }
      );

      if (res.ok) {
        const data = await res.json();
        const list: Notification[] = Array.isArray(data)
          ? data
          : (data.notifications ?? []);
        if (mountedRef.current) setNotifications(list);
        return;
      }
    } catch {
      // Indexer unavailable — fall through to mock.
    }

    if (mountedRef.current) {
      setNotifications(mockNotifications());
    }
  }, [address]);

  // Eagerly fetch when the hook mounts or the wallet address changes.
  useEffect(() => {
    fetchNotifications().finally(() => {
      if (mountedRef.current) setLoading(false);
    });
  }, [fetchNotifications]);

  const refresh = useCallback(() => {
    fetchNotifications().finally(() => {
      if (mountedRef.current) setLoading(false);
    });
  }, [fetchNotifications]);

  const markAsRead = useCallback(
    async (id: string) => {
      // Optimistic update.
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );

      try {
        await fetch(`${INDEXER_URL}/api/notifications`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, address }),
          signal: AbortSignal.timeout(5_000),
        });
      } catch {
        // Best-effort — keep the optimistic state.
      }
    },
    [address]
  );

  const markAllAsRead = useCallback(async () => {
    // Optimistic update.
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      await fetch(`${INDEXER_URL}/api/notifications`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true, address }),
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      // Best-effort — keep the optimistic state.
    }
  }, [address]);

  return { notifications, loading, error, refresh, markAsRead, markAllAsRead };
}
