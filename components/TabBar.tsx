
import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Users, MessageSquare, Wand2, PlusSquare } from 'lucide-react';
import { useAuth } from '../App';
import SuggestionModal from './SuggestionModal';
import CreatePostModal from './CreatePostModal';
import { supabase } from '../services/supabase';
import { Profile } from '../types';
import { useUnreadMessages } from './UnreadMessagesProvider';

const TabBar: React.FC = () => {
    const { session } = useAuth();
    const navigate = useNavigate();
    const { unreadCount: unreadMessagesCount } = useUnreadMessages();
    
    const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
    const [createModalOpen, setCreateModalOpen] = useState(false);
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

    const openCreateModal = () => {
        if (!session?.user) {
            navigate('/auth');
            return;
        }
        setCreateModalOpen(true);
    };

    const navLinkClasses = "relative flex flex-col items-center justify-center text-slate-400 hover:text-isig-blue transition-all duration-200 active:scale-90 group py-1";
    const activeNavLinkClasses = "text-isig-blue";
    const iconSize = 20; // Réduction de la taille des icônes

    return (
        <>
            <div className="fixed bottom-0 left-0 right-0 h-[72px] bg-white/95 backdrop-blur-xl border-t border-slate-200/60 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)] z-40 transition-all pb-safe">
                <div className="container mx-auto h-full grid grid-cols-5 max-w-lg items-center px-1">
                    
                    {/* 1. Accueil */}
                    <NavLink to="/" className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : ''}`}>
                        <div className={`p-1.5 rounded-xl transition-colors ${location.pathname === '/' ? 'bg-isig-blue/5' : ''}`}>
                            <Home size={iconSize} className="group-[.active]:fill-isig-blue/20" strokeWidth={2.5} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest mt-0.5">Accueil</span>
                    </NavLink>

                    {/* 2. Groupes */}
                    <NavLink to={session ? "/groups" : "/auth"} className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : ''}`}>
                        <div className={`p-1.5 rounded-xl transition-colors ${location.pathname.startsWith('/group') ? 'bg-isig-blue/5' : ''}`}>
                            <Users size={iconSize} className="group-[.active]:fill-isig-blue/20" strokeWidth={2.5} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest mt-0.5">Groupes</span>
                    </NavLink>

                    {/* 3. Chat (Au milieu comme demandé) */}
                    <NavLink to={session ? "/chat" : "/auth"} className={({ isActive }) => `${navLinkClasses} ${isActive ? activeNavLinkClasses : ''} -mt-6`}>
                        <div className="p-3 bg-isig-blue rounded-full text-white shadow-lg shadow-isig-blue/30 ring-4 ring-white transition-transform group-active:scale-95">
                            <MessageSquare size={22} fill="white" strokeWidth={2.5} />
                            {unreadMessagesCount > 0 && (
                                <span className="absolute top-0 right-0 block h-4 w-4 rounded-full bg-isig-orange text-white text-[9px] flex items-center justify-center ring-2 ring-white font-black animate-pulse">
                                    {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                                </span>
                            )}
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest mt-1 text-slate-500 group-[.active]:text-isig-blue">Chat</span>
                    </NavLink>

                    {/* 4. Créer (Nouveau bouton) */}
                    <button onClick={openCreateModal} className={navLinkClasses}>
                        <div className="p-1.5 rounded-xl transition-colors hover:bg-slate-50">
                            <PlusSquare size={iconSize} strokeWidth={2.5} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest mt-0.5">Créer</span>
                    </button>

                    {/* 5. IA */}
                    <button onClick={openSuggestionModal} className={navLinkClasses}>
                        <div className="p-1.5 rounded-xl transition-colors hover:bg-slate-50">
                            <Wand2 size={iconSize} strokeWidth={2.5} />
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-widest mt-0.5">IA</span>
                    </button>

                </div>
            </div>

            {/* Modals */}
             {suggestionModalOpen && currentUserProfile && (
                <SuggestionModal 
                    currentUser={currentUserProfile} 
                    onClose={() => setSuggestionModalOpen(false)} 
                />
            )}
            
            {createModalOpen && (
                <CreatePostModal onClose={() => setCreateModalOpen(false)} />
            )}
        </>
    );
};

export default TabBar;
