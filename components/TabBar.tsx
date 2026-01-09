
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Users, Users2, MessageSquare, Wand2 } from 'lucide-react';
import { useAuth } from '../App';
import SuggestionModal from './SuggestionModal';
import { supabase } from '../services/supabase';
import { Profile } from '../types';
import { useUnreadMessages } from './UnreadMessagesProvider';

const TabBar: React.FC = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const { unreadCount: unreadMessagesCount } = useUnreadMessages();
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
    };

    const navLinkClasses = "relative flex flex-col items-center justify-center text-slate-400 hover:text-isig-blue transition-all duration-200 active:scale-90 group";
    const activeNavLinkClasses = "text-isig-blue";

    return (
        <>
            <div className="fixed bottom-0 left-0 right-0 h-20 bg-white/90 backdrop-blur-xl border-t border-slate-200 shadow-[0_-4px_15px_-3px_rgba(0,0,0,0.05)] z-40 transition-all">
                <div className="container mx-auto h-full grid grid-cols-5 max-w-lg">
                    <NavLink to="/" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : ''}`}>
                        <div className="p-1 rounded-xl transition-colors">
                            <Home size={24} className="group-[.active]:fill-isig-blue/10" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest mt-1">Acceuil</span>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-isig-blue group-[.active]:w-8 transition-all duration-300 rounded-b-full"></div>
                    </NavLink>
                    <NavLink to={session ? "/groups" : "/auth"} className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : ''}`}>
                        <div className="p-1 rounded-xl transition-colors">
                            <Users size={24} className="group-[.active]:fill-isig-blue/10" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest mt-1">Groupes</span>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-isig-blue group-[.active]:w-8 transition-all duration-300 rounded-b-full"></div>
                    </NavLink>
                    <NavLink to={session ? "/users" : "/auth"} className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : ''}`}>
                        <div className="p-1 rounded-xl transition-colors">
                            <Users2 size={24} className="group-[.active]:fill-isig-blue/10" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest mt-1">Membres</span>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-isig-blue group-[.active]:w-8 transition-all duration-300 rounded-b-full"></div>
                    </NavLink>
                    <NavLink to={session ? "/chat" : "/auth"} className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : ''}`}>
                        <div className="p-1 rounded-xl transition-colors">
                            <MessageSquare size={24} className="group-[.active]:fill-isig-blue/10" />
                        </div>
                        {unreadMessagesCount > 0 && (
                             <span className="absolute top-2 right-1/2 translate-x-4 block h-4 w-4 rounded-full bg-isig-orange text-white text-[9px] flex items-center justify-center ring-2 ring-white font-black animate-pulse">
                                {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                            </span>
                        )}
                        <span className="text-[10px] font-black uppercase tracking-widest mt-1">Chat</span>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0 h-0.5 bg-isig-blue group-[.active]:w-8 transition-all duration-300 rounded-b-full"></div>
                    </NavLink>
                    <button onClick={openSuggestionModal} className={navLinkClasses}>
                        <div className="p-1 rounded-xl transition-colors">
                            <Wand2 size={24} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest mt-1">IA</span>
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
