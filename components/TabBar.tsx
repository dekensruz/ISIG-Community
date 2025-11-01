import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Users, MessageSquare, Users2, Wand2 } from 'lucide-react';
import { useAuth } from '../App';
import SuggestionModal from './SuggestionModal';
import { supabase } from '../services/supabase';
import { Profile } from '../types';
import { useUnreadMessages } from './UnreadMessagesProvider'; // Nouveau

const TabBar: React.FC = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const { unreadCount } = useUnreadMessages(); // Nouveau
    const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
    const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);

    const openSuggestionModal = async () => {
        if (!session?.user) {
            navigate('/auth');
            return;
        }
        if (!currentUserProfile) {
            const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
            if (data) setCurrentUserProfile(data);
        }
        setSuggestionModalOpen(true);
    }

    const navLinkClasses = "relative flex flex-col items-center justify-center text-slate-500 hover:text-isig-blue transition-colors";
    const activeNavLinkClasses = "text-isig-blue";

    return (
        <>
            <div className="fixed bottom-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-lg border-t border-slate-200 shadow-t-md z-10">
                <div className="container mx-auto h-full grid grid-cols-5">
                    <NavLink to="/" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : ''}`}>
                        <Home size={24} />
                        <span className="text-xs mt-1">Accueil</span>
                    </NavLink>
                    <NavLink to={session ? "/groups" : "/auth"} className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : ''}`}>
                        <Users2 size={24} />
                        <span className="text-xs mt-1">Groupes</span>
                    </NavLink>
                    <NavLink to={session ? "/users" : "/auth"} className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : ''}`}>
                        <Users size={24} />
                        <span className="text-xs mt-1">Membres</span>
                    </NavLink>
                    <NavLink to={session ? "/chat" : "/auth"} className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : ''}`}>
                        <MessageSquare size={24} />
                        {unreadCount > 0 && (
                             <span className="absolute top-3 right-1/2 translate-x-4 block h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center ring-2 ring-white">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                        <span className="text-xs mt-1">Messages</span>
                    </NavLink>
                    <button onClick={openSuggestionModal} className={navLinkClasses}>
                        <Wand2 size={24} />
                        <span className="text-xs mt-1">IA</span>
                    </button>
                </div>
            </div>
             {suggestionModalOpen && currentUserProfile && (
                <SuggestionModal 
                currentUser={currentUserProfile} 
                onClose={() => setSuggestionModalOpen(false)} 
                />
            )}
        </>
    );
};

export default TabBar;