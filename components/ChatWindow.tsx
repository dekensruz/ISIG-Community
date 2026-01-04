
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Message, Profile } from '../types';
import Spinner from './Spinner';
import Avatar from './Avatar';
import { Send, ArrowLeft, Paperclip, X, Info, Mic, Trash2, StopCircle, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUnreadMessages } from './UnreadMessagesProvider';
import MessageBubble from './MessageBubble';
import MediaViewerModal from './MediaViewerModal';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ChatWindowProps {
  conversationId: string;
  onMessagesRead: () => void;
}

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

const ChatWindow: React.FC<ChatWindowProps> = ({ conversationId, onMessagesRead }) => {
  const { session } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherParticipant, setOtherParticipant] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
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
    messagesEndRef.current?.scrollIntoView({ behavior });
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
  }, [session, conversationId, fetchUnreadCount, onMessagesRead]);

  const fetchData = useCallback(async () => {
    if (!session?.user || !conversationId) return;
    setLoading(true);
    try {
      const { data: participantData, error: participantError } = await supabase.rpc('get_conversation_participant', { p_conversation_id: conversationId }).single();
      if (participantError) throw participantError;
      
      const participantProfile = participantData as unknown as Profile;
      setOtherParticipant(participantProfile);
      setPresenceStatus(formatPresence(participantProfile.last_seen_at));

      const { data: messagesData } = await supabase
        .from('messages')
        .select('*, profiles:sender_id(*), replied_to:replying_to_message_id(*, profiles:sender_id(*))')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      setMessages(messagesData as any[] || []);
      await markMessagesAsRead();
    } catch (error) {
      console.error('Error fetching chat data:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, session?.user, markMessagesAsRead]);

  useEffect(() => { fetchData(); }, [fetchData]);
  
  useEffect(() => {
    if (!session?.user || !otherParticipant?.id) return;
    const profileChannel = supabase.channel(`profiles-channel-${otherParticipant.id}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${otherParticipant.id}` }, (payload) => {
            const newProfile = payload.new as Profile;
            setPresenceStatus(formatPresence(newProfile.last_seen_at));
        }).subscribe();
    return () => { supabase.removeChannel(profileChannel); };
  }, [session?.user, otherParticipant?.id]);

  useEffect(() => {
    const channel = supabase.channel(`chat:${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}`}, (payload) => {
            if (payload.eventType === 'INSERT') {
                const msg = payload.new as Message;
                // On récupère le profil pour l'affichage (car l'INSERT simple ne contient pas la jointure)
                supabase.from('profiles').select('*').eq('id', msg.sender_id).single().then(({data}) => {
                    if(data) {
                        setMessages(prev => {
                            // Éviter les doublons si l'état local a déjà été mis à jour
                            if (prev.some(m => m.id === msg.id)) return prev;
                            return [...prev, {...msg, profiles: data}];
                        });
                    }
                });
                if (msg.sender_id !== session?.user.id) markMessagesAsRead();
            } else if (payload.eventType === 'UPDATE') {
                setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
            } else if (payload.eventType === 'DELETE') {
                setMessages(prev => prev.filter(m => m.id !== payload.old.id));
            }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, markMessagesAsRead, session?.user.id]);

  useEffect(() => { 
    if (!loading) scrollToBottom("auto"); 
  }, [messages.length, loading]);

  const handleSendMessage = async (e?: React.FormEvent, audioBlob?: Blob) => {
    e?.preventDefault();
    if ((!newMessage.trim() && !file && !audioBlob) || !session?.user) return;
    
    if (editingMessage) {
        await supabase.from('messages').update({ content: newMessage, updated_at: new Date().toISOString() }).eq('id', editingMessage.id);
        cancelEdit();
        return;
    }
    
    setIsUploading(true);
    const mediaFile = file || (audioBlob ? new File([audioBlob], "voix.webm", { type: "audio/webm" }) : null);

    try {
        let mediaUrl, mediaType;
        if (mediaFile) {
            const fileName = `${conversationId}/${session.user.id}-${Date.now()}.${mediaFile.name.split('.').pop()}`;
            const { data: uploadData, error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, mediaFile);
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage.from('chat_media').getPublicUrl(uploadData.path);
            mediaUrl = urlData.publicUrl;
            mediaType = mediaFile.type;
        }

        const msgData = { conversation_id: conversationId, sender_id: session.user.id, content: newMessage, media_url: mediaUrl, media_type: mediaType, replying_to_message_id: replyingToMessage?.id };
        const { error } = await supabase.from('messages').insert(msgData);
        if (error) throw error;

        setNewMessage('');
        removeFile();
        setReplyingToMessage(null);
    } catch (err: any) {
        alert(err.message);
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

  if (loading || !otherParticipant) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-white">
            <Spinner />
            <p className="mt-4 text-slate-400 font-bold text-sm uppercase tracking-widest">Chargement de la conversation...</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white relative">
        <header className="flex items-center p-4 border-b border-slate-100 bg-white/90 backdrop-blur-xl z-10">
            <Link to="/chat" className="md:hidden mr-4 p-2 rounded-2xl hover:bg-slate-50 transition-colors">
                <ArrowLeft size={20} />
            </Link>
            {!showSearch && (
                <Link to={`/profile/${otherParticipant.id}`} className="flex items-center space-x-3 group min-w-0">
                    <Avatar avatarUrl={otherParticipant.avatar_url} name={otherParticipant.full_name} size="md" className="ring-2 ring-transparent group-hover:ring-isig-blue/20 transition-all" />
                    <div className="min-w-0">
                        <h3 className="font-black text-slate-800 tracking-tight truncate group-hover:text-isig-blue transition-colors">{otherParticipant.full_name}</h3>
                        <div className="flex items-center">
                            <div className={`w-2 h-2 rounded-full mr-1.5 ${presenceStatus === 'En ligne' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{presenceStatus}</p> 
                        </div>
                    </div>
                </Link>
            )}

            <div className={`flex items-center space-x-2 ${showSearch ? 'w-full' : 'ml-auto'}`}>
                {showSearch ? (
                    <div className="flex-grow flex items-center bg-slate-50 rounded-2xl px-4 py-1 border border-slate-100">
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher..." className="w-full bg-transparent border-none py-2 text-sm focus:ring-0 outline-none font-bold" autoFocus />
                        <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
                    </div>
                ) : (
                    <>
                        <button onClick={() => setShowSearch(true)} className="p-3 rounded-2xl hover:bg-slate-50 text-slate-400 hover:text-isig-blue transition-all"><Search size={20} /></button>
                        <Link to={`/profile/${otherParticipant.id}`} className="p-3 rounded-2xl hover:bg-slate-50 text-slate-400 hover:text-isig-blue transition-all"><Info size={20} /></Link>
                    </>
                )}
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50 min-h-0 custom-scrollbar">
            {messages.filter(m => !searchQuery || m.content.toLowerCase().includes(searchQuery.toLowerCase())).map((msg) => (
                <MessageBubble key={msg.id} message={msg} isOwnMessage={msg.sender_id === session?.user.id} onSetEditing={setEditingMessage} onSetReplying={setReplyingToMessage} setMessages={setMessages} onMediaClick={(url, type, name) => setMediaInView({ url, type, name })} />
            ))}
            <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-slate-100 bg-white">
            {(replyingToMessage || editingMessage || filePreview) && recordingStatus === 'idle' && (
                <div className="bg-slate-50 p-4 rounded-3xl mb-3 flex items-center justify-between border border-slate-100 animate-fade-in">
                    <div className="min-w-0 flex-1">
                        <p className={`text-xs font-black uppercase tracking-widest ${editingMessage ? 'text-isig-orange' : 'text-isig-blue'}`}>
                            {editingMessage ? 'Modification' : 'Réponse à ' + (replyingToMessage?.profiles?.full_name || '...')}
                        </p>
                        <p className="text-sm text-slate-500 truncate mt-0.5">{editingMessage?.content || replyingToMessage?.content || file?.name}</p>
                    </div>
                    <button onClick={() => { setReplyingToMessage(null); cancelEdit(); removeFile(); }} className="ml-4 p-2 bg-slate-200 rounded-xl hover:bg-slate-300 transition-colors"><X size={16}/></button>
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
                <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                    <label className="p-3 text-slate-400 hover:text-isig-blue cursor-pointer rounded-2xl hover:bg-slate-50 transition-all">
                        <Paperclip size={24} />
                        <input type="file" ref={fileInputRef} onChange={handleSetFile} className="hidden" />
                    </label>
                    <div className="flex-1 relative">
                        <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Écrire..." className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] px-6 py-4 focus:ring-2 focus:ring-isig-blue outline-none transition-all font-medium text-slate-700" />
                    </div>
                    {newMessage.trim() || file ? (
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
