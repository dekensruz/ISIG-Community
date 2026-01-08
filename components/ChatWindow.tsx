
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Message, Profile } from '../types';
import Spinner from './Spinner';
import Avatar from './Avatar';
import { Send, ArrowLeft, Paperclip, X, Mic, StopCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useUnreadMessages } from './UnreadMessagesProvider';
import MessageBubble from './MessageBubble';
import MediaViewerModal from './MediaViewerModal';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';

const isUserOnline = (lastSeenAt?: string | null): boolean => {
    if (!lastSeenAt) return false;
    const lastSeenDate = new Date(lastSeenAt);
    const now = new Date();
    return differenceInMinutes(now, lastSeenDate) < 3;
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
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherParticipant, setOtherParticipant] = useState<Profile | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<number | null>(null);
  
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [mediaInView, setMediaInView] = useState<{ url: string; type: string; name: string } | null>(null);

  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording'>('idle');
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isOnlineRealtime, setIsOnlineRealtime] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { fetchUnreadCount } = useUnreadMessages();

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '48px';
      const nextHeight = Math.min(textarea.scrollHeight, 160);
      textarea.style.height = `${nextHeight}px`;
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    }, 100);
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

  const fetchData = useCallback(async () => {
    if (!session?.user || !conversationId) return;
    setLoading(true);
    
    try {
      const { data: participantData } = await supabase
        .from('conversation_participants')
        .select('profiles:user_id(*)')
        .eq('conversation_id', conversationId)
        .neq('user_id', session.user.id)
        .maybeSingle();

      if (participantData?.profiles) {
          const p = participantData.profiles as unknown as Profile;
          setOtherParticipant(p);
          setIsOnlineRealtime(isUserOnline(p.last_seen_at));
      }

      const { data: myProfile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (myProfile) setCurrentUserProfile(myProfile);

      const { data: messagesData } = await supabase
        .from('messages')
        .select('*, profiles:sender_id(*), replied_to:replying_to_message_id(*, profiles:sender_id(*))')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      setMessages((messagesData as any[] || []).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
      
      if (messagesData?.some(m => !m.is_read && m.sender_id !== session.user.id)) {
          markMessagesAsRead();
      }
      scrollToBottom("auto");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [conversationId, session?.user?.id, markMessagesAsRead]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  useEffect(() => {
    if (!conversationId || !session?.user || !otherParticipant) return;

    // Suppression des anciens canaux pour éviter les fuites de mémoire
    const channel = supabase.channel(`chat_room_${conversationId}`)
      .on('postgres_changes', { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'messages', 
          filter: `conversation_id=eq.${conversationId}`
      }, async (payload) => {
          const newMessageData = payload.new as Message;
          
          // Vérifier si le message existe déjà pour éviter les doublons
          setMessages(current => {
              if (current.some(m => m.id === newMessageData.id)) {
                  return current;
              }
              return current;
          });
          
          // Fetch immédiat les détails manquants (profils, reply)
          const { data } = await supabase
              .from('messages')
              .select('*, profiles:sender_id(*), replied_to:replying_to_message_id(*, profiles:sender_id(*))')
              .eq('id', newMessageData.id)
              .single();
          
          if (data) {
              setMessages(prev => {
                  // Vérifier à nouveau si le message existe déjà
                  const existsIndex = prev.findIndex(m => m.id === data.id);
                  if (existsIndex !== -1) {
                      // Mettre à jour le message existant avec les données enrichies
                      const updated = [...prev];
                      updated[existsIndex] = data as Message;
                      return updated;
                  }
                  
                  // Ajouter le nouveau message enrichi et trier par date
                  const newMessages = [...prev, data as Message];
                  return newMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              });
              
              if (data.sender_id !== session.user.id) {
                  markMessagesAsRead();
                  setOtherUserTyping(false);
              }
              scrollToBottom();
          }
      })
      .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
      }, async (payload) => {
          // Mettre à jour avec les données enrichies si nécessaire
          const { data } = await supabase
              .from('messages')
              .select('*, profiles:sender_id(*), replied_to:replying_to_message_id(*, profiles:sender_id(*))')
              .eq('id', payload.new.id)
              .single();
          
          if (data) {
              setMessages(prev => prev.map(m => m.id === data.id ? data as Message : m));
          } else {
              setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
          }
      })
      .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const isOtherPresent = Object.values(state).flat().some((p: any) => p.user_id === otherParticipant.id);
          setIsOnlineRealtime(isOtherPresent || isUserOnline(otherParticipant.last_seen_at));
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
          if (payload.payload.user_id === otherParticipant.id) {
              setOtherUserTyping(payload.payload.isTyping);
          }
      })
      .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
              await channel.track({ user_id: session.user.id, online_at: new Date().toISOString() });
          }
      });

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, session?.user.id, otherParticipant, markMessagesAsRead]);

  const handleTyping = (isTypingNow: boolean) => {
    if (!conversationId || !session?.user) return;
    const channel = supabase.channel(`chat_room_${conversationId}`);
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: session.user.id, isTyping: isTypingNow },
    });
  };

  useEffect(() => {
    if (newMessage.length > 0 && !isTyping) {
      setIsTyping(true);
      handleTyping(true);
    } else if (newMessage.length === 0 && isTyping) {
      setIsTyping(false);
      handleTyping(false);
    }

    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(() => {
        if (isTyping) {
            setIsTyping(false);
            handleTyping(false);
        }
    }, 3000);

    return () => { if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current); };
  }, [newMessage]);

  const handleSendMessage = async (e?: React.FormEvent, audioBlob?: Blob) => {
    e?.preventDefault();
    if ((!newMessage.trim() && !file && !audioBlob) || !session?.user || !currentUserProfile) return;
    
    setIsUploading(true);
    handleTyping(false);
    setIsTyping(false);

    try {
        let mediaUrl, mediaType;
        if (file || audioBlob) {
            const mediaFile = file || new File([audioBlob!], "voix.webm", { type: "audio/webm" });
            const fileName = `${conversationId}/${Date.now()}-${mediaFile.name}`;
            const { data: uploadData, error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, mediaFile);
            if (uploadError) throw uploadError;
            const { data: urlData } = supabase.storage.from('chat_media').getPublicUrl(uploadData.path);
            mediaUrl = urlData.publicUrl;
            mediaType = mediaFile.type;
        }

        const messageToInsert = { 
            conversation_id: conversationId, 
            sender_id: session.user.id, 
            content: newMessage, 
            media_url: mediaUrl, 
            media_type: mediaType, 
            replying_to_message_id: replyingToMessage?.id 
        };

        const { data: insertedData, error: insertError } = await supabase
            .from('messages')
            .insert(messageToInsert)
            .select('*, profiles:sender_id(*), replied_to:replying_to_message_id(*, profiles:sender_id(*))')
            .single();

        if (insertError) throw insertError;

        // Mise à jour immédiate locale avec le message enrichi
        if (insertedData) {
            setMessages(prev => {
                if (prev.some(m => m.id === insertedData.id)) return prev;
                // Ajouter le nouveau message et trier par date pour maintenir l'ordre
                const newMessages = [...prev, insertedData as Message];
                return newMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            });
        }

        setNewMessage('');
        setFile(null);
        setFilePreview(null);
        setReplyingToMessage(null);
        setTimeout(adjustHeight, 10);
        scrollToBottom();
    } catch (err) {
        alert("Échec de l'envoi.");
    } finally {
        setIsUploading(false);
    }
  };

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
            setRecordingStatus('idle');
        };
        mediaRecorderRef.current.start();
        setRecordingStatus('recording');
        timerIntervalRef.current = window.setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch (err) { alert("Microphone inaccessible."); }
  };

  const stopRecording = () => {
      mediaRecorderRef.current?.stop();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      setRecordingTime(0);
  };

  if (loading) return <div className="flex-1 flex items-center justify-center bg-white"><Spinner /></div>;

  return (
    <div className="flex flex-col h-full bg-white relative">
        <header className="flex items-center p-4 border-b border-slate-100 bg-white/95 backdrop-blur-md z-10 shadow-sm shrink-0">
            {/* Bouton Back visible sur tous les écrans */}
            <button onClick={() => navigate('/chat')} className="mr-4 p-2.5 rounded-2xl hover:bg-slate-50 transition-all text-slate-600 bg-slate-100/50">
                <ArrowLeft size={22} strokeWidth={2.5} />
            </button>
            {otherParticipant && (
                <Link to={`/profile/${otherParticipant.id}`} className="flex items-center space-x-3 group min-w-0">
                    <Avatar avatarUrl={otherParticipant.avatar_url} name={otherParticipant.full_name} size="md" />
                    <div className="min-w-0">
                        <h3 className="font-black text-slate-800 tracking-tight truncate">{otherParticipant.full_name}</h3>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${isOnlineRealtime ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {isOnlineRealtime ? 'En ligne' : otherParticipant.last_seen_at ? `Vu ${formatDistanceToNow(new Date(otherParticipant.last_seen_at), { locale: fr, addSuffix: true })}` : 'Hors ligne'}
                        </p> 
                    </div>
                </Link>
            )}
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 custom-scrollbar">
            {messages.map((msg) => (
                <MessageBubble 
                  key={msg.id} 
                  message={msg} 
                  isOwnMessage={msg.sender_id === session?.user.id} 
                  onSetEditing={() => {}} 
                  onSetReplying={setReplyingToMessage} 
                  setMessages={setMessages} 
                  onMediaClick={(url, type, name) => setMediaInView({ url, type, name })} 
                />
            ))}
            {otherUserTyping && (
                <div className="flex items-center space-x-2 p-3 bg-white rounded-2xl w-fit shadow-soft animate-pulse border border-slate-100 ml-2">
                    <div className="flex space-x-1">
                        <div className="w-1.5 h-1.5 bg-isig-blue rounded-full"></div>
                        <div className="w-1.5 h-1.5 bg-isig-blue rounded-full"></div>
                        <div className="w-1.5 h-1.5 bg-isig-blue rounded-full"></div>
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Écrit...</span>
                </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
        </div>

        <div className="p-4 border-t border-slate-100 bg-white shrink-0">
            {recordingStatus === 'recording' ? (
                <div className="flex items-center space-x-4 h-14 bg-red-50 rounded-2xl px-4 border border-red-100 animate-pulse">
                    <div className="flex-1 flex items-center space-x-3">
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></div>
                        <span className="text-red-700 font-black tracking-tighter">{formatTime(recordingTime)}</span>
                        <span className="text-red-400 text-[10px] font-bold uppercase tracking-widest">Enregistrement...</span>
                    </div>
                    <button type="button" onClick={stopRecording} className="bg-red-500 text-white p-2.5 rounded-xl shadow-lg shadow-red-200"><StopCircle size={24} /></button>
                </div>
            ) : (
                <div className="space-y-2">
                    {replyingToMessage && (
                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl mb-2 border border-slate-100 text-xs animate-fade-in-up">
                            <div className="truncate pr-4">
                                <span className="font-black text-isig-blue uppercase tracking-widest text-[9px] mr-2">Réponse :</span>
                                <span className="text-slate-500 italic font-medium">{replyingToMessage.content || 'Média'}</span>
                            </div>
                            <button onClick={() => setReplyingToMessage(null)} className="text-slate-400 hover:text-red-500 p-1"><X size={16}/></button>
                        </div>
                    )}
                    <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
                        <label className="p-3 text-slate-400 hover:text-isig-blue cursor-pointer rounded-2xl shrink-0 transition-colors">
                            <Paperclip size={24} />
                            <input type="file" onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    setFile(e.target.files[0]);
                                    setFilePreview(e.target.files[0].name);
                                }
                            }} className="hidden" />
                        </label>
                        <div className="flex-1 min-w-0">
                            {filePreview && (
                                <div className="flex items-center bg-isig-blue/10 p-2 mb-2 rounded-xl text-[10px] font-black uppercase text-isig-blue border border-isig-blue/20">
                                    <span className="truncate flex-1 ml-2">{filePreview}</span>
                                    <button type="button" onClick={() => { setFile(null); setFilePreview(null); }} className="p-1"><X size={14}/></button>
                                </div>
                            )}
                            <textarea 
                                ref={textareaRef}
                                value={newMessage} 
                                onChange={(e) => { setNewMessage(e.target.value); adjustHeight(); }} 
                                placeholder="Écrire un message..." 
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-isig-blue outline-none transition-all resize-none max-h-40 font-medium text-slate-700" 
                                style={{ minHeight: '48px' }}
                            />
                        </div>
                        <div className="flex items-center shrink-0">
                            {!newMessage.trim() && !file ? (
                                <button type="button" onClick={startRecording} className="bg-isig-blue text-white p-3.5 rounded-2xl shadow-lg shadow-isig-blue/20 transition-all active:scale-90 hover:bg-blue-600"><Mic size={24} /></button>
                            ) : (
                                <button type="submit" disabled={isUploading} className="bg-isig-blue text-white p-3.5 rounded-2xl disabled:opacity-50 shadow-lg shadow-isig-blue/20 transition-all active:scale-90 hover:bg-blue-600">
                                    {isUploading ? <Spinner /> : <Send size={24} />}
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}
        </div>
        {mediaInView && <MediaViewerModal mediaUrl={mediaInView.url} mediaType={mediaInView.type} fileName={mediaInView.name} onClose={() => setMediaInView(null)} />}
    </div>
  );
};

export default ChatWindow;
