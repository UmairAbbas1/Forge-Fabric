import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, isRealSupabase } from "../../lib/supabase";
import type { NotificationLog } from "../../lib/types";

const MOCK_NOTIFICATIONS: NotificationLog[] = [
  {
    id: "notif-1",
    recipient_email: "merchandiser@forgefabric.com",
    notification_type: "new_submission",
    subject: "New Application Received: Demo Brand (APP-2026-0881)",
    body: "Demo Brand submitted a new order application for 457 units of 1947 501XX Selvedge.",
    sent_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    delivered: true,
    opened: false,
  },
  {
    id: "notif-2",
    recipient_email: "merchandiser@forgefabric.com",
    notification_type: "update_request",
    subject: "Urgent Update Request: Size Breakdown Revision (upd-001)",
    body: "Marcus Vance requested +15 pcs increase for Size 34 & 36 on WO-101.",
    sent_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    delivered: true,
    opened: false,
  },
  {
    id: "notif-3",
    recipient_email: "merchandiser@forgefabric.com",
    notification_type: "cut_sheet_approved",
    subject: "Cut Sheet Approved for Iron Heart 21oz Heavy",
    body: "Cutting supervisor approved Factory One cut sheet for production line.",
    sent_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    delivered: true,
    opened: true,
  },
];

export function useNotifications(userEmail?: string, userId?: string) {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, refetch } = useQuery<NotificationLog[]>({
    queryKey: ['notifications_log', userEmail, userId],
    queryFn: async () => {
      if (!isRealSupabase) {
        const saved = localStorage.getItem('forge_notifications_cache');
        return saved ? JSON.parse(saved) : MOCK_NOTIFICATIONS;
      }

      let query = supabase
        .from('notification_logs')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(30);

      if (userEmail) {
        query = query.or(`recipient_email.eq.${userEmail},recipient_id.eq.${userId || ''}`);
      }

      const { data, error } = await query;
      if (error) {
        console.warn('Fallback to mock notifications:', error.message);
        return MOCK_NOTIFICATIONS;
      }

      return (data && data.length > 0) ? data : MOCK_NOTIFICATIONS;
    },
  });

  // Real-time channel subscription (Fix #6 & #18)
  useEffect(() => {
    if (!isRealSupabase) return;

    const channelName = userId ? `notifications:${userId}` : 'notifications_global';
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notification_logs' },
        (_payload: any) => {
          queryClient.invalidateQueries({ queryKey: ['notifications_log'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, userId]);

  // Mark notification as read
  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      if (isRealSupabase) {
        await supabase
          .from('notification_logs')
          .update({ opened: true })
          .eq('id', notificationId);
      }

      const currentList: NotificationLog[] = JSON.parse(
        localStorage.getItem('forge_notifications_cache') || JSON.stringify(notifications)
      );
      const updated = currentList.map((n) =>
        n.id === notificationId ? { ...n, opened: true } : n
      );
      localStorage.setItem('forge_notifications_cache', JSON.stringify(updated));
      return { id: notificationId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications_log'] });
    },
  });

  // Mark all as read
  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (isRealSupabase && userEmail) {
        await supabase
          .from('notification_logs')
          .update({ opened: true })
          .eq('recipient_email', userEmail);
      }

      const updated = notifications.map((n) => ({ ...n, opened: true }));
      localStorage.setItem('forge_notifications_cache', JSON.stringify(updated));
      return { count: updated.length };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications_log'] });
    },
  });

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.opened).length;
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    refetch,
    markAsRead: markAsRead.mutate,
    markAllAsRead: markAllAsRead.mutate,
  };
}
