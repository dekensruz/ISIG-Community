import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';

type UnreadMessagesContextType = {
  unreadCount: number;
  fetchUnreadCount: () => void;
};

const UnreadMessagesContext = createContext<UnreadMessagesContextType>({
  unreadCount: 0,
  fetchUnreadCount: () => {},
});

export const useUnreadMessages = () => useContext(UnreadMessagesContext);

const UnreadMessagesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!session?.user) {
      setUnreadCount(0);
      return;
    }

    const { data, error } = await supabase.rpc('get_unread_messages_count');
    
    if (error) {
      console.error('Error fetching unread messages count:', error);
      setUnreadCount(0);
    } else {
      setUnreadCount(data);
    }
  }, [session]);

  useEffect(() => {
    fetchUnreadCount();

    const channel = supabase
      .channel('public:messages:unread')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          // A brief delay to allow the database to settle before refetching.
          setTimeout(fetchUnreadCount, 250);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUnreadCount]);

  return (
    <UnreadMessagesContext.Provider value={{ unreadCount, fetchUnreadCount }}>
      {children}
    </UnreadMessagesContext.Provider>
  );
};

export default UnreadMessagesProvider;