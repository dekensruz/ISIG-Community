
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Conversation } from '../types';
import Spinner from './Spinner';
import ChatWindow from './ChatWindow';
import Avatar from './Avatar';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MessageSquarePlus, CheckCheck, Users, Search } from 'lucide-react';

const isUserOnline = (lastSeenAt?: string | null): boolean => {
    if (!lastSeenAt) return false;
    return differenceInMinutes(new Date(), new Date(lastSeenAt)) < 3;
};

const ConversationListItem: React.FC<{ conversation: Conversation, isActive: boolean }> = ({ conversation, isActive }) => {
    const { session } = useAuth();
    const { other_participant, last_message, unread_count } = conversation;
    
    // Sécurité si participant non chargé
    if (!other_participant) return null;

    const isLastMessageFromMe = session?.user && last_message?.sender_id === session.user.id;
    const online = isUserOnline(other_participant.last_seen_at);
    
    return (
        <Link to={`/chat/${conversation.id}`} className={`flex items-start p-4 rounded-[1.5rem] w-full text-left transition-all ${isActive ? 'bg-isig-blue/10 border-isig-blue/20' : 'hover:bg-slate-50 border-transparent'} border mb-2`}>
            <div className="relative mr-4 flex-shrink-0">
                <Avatar avatarUrl={other_participant.avatar_url} name={other_participant.full_name} size="lg" className="ring-2 ring-white shadow-sm" />
                {online && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                )}
            </div>
            <div className="flex-grow overflow-hidden">
                <div className="flex justify-between items-center">
                    <p className={`font-black tracking-tight truncate ${online ? 'text-isig-blue' : 'text-slate-800'}`}>{other_participant.full_name}</p>
                    {last_message && (
                        <time className="text-[10px] font-black uppercase text-slate-400 flex-shrink-0 ml-2">
                            {formatDistanceToNow(new Date(last_message.created_at), { locale: fr })}
                        </time>
                    )}
                </div>
                <div className="flex justify-between items-center mt-1">
                     <p className={`text-xs truncate font-medium ${unread_count > 0 ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                        {isLastMessageFromMe && <span className="mr-1">{last_message?.is_read ? <CheckCheck size={14} className="inline text-isig-orange" /> : <CheckCheck size={14} className="inline text-slate-300" />}</span>}
                        {last_message ? (last_message.content || 'Média') : 'Nouvelle conversation'}
                    </p>
                    {unread_count > 0 && (
                        <span className="bg-isig-orange text-white text-[10px] font-black rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 ml-2 shadow-sm">
                            {unread_count > 9 ? '9+' : unread_count}
                        </span>
                    )}
                </div>
            </div>
        </Link>
    );
};

const ChatPage: React.FC = () => {
    const { conversationId } = useParams<{ conversationId: string }>();
    const { session } = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const sortConversations = (list: Conversation[]) => {
        return [...list].sort((a, b) => {
            const timeA = a.last_message ? new Date(a.last_message.created_at).getTime() : new Date(a.created_at).getTime();
            const timeB = b.last_message ? new Date(b.last_message.created_at).getTime() : new Date(b.created_at).getTime();
            return timeB - timeA;
        });
    };

    const fetchConversations = useCallback(async (isInitial = false) => {
        if (!session?.user) return;
        if (isInitial) setLoading(true);
        try {
            const { data, error } = await supabase.rpc('get_user_conversations_with_unread_count');
            if (!error && data) {
                const formatted: Conversation[] = data.map((c: any) => ({
                    id: c.conversation_id,
                    created_at: c.created_at,
                    other_participant: {
                        id: c.participant_id,
                        full_name: c.participant_full_name || 'Étudiant',
                        avatar_url: c.participant_avatar_url,
                        last_seen_at: c.participant_last_seen_at
                    },
                    last_message: c.last_message_id ? {
                        id: c.last_message_id,
                        content: c.last_message_content,
                        created_at: c.last_message_created_at,
                        sender_id: c.last_message_sender_id,
                        is_read: c.last_message_is_read,
                    } : null,
                    unread_count: c.unread_count || 0,
                }));
                setConversations(sortConversations(formatted));
            }
        } catch (err) {
            console.error("Erreur RPC conversations:", err);
        } finally {
            setLoading(false);
        }
    }, [session?.user]);

    useEffect(() => {
        fetchConversations(true);
        const channel = supabase.channel('chat_list_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
                fetchConversations(false);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_participants' }, () => {
                fetchConversations(false);
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchConversations]);

    const filteredConversations = conversations.filter(c => 
        c.other_participant?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex h-full bg-white md:rounded-[2.5rem] md:shadow-premium md:border md:border-slate-100 overflow-hidden">
            <aside className={`${conversationId ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 border-r border-slate-100 flex-col`}>
                <div className="p-6 border-b border-slate-50">
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight italic uppercase">Messages</h2>
                    <div className="mt-4 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Rechercher..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold focus:ring-2 focus:ring-isig-blue outline-none transition-all"
                        />
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center items-center h-full"><Spinner /></div>
                    ) : filteredConversations.length > 0 ? (
                        <div className="space-y-1">
                            {filteredConversations.map(conv => (
                                <ConversationListItem key={conv.id} conversation={conv} isActive={conv.id === conversationId} />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center p-8 text-slate-400 h-full flex flex-col justify-center items-center">
                             <MessageSquarePlus size={48} className="opacity-20 mb-4" />
                            <p className="font-black text-xs uppercase tracking-widest">{searchQuery ? 'Aucun résultat' : 'Pas de discussion'}</p>
                             <Link to="/users" className="mt-6 bg-isig-blue text-white font-black py-3 px-6 rounded-2xl flex items-center space-x-2 hover:bg-blue-600 transition-all shadow-lg text-[10px] uppercase tracking-widest">
                                <Users size={18} />
                                <span>Découvrir</span>
                            </Link>
                        </div>
                    )}
                </div>
            </aside>
            <main className={`${conversationId ? 'flex' : 'hidden md:flex'} w-full md:w-2/3 flex-col h-full`}>
                {conversationId ? (
                    <ChatWindow 
                        key={conversationId} 
                        conversationId={conversationId} 
                        onMessagesRead={() => fetchConversations(false)} 
                    />
                ) : (
                    <div className="flex-grow flex flex-col items-center justify-center text-center p-12 bg-slate-50/30">
                        <div className="w-24 h-24 bg-white rounded-[2rem] shadow-premium flex items-center justify-center mb-6">
                            <MessageSquarePlus size={40} className="text-isig-blue animate-pulse" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase italic">Discussions</h3>
                        <p className="text-sm text-slate-500 font-medium max-w-xs mt-2">Sélectionnez un étudiant pour commencer à échanger.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ChatPage;
