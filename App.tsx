
import React, { useState, useEffect, createContext, useContext } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabase';
import AuthPage from './components/Auth';
import Feed from './components/Feed';
import Navbar from './components/Navbar';
import Profile from './components/Profile';
import SettingsPage from './components/SettingsPage';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Spinner from './components/Spinner';
import PostPage from './components/PostPage';
import GroupsPage from './components/GroupsPage';
import GroupPage from './components/GroupPage';
import UnreadMessagesProvider from './components/UnreadMessagesProvider';
import ChatPage from './components/ChatPage';
import UsersPage from './components/UsersPage';
import TabBar from './components/TabBar';
import ScrollToTopButton from './components/ScrollToTopButton';
import SearchResultsPage from './components/SearchResultsPage';
import NotificationsPage from './components/NotificationsPage';
import NotificationsProvider from './components/NotificationsProvider';
import AdminFeedbacksPage from './components/AdminFeedbacksPage';
import FeedbackPage from './components/FeedbackPage';
import InstallPWABanner from './components/InstallPWABanner';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextType>({ session: null, loading: true });
export const useAuth = () => useContext(AuthContext);

type SearchFilterContextType = {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filterType: string;
  setFilterType: React.Dispatch<React.SetStateAction<string>>;
  sortOrder: string;
  setSortOrder: React.Dispatch<React.SetStateAction<string>>;
  isSearchActive: boolean;
  setIsSearchActive: React.Dispatch<React.SetStateAction<boolean>>;
};

export const SearchFilterContext = createContext<SearchFilterContextType | undefined>(undefined);

export const useSearchFilter = () => {
    const context = useContext(SearchFilterContext);
    if (!context) throw new Error('useSearchFilter must be used within a SearchFilterProvider');
    return context;
};

const SearchFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [sortOrder, setSortOrder] = useState('desc');
    const [isSearchActive, setIsSearchActive] = useState(false);

    return (
        <SearchFilterContext.Provider value={{ searchQuery, setSearchQuery, filterType, setFilterType, sortOrder, setSortOrder, isSearchActive, setIsSearchActive }}>
            {children}
        </SearchFilterContext.Provider>
    );
};

const AppContent: React.FC = () => {
    const { session } = useAuth();
    const location = useLocation();
    const [canShowNotifications, setCanShowNotifications] = useState(false);
    
    const isAuthPage = location.pathname === '/auth';
    const isChatConversation = location.pathname.startsWith('/chat/') && location.pathname.split('/').length > 2;
    const isChatListPage = location.pathname === '/chat';
    
    const showScrollButton = !isAuthPage && (location.pathname === '/' || location.pathname.startsWith('/group/'));
    const showNavBars = !isAuthPage && !isChatConversation;

    useEffect(() => {
        if (!session?.user) return;
        const updatePresence = async () => {
            await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', session.user.id);
        };
        updatePresence();
        const interval = setInterval(updatePresence, 120000);
        return () => clearInterval(interval);
    }, [session]);

    return (
        <div className="min-h-screen bg-slate-100">
            {showNavBars && <Navbar />}
            <main className={
                isAuthPage ? "" 
                : isChatConversation ? "h-screen pt-0 pb-0" 
                : isChatListPage ? "h-screen pt-[60px] pb-[80px]" 
                : "container mx-auto px-4 pt-24 pb-24" 
            }>
                <Routes>
                    <Route path="/" element={<Feed />} />
                    <Route path="/profile/:userId" element={<Profile />} />
                    <Route path="/post/:postId" element={<PostPage />} />
                    <Route path="/groups" element={session ? <GroupsPage /> : <Navigate to="/auth" />} />
                    <Route path="/group/:groupId" element={session ? <GroupPage /> : <Navigate to="/auth" />} />
                    <Route path="/chat" element={session ? <ChatPage /> : <Navigate to="/auth" />} />
                    <Route path="/chat/:conversationId" element={session ? <ChatPage /> : <Navigate to="/auth" />} />
                    <Route path="/users" element={session ? <UsersPage /> : <Navigate to="/auth" />} />
                    <Route path="/settings" element={session ? <SettingsPage /> : <Navigate to="/auth" />} />
                    <Route path="/feedback" element={session ? <FeedbackPage /> : <Navigate to="/auth" />} />
                    <Route path="/admin/feedbacks" element={session ? <AdminFeedbacksPage /> : <Navigate to="/auth" />} />
                    <Route path="/auth" element={!session ? <AuthPage /> : <Navigate to="/" />} />
                    <Route path="/search" element={session ? <SearchResultsPage /> : <Navigate to="/auth" />} />
                    <Route path="/notifications" element={session ? <NotificationsPage /> : <Navigate to="/auth" />} />
                    <Route path="*" element={<Navigate to="/" />} />
                </Routes>
            </main>
            {showNavBars && <TabBar />}
            {session && showScrollButton && <ScrollToTopButton />}
            <InstallPWABanner onComplete={() => setCanShowNotifications(true)} />
            {session && !isAuthPage && canShowNotifications && <NotificationsProvider />}
        </div>
    );
};

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Timeout de sécurité : si Supabase ne répond pas en 6s, on arrête le loading
    // pour permettre au moins l'affichage de l'écran de login ou d'une erreur
    const timer = setTimeout(() => {
      if (loading) setLoading(false);
    }, 6000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      clearTimeout(timer);
    }).catch(err => {
      console.error("Auth Session Error:", err);
      setLoading(false);
      clearTimeout(timer);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-slate-100">
            <div className="flex flex-col items-center">
                <Spinner />
                <p className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-widest animate-pulse">Initialisation sécurisée...</p>
            </div>
        </div>
    );
  }

  return (
    <AuthContext.Provider value={{ session, loading }}>
        <BrowserRouter>
            <SearchFilterProvider>
                <UnreadMessagesProvider>
                    <AppContent />
                </UnreadMessagesProvider>
            </SearchFilterProvider>
        </BrowserRouter>
    </AuthContext.Provider>
  );
};

export default App;
