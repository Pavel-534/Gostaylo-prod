/**
 * FunnyRent 2.1 - Supabase Realtime Chat Hook
 * Provides instant message sync using Supabase Realtime
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with realtime enabled
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Notification sound (base64 encoded short beep)
const NOTIFICATION_SOUND = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH+Onpi0u7nGysm+tKmdkIB3cXl5f4eFiY2RkZGRkZGOiYV/eXNua2loaGhrbXN5f4WJjpGRkZGRjouGgXt1cG1qaGhoaWtvc3l/hYqOkZGRkZGOi4aBe3VwbWpoaGhpa29zeX+Fio6RkZGRkY6LhoF7dXBtamhoaGlrb3N5f4WKjpGRkZGRjouGgXt1cG1qaGhoaWtvc3l/hYqOkZGRkZGOi4aBe3VwbWpoaGhpa29zeX+Fio6RkZGRkY6LhoF7dXBtamhoaGlrb3N5f4WKjpGRkZGRjouGgXt1cG1qaGhoaWtvc3l/hYqOkZGRkQ==';

/**
 * Play notification sound for new messages
 */
export function playNotificationSound() {
  try {
    const audio = new Audio(NOTIFICATION_SOUND);
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Ignore autoplay errors
    });
  } catch (e) {
    // Ignore errors
  }
}

/**
 * Custom hook for realtime chat messages
 * @param {string} conversationId - The conversation ID to subscribe to
 * @param {Function} onNewMessage - Callback when new message arrives
 * @returns {Object} { messages, isConnected, error, sendMessage }
 */
export function useRealtimeMessages(conversationId, onNewMessage = null) {
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!conversationId) return;

    // Subscribe to messages channel for this conversation
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          console.log('[REALTIME] New message:', payload);
          const newMessage = payload.new;
          
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });

          // Play sound for messages from others
          if (onNewMessage) {
            onNewMessage(newMessage);
          }
          playNotificationSound();
        }
      )
      .on('presence', { event: 'sync' }, () => {
        setIsConnected(true);
      })
      .subscribe((status) => {
        console.log('[REALTIME] Channel status:', status);
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
        } else if (status === 'CHANNEL_ERROR') {
          setError('Connection failed');
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId, onNewMessage]);

  return { messages, setMessages, isConnected, error };
}

/**
 * Custom hook for user presence (online/offline status)
 * @param {string} conversationId - The conversation ID
 * @param {string} userId - Current user ID
 * @returns {Object} { onlineUsers, isOnline }
 */
export function usePresence(conversationId, userId) {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!conversationId || !userId) return;

    const channel = supabase
      .channel(`presence:${conversationId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat().map(p => p.user_id);
        setOnlineUsers(users);
        setIsOnline(users.length > 1); // More than just current user
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('[PRESENCE] User joined:', newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('[PRESENCE] User left:', leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track current user's presence
          await channel.track({
            user_id: userId,
            online_at: new Date().toISOString()
          });
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId, userId]);

  return { onlineUsers, isOnline };
}

/**
 * Custom hook for conversation list updates
 * @param {string} userId - User ID to watch conversations for
 * @returns {Object} { conversations, unreadCount }
 */
export function useRealtimeConversations(userId) {
  const [conversations, setConversations] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    // Subscribe to conversations updates
    const channel = supabase
      .channel(`conversations:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        (payload) => {
          console.log('[REALTIME] Conversation update:', payload);
          // Trigger refresh
          setConversations(prev => {
            if (payload.eventType === 'INSERT') {
              return [...prev, payload.new];
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map(c => c.id === payload.new.id ? payload.new : c);
            }
            return prev;
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId]);

  return { conversations, setConversations, unreadCount };
}

export default {
  useRealtimeMessages,
  usePresence,
  useRealtimeConversations,
  playNotificationSound
};
