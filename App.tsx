
import React, { useState, useEffect, createContext, useContext, lazy, Suspense } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabase';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Spinner from './components/Spinner';

// Lazy loading des pages
const AuthPage = lazy(() => import('./components/Auth'));
const Feed = lazy(() => import('./components/Feed'));
const Profile = lazy(() => import('./components/Profile'));
const SettingsPage = lazy(() => import('./components/SettingsPage'));
const PostPage = lazy(() => import('./components/PostPage'));
const GroupsPage = lazy(() => import('./components/GroupsPage'));
const GroupPage = lazy(() => import('./components/GroupPage'));
const ChatPage = lazy(() => import('./components/ChatPage'));
const UsersPage = lazy(() => import('./components/UsersPage'));
const SearchResultsPage = lazy(() => import('./components/SearchResultsPage'));
const NotificationsPage = lazy(() => import('./components/NotificationsPage'));
const AdminFeedbacksPage = lazy(() => import('./components/AdminFeedbacksPage'));
const FeedbackPage = lazy(() => import('./components/FeedbackPage'));

import Navbar from './components/Navbar';
import TabBar from './components/TabBar';
import ScrollToTopButton from './components/ScrollToTopButton';
import UnreadMessagesProvider from './components/UnreadMessagesProvider';
import NotificationsProvider from './components/NotificationsProvider';
import InstallPWABanner from './components/InstallPWABanner';
import CompleteProfilePopup from './components/CompleteProfilePopup';
import DarkModeDiscoveryPopup from './components/DarkModeDiscoveryPopup';

type AuthContextType = {
  session: Session | null;
  loading: boolean;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
};

const AuthContext = createContext<AuthContextType>({ 
    session: null, 
    loading: true, 
    theme: 'light', 
    toggleTheme: () => {} 
});

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

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
    <div className="w-10 h-10 border-4 border-isig-blue/10 border-t-isig-blue rounded-full animate-spin"></div>
  </div>
);

const AppContent: React.FC = () => {
    const { session, theme } = useAuth();
    const location = useLocation();
    
    const isAuthPage = location.pathname === '/auth';
    const isChatConversation = location.pathname.startsWith('/chat/') && location.pathname.split('/').length > 2;
    
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
        <div className={`min-h-screen transition-colors duration-300 selection:bg-isig-blue selection:text-white ${
            theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'
        }`}>
            {showNavBars && <Navbar />}
            <main className={`transition-all duration-500 ease-in-out ${
                isAuthPage ? "" 
                : isChatConversation ? "h-screen pt-0 pb-0 overflow-hidden flex flex-col" 
                : "container mx-auto px-4 pt-24 pb-28 sm:pb-32" 
            }`}>
                <Suspense fallback={<PageLoader />}>
                    <div 
                        key={location.pathname} 
                        className={`page-transition ${isChatConversation ? 'flex-1 min-h-0 h-full' : ''}`}
                    >
                        <Routes location={location}>
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
                    </div>
                </Suspense>
            </main>
            {showNavBars && <TabBar />}
            {session && showScrollButton && <ScrollToTopButton />}
            <InstallPWABanner onComplete={() => {}} />
            {session && !isAuthPage && <NotificationsProvider />}
            {session && !isAuthPage && <CompleteProfilePopup />}
            {session && !isAuthPage && <DarkModeDiscoveryPopup />}
        </div>
    );
};

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Initialiser le thème
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark';
    if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
          // Charger le thème depuis le profil
          supabase.from('profiles').select('theme').eq('id', session.user.id).single()
            .then(({ data }) => {
                if (data?.theme) {
                    setTheme(data.theme);
                    document.documentElement.classList.toggle('dark', data.theme === 'dark');
                }
            });
      }
      setLoading(false);
    }).catch(err => {
      console.error("Auth Session Error:", err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
    
    if (session?.user) {
        await supabase.from('profiles').update({ theme: newTheme }).eq('id', session.user.id);
    }
  };

  if (loading) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-white dark:bg-slate-950 p-6">
            <div className="relative mb-8">
                <img 
                    src="https://i.ibb.co/gLJQF0rn/isig.jpg" 
                    alt="ISIG Logo" 
                    className="w-32 h-32 rounded-[2.5rem] shadow-premium animate-pulse" 
                />
            </div>
            <Spinner />
            <p className="mt-6 text-slate-400 font-black text-xs uppercase tracking-widest animate-pulse">Chargement de l'espace ISIG...</p>
        </div>
    );
  }

  return (
    <AuthContext.Provider value={{ session, loading, theme, toggleTheme }}>
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
