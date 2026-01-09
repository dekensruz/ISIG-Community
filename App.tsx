
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

// Composants de structure
import Navbar from './components/Navbar';
import TabBar from './components/TabBar';
import ScrollToTopButton from './components/ScrollToTopButton';
import UnreadMessagesProvider from './components/UnreadMessagesProvider';
import NotificationsProvider from './components/NotificationsProvider';
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
};

export const SearchFilterContext = createContext<SearchFilterContextType | undefined>(undefined);

export const useSearchFilter = () => {
    const context = useContext(SearchFilterContext);
    if (!context) throw new Error('useSearchFilter must be used within a SearchFilterProvider');
    return context;
};

const SearchFilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [searchQuery, setSearchQuery] = useState('');
    return (
        <SearchFilterContext.Provider value={{ searchQuery, setSearchQuery }}>
            {children}
        </SearchFilterContext.Provider>
    );
};

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <Spinner />
  </div>
);

const AppContent: React.FC = () => {
    const { session } = useAuth();
    const location = useLocation();
    const [canShowNotifications, setCanShowNotifications] = useState(false);
    
    const isAuthPage = location.pathname === '/auth';
    const isChatConversation = location.pathname.startsWith('/chat/') && location.pathname.split('/').length > 2;
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
        <div className="min-h-screen bg-slate-50 selection:bg-isig-blue selection:text-white flex flex-col">
            {showNavBars && <Navbar />}
            
            <main className={`flex-grow transition-opacity duration-300 ${
                isAuthPage ? "" 
                : isChatConversation ? "h-screen overflow-hidden" 
                : "container mx-auto px-4 pt-20 pb-28 sm:pt-24" 
            }`}>
                <Suspense fallback={<PageLoader />}>
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
                </Suspense>
            </main>

            {showNavBars && <TabBar />}
            {session && !isAuthPage && !isChatConversation && <ScrollToTopButton />}
            <InstallPWABanner onComplete={() => setCanShowNotifications(true)} />
            {session && !isAuthPage && canShowNotifications && <NotificationsProvider />}
        </div>
    );
};

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    }).catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><Spinner /></div>;

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
