import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Conversation } from '../types';
import Spinner from './Spinner';
import ChatWindow from './ChatWindow';
import Avatar from './Avatar';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MessageSquarePlus, Check, CheckCheck, Users } from 'lucide-react';

const ConversationListItem: React.FC<{ conversation: Conversation, isActive: boolean }> = ({ conversation, isActive }) => {
    const { session } = useAuth();
    const { other_participant, last_message, unread_count } = conversation;
    const isLastMessageFromMe = session?.user && last_message?.sender_id === session.user.id;
    
    return (
        <Link to={`/chat/${conversation.id}`} className={`flex items-start p-3 rounded-lg w-full text-left transition-colors ${isActive ? 'bg-isig-blue/10' : 'hover:bg-slate-100'}`}>
            <Avatar avatarUrl={other_participant.avatar_url} name={other_participant.full_name} size="lg" className="mr-3 flex-shrink-0" />
            <div className="flex-grow overflow-hidden">
                <div className="flex justify-between items-center">
                    <p className="font-bold text-slate-800 truncate">{other_participant.full_name}</p>
                    {last_message && (
                        <time className="text-xs text-slate-400 flex-shrink-0 ml-2 flex items-center">
                             {isLastMessageFromMe && (
                                <span className="mr-1">
                                    {last_message.is_read ? (
                                        <CheckCheck size={16} className="text-isig-orange" />
                                    ) : (
                                        <CheckCheck size={16} className="text-slate-400" />
                                    )}
                                </span>
                            )}
                            {formatDistanceToNow(new Date(last_message.created_at), { locale: fr })}
                        </time>
                    )}
                </div>
                <div className="flex justify-between items-center mt-1">
                     <p className={`text-sm truncate ${unread_count > 0 ? 'text-slate-800 font-semibold' : 'text-slate-500'}`}>
                        {last_message ? last_message.content : 'Aucun message'}
                    </p>
                    {unread_count > 0 && (
                        <span className="bg-isig-orange text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0 ml-2">
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
    const [error, setError] = useState<string | null>(null);

    const fetchConversations = useCallback(async () => {
        if (!session?.user) return;
        // Don't set loading to true on refetch to avoid flicker
        // setLoading(true); 
        setError(null);

        const { data: convData, error: rpcError } = await supabase.rpc('get_user_conversations_with_unread_count');
        
        if (rpcError) {
            console.error('Error fetching conversations:', JSON.stringify(rpcError, null, 2));
            setError(`Échec du chargement des conversations. Détails : ${rpcError.message}`);
            setLoading(false);
            return;
        }
        
        const formattedConversations: Conversation[] = convData.map((c: any) => ({
            id: c.conversation_id,
            created_at: c.created_at,
            other_participant: {
                id: c.participant_id,
                full_name: c.participant_full_name,
                avatar_url: c.participant_avatar_url,
            },
            last_message: c.last_message_id ? {
                id: c.last_message_id,
                content: c.last_message_content,
                created_at: c.last_message_created_at,
                sender_id: c.last_message_sender_id,
                is_read: c.last_message_is_read,
            } : null,
            unread_count: c.unread_count,
        }));
        
        setConversations(formattedConversations);
        setLoading(false);
    }, [session?.user]);
    
    useEffect(() => {
        fetchConversations();

        const channel = supabase
            .channel('chat-updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, 
            () => {
                fetchConversations();
            })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${session?.user.id}` }, 
            () => {
                fetchConversations();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchConversations, session?.user.id]);


    return (
        <div className="flex h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <aside className={`${conversationId ? 'hidden md:flex' : 'flex'} w-full md:w-1/3 border-r border-slate-200 flex-col`}>
                <div className="p-4 border-b border-slate-200">
                    <h2 className="text-xl font-bold text-slate-800">Messages</h2>
                </div>
                <div className="flex-grow overflow-y-auto p-2">
                    {loading ? (
                        <div className="flex justify-center items-center h-full"><Spinner /></div>
                    ) : error ? (
                        <div className="text-center p-6 text-red-600">
                            <p className="font-semibold">Une erreur est survenue</p>
                            <p className="text-sm mt-1">{error}</p>
                        </div>
                    ) : conversations.length > 0 ? (
                        <ul className="space-y-1">
                            {conversations.map(conv => (
                                <li key={conv.id}>
                                    <ConversationListItem conversation={conv} isActive={conv.id === conversationId} />
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center p-6 text-slate-500 h-full flex flex-col justify-center items-center">
                             <MessageSquarePlus size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="font-semibold text-slate-600">Aucune conversation.</p>
                            <p className="text-sm">Il est temps de se connecter !</p>
                             <Link to="/users" className="mt-4 bg-isig-blue text-white font-semibold py-2 px-4 rounded-lg flex items-center space-x-2 hover:bg-blue-600 transition-colors">
                                <Users size={18} />
                                <span>Voir la communauté</span>
                            </Link>
                        </div>
                    )}
                </div>
            </aside>
            <main className={`${conversationId ? 'flex' : 'hidden md:flex'} w-full md:w-2/3 flex-col`}>
                {conversationId ? (
                    <ChatWindow key={conversationId} conversationId={conversationId} onMessagesRead={fetchConversations} />
                ) : (
                    <div className="flex-grow flex-col items-center justify-center text-center text-slate-500 p-8 hidden md:flex">
                        <MessageSquarePlus size={64} className="text-slate-300 mb-4" />
                        <h3 className="text-xl font-semibold">Sélectionnez une conversation</h3>
                        <p>Choisissez une conversation dans la liste de gauche pour afficher les messages.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ChatPage;
