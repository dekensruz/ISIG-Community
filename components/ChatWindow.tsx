
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Message, Profile } from '../types';
import Spinner from './Spinner';
import Avatar from './Avatar';
import { Send, ArrowLeft, Paperclip, X, Info, Mic, Trash2, StopCircle, Search, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUnreadMessages } from './UnreadMessagesProvider';
import MessageBubble from './MessageBubble';
import MediaViewerModal from './MediaViewerModal';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';

const formatPresence = (lastSeenAt?: string | null): string => {    
    if (!lastSeenAt) return '';
    const lastSeenDate = new Date(lastSeenAt);
    const now = new Date();
    const diffMins = differenceInMinutes(now, lastSeenDate);

    if (diffMins < 5) return 'En ligne';
    return `Vu ${formatDistanceToNow(lastSeenDate, { locale: fr, addSuffix: true })}`;
};

const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

interface ChatWindowProps {
  conversationId: string;
  onMessagesRead: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ conversationId, onMessagesRead }) => {
  const { session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherParticipant, setOtherParticipant] = useState<Profile | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [mediaInView, setMediaInView] = useState<{ url: string; type: string; name: string } | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording'>('idle');
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [presenceStatus, setPresenceStatus] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { fetchUnreadCount } = useUnreadMessages();

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    }, 50);
  };
  
  const handleSetFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const selectedFile = e.target.files[0];
        setFile(selectedFile);
        if (selectedFile.type.startsWith("image/")) {
            setFilePreview(URL.createObjectURL(selectedFile));
        } else {
            setFilePreview(selectedFile.name);
        }
    }
  };

  const removeFile = () => {
      setFile(null);
      if (filePreview && filePreview.startsWith("blob:")) URL.revokeObjectURL(filePreview);
      setFilePreview(null);
      if(fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const cancelEdit = () => {
    setEditingMessage(null);
    setNewMessage('');
  };

  const markMessagesAsRead = useCallback(async () => {
    if (!session?.user || !conversationId) return;
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', session.user.id)
      .is('is_read', false);
    if (!error) {
        fetchUnreadCount();
        onMessagesRead();
    }
  }, [session?.user?.id, conversationId, fetchUnreadCount, onMessagesRead]);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!session?.user || !conversationId) return;
    if (!isSilent) setLoading(true);
    
    try {
      const { data: participantData, error: pError } = await supabase
        .from('conversation_participants')
        .select('profiles:user_id(*)')
        .eq('conversation_id', conversationId)
        .neq('user_id', session.user.id)
        .maybeSingle();

      if (participantData?.profiles) {
          const p = participantData.profiles as unknown as Profile;
          setOtherParticipant(p);
          setPresenceStatus(formatPresence(p.last_seen_at));
      }

      const { data: myProfile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (myProfile) setCurrentUserProfile(myProfile);

      const { data: messagesData, error: mError } = await supabase
        .from('messages')
        .select('*, profiles:sender_id(*), replied_to:replying_to_message_id(*, profiles:sender_id(*))')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      if (mError) throw mError;
      
      setMessages(messagesData as any[] || []);
      
      if (messagesData?.some(m => !m.is_read && m.sender_id !== session.user.id)) {
          markMessagesAsRead();
      }
    } catch (err: any) {
      console.error('Error fetching chat data:', err);
      if (!isSilent) setError("Échec du chargement des messages.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [conversationId, session?.user?.id, markMessagesAsRead]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId || !session?.user) return;

    const channel = supabase.channel(`chat_room_${conversationId}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'messages', 
          filter: `conversation_id=eq.${conversationId}`
      }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const incoming = payload.new as Message;
            
            setMessages(current => {
                // Éviter les doublons
                if (current.some(m => m.id === incoming.id)) return current;

                // Chercher si c'est une confirmation d'un message optimiste que NOUS avons envoyé
                const optimisticIdx = current.findIndex(m => 
                    m.id.startsWith('temp-') && 
                    m.sender_id === incoming.sender_id &&
                    (m.content === incoming.content || (m.media_url && incoming.media_url))
                );

                const profile = incoming.sender_id === session.user.id ? currentUserProfile : otherParticipant;
                const enriched = { ...incoming, profiles: profile };

                if (optimisticIdx !== -1) {
                    const updated = [...current];
                    updated[optimisticIdx] = enriched;
                    return updated;
                }
                
                // Si c'est un message d'autrui ou un nouveau message sans version optimiste trouvée
                return [...current, enriched];
            });

            if (incoming.sender_id !== session.user.id) {
                markMessagesAsRead();
            }
            scrollToBottom();
          } 
          else if (payload.eventType === 'UPDATE') {
            setMessages(current => current.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
          } 
          else if (payload.eventType === 'DELETE') {
            setMessages(current => current.filter(m => m.id !== payload.old.id));
          }
      })
      .subscribe((status) => {
          setRealtimeStatus(status === 'SUBSCRIBED' ? 'connected' : status === 'CHANNEL_ERROR' ? 'error' : 'connecting');
          // En cas de reconnexion, on rafraîchit les données pour être sûr de n'avoir rien raté
          if (status === 'SUBSCRIBED') fetchData(true);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, session?.user.id, otherParticipant, currentUserProfile, markMessagesAsRead, fetchData]);

  useEffect(() => { 
    if (!loading) scrollToBottom(messages.length > 50 ? "auto" : "smooth"); 
  }, [messages.length, loading]);

  const handleSendMessage = async (e?: React.FormEvent, audioBlob?: Blob) => {
    e?.preventDefault();
    if ((!newMessage.trim() && !file && !audioBlob) || !session?.user || !currentUserProfile) return;
    
    if (editingMessage) {
        await supabase.from('messages').update({ content: newMessage, updated_at: new Date().toISOString() }).eq('id', editingMessage.id);
        cancelEdit();
        return;
    }
    
    const content = newMessage;
    const mediaFile = file || (audioBlob ? new File([audioBlob], "voix.webm", { type: "audio/webm" }) : null);

    // Identifiant temporaire unique
    const optimisticId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMsg: Message = {
        id: optimisticId,
        conversation_id: conversationId,
        sender_id: session.user.id,
        content: content,
        created_at: new Date().toISOString(),
        profiles: currentUserProfile,
        replying_to_message_id: replyingToMessage?.id,
        replied_to: replyingToMessage ? { ...replyingToMessage } : undefined,
        is_read: false
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');
    removeFile();
    setReplyingToMessage(null);
    scrollToBottom();

    setIsUploading(true);
    try {
        let mediaUrl, mediaType;
        if (mediaFile) {
            const fileName = `${conversationId}/${session.user.id}-${Date.now()}`;
            const { data: uploadData, error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, mediaFile);
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage.from('chat_media').getPublicUrl(uploadData.path);
            mediaUrl = urlData.publicUrl;
            mediaType = mediaFile.type;
        }

        const { error } = await supabase.from('messages').insert({ 
            conversation_id: conversationId, 
            sender_id: session.user.id, 
            content: content, 
            media_url: mediaUrl, 
            media_type: mediaType, 
            replying_to_message_id: optimisticMsg.replying_to_message_id 
        });
        
        if (error) throw error;
    } catch (err: any) {
        // En cas d'erreur fatale, on retire le message optimiste pour éviter la confusion
        setMessages(prev => prev.filter(m => m.id !== optimisticId));
        alert("Échec de l'envoi. Veuillez vérifier votre connexion.");
    } finally {
        setIsUploading(false);
    }
  };

  const cleanupRecording = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setRecordingTime(0);
  }, []);

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
        mediaRecorderRef.current.onstop = async () => {
            const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            if (blob.size > 100) await handleSendMessage(undefined, blob);
            cleanupRecording();
            setRecordingStatus('idle');
        };
        mediaRecorderRef.current.start();
        setRecordingStatus('recording');
        timerIntervalRef.current = window.setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch (err) { alert("Microphone inaccessible."); }
  };

  if (loading) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-white">
            <Spinner />
            <p className="mt-4 text-slate-400 font-bold text-sm uppercase tracking-widest">Initialisation...</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white relative">
        <header className="flex items-center p-4 border-b border-slate-100 bg-white/95 backdrop-blur-md z-10">
            <Link to="/chat" className="md:hidden mr-4 p-2 rounded-2xl hover:bg-slate-50 transition-colors">
                <ArrowLeft size={20} />
            </Link>
            
            {!showSearch && otherParticipant && (
                <Link to={`/profile/${otherParticipant.id}`} className="flex items-center space-x-3 group min-w-0">
                    <Avatar avatarUrl={otherParticipant.avatar_url} name={otherParticipant.full_name} size="md" className="ring-2 ring-transparent group-hover:ring-isig-blue/20 transition-all" />
                    <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                            <h3 className="font-black text-slate-800 tracking-tight truncate group-hover:text-isig-blue transition-colors">{otherParticipant.full_name}</h3>
                            {realtimeStatus === 'connected' ? 
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Temps réel actif"></span> : 
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Connexion en cours..."></span>
                            }
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{presenceStatus}</p> 
                    </div>
                </Link>
            )}

            <div className={`flex items-center space-x-2 ${showSearch ? 'w-full' : 'ml-auto'}`}>
                {showSearch ? (
                    <div className="flex-grow flex items-center bg-slate-50 rounded-2xl px-4 py-1 border border-slate-100">
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher dans le chat..." className="w-full bg-transparent border-none py-2 text-sm focus:ring-0 outline-none font-bold" autoFocus />
                        <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
                    </div>
                ) : (
                    <>
                        <button onClick={() => setShowSearch(true)} className="p-3 rounded-2xl hover:bg-slate-50 text-slate-400 hover:text-isig-blue transition-all"><Search size={20} /></button>
                        <Link to={`/profile/${otherParticipant?.id}`} className="p-3 rounded-2xl hover:bg-slate-50 text-slate-400 hover:text-isig-blue transition-all"><Info size={20} /></Link>
                    </>
                )}
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30 min-h-0 custom-scrollbar">
            {messages.filter(m => !searchQuery || m.content.toLowerCase().includes(searchQuery.toLowerCase())).map((msg) => (
                <MessageBubble 
                  key={msg.id} 
                  message={msg} 
                  isOwnMessage={msg.sender_id === session?.user.id} 
                  onSetEditing={setEditingMessage} 
                  onSetReplying={setReplyingToMessage} 
                  setMessages={setMessages} 
                  onMediaClick={(url, type, name) => setMediaInView({ url, type, name })} 
                />
            ))}
            <div ref={messagesEndRef} className="h-2" />
        </div>

        <div className="p-4 border-t border-slate-100 bg-white shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.03)]">
            {(replyingToMessage || editingMessage || filePreview) && recordingStatus === 'idle' && (
                <div className="bg-slate-50 p-4 rounded-3xl mb-3 flex items-center justify-between border border-slate-100 animate-fade-in">
                    <div className="min-w-0 flex-1">
                        <p className={`text-[9px] font-black uppercase tracking-widest ${editingMessage ? 'text-isig-orange' : 'text-isig-blue'}`}>
                            {editingMessage ? 'Modification' : 'Réponse à ' + (replyingToMessage?.profiles?.full_name || '...')}
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">{editingMessage?.content || replyingToMessage?.content || file?.name}</p>
                    </div>
                    <button onClick={() => { setReplyingToMessage(null); cancelEdit(); removeFile(); }} className="ml-4 p-2 bg-slate-200 rounded-xl hover:bg-slate-300 transition-colors"><X size={14}/></button>
                </div>
            )}
            
            {recordingStatus !== 'idle' ? (
                <div className="flex items-center space-x-4 h-14 bg-slate-50 rounded-[1.5rem] px-4">
                    <button type="button" onClick={cleanupRecording} className="p-3 text-red-500 hover:bg-red-50 rounded-2xl"><Trash2 size={20} /></button>
                    <div className="flex-1 flex items-center space-x-3">
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-slate-700 font-black font-mono">{formatTime(recordingTime)}</span>
                    </div>
                    <button type="button" onClick={() => mediaRecorderRef.current?.stop()} className="bg-isig-blue text-white p-3 rounded-2xl hover:bg-blue-600 shadow-lg shadow-isig-blue/20"><StopCircle size={24} /></button>
                </div>
            ) : (
                <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                    <label className="p-3 text-slate-400 hover:text-isig-blue cursor-pointer rounded-2xl hover:bg-slate-50 transition-all">
                        <Paperclip size={24} />
                        <input type="file" ref={fileInputRef} onChange={handleSetFile} className="hidden" />
                    </label>
                    <div className="flex-1">
                        <input 
                          type="text" 
                          value={newMessage} 
                          onChange={(e) => setNewMessage(e.target.value)} 
                          placeholder="Votre message..." 
                          className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] px-5 py-4 focus:ring-2 focus:ring-isig-blue outline-none transition-all font-medium text-slate-700" 
                        />
                    </div>
                    {(newMessage.trim() || file) ? (
                         <button type="submit" disabled={isUploading} className="bg-isig-blue text-white w-14 h-14 flex items-center justify-center rounded-[1.5rem] shadow-lg shadow-isig-blue/20 hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50">
                            {isUploading ? <Spinner /> : <Send size={24} />}
                        </button>
                    ) : (
                        <button type="button" onClick={startRecording} className="bg-isig-blue text-white p-4 rounded-[1.5rem] shadow-lg shadow-isig-blue/20 hover:bg-blue-600 transition-all active:scale-95">
                            <Mic size={24} />
                        </button>
                    )}
                </form>
            )}
        </div>
      {mediaInView && <MediaViewerModal mediaUrl={mediaInView.url} mediaType={mediaInView.type} fileName={mediaInView.name} onClose={() => setMediaInView(null)} />}
    </div>
  );
};

export default ChatWindow;
