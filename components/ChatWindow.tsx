
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Message, Profile } from '../types';
import Spinner from './Spinner';
import Avatar from './Avatar';
import { Send, ArrowLeft, Paperclip, X, Info, Mic, Trash2, StopCircle, Search, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
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

    if (diffMins < 3) return 'En ligne';
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
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherParticipant, setOtherParticipant] = useState<Profile | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [presenceStatus, setPresenceStatus] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { fetchUnreadCount } = useUnreadMessages();

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    }, 100);
  };
  
  const markMessagesAsRead = useCallback(async () => {
    if (!session?.user || !conversationId) return;
    
    // On marque comme lu dans la DB
    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', session.user.id)
      .is('is_read', false);

    if (!error) {
        // IMPORTANT: On force le rafraîchissement global des compteurs
        fetchUnreadCount();
        onMessagesRead();
    }
  }, [session?.user?.id, conversationId, fetchUnreadCount, onMessagesRead]);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!session?.user || !conversationId) return;
    if (!isSilent) setLoading(true);
    
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
          setPresenceStatus(formatPresence(p.last_seen_at));
      }

      const { data: myProfile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (myProfile) setCurrentUserProfile(myProfile);

      const { data: messagesData } = await supabase
        .from('messages')
        .select('*, profiles:sender_id(*), replied_to:replying_to_message_id(*, profiles:sender_id(*))')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      
      setMessages(messagesData as any[] || []);
      
      // On marque comme lu immédiatement après le fetch si nécessaire
      if (messagesData?.some(m => !m.is_read && m.sender_id !== session.user.id)) {
          markMessagesAsRead();
      }
    } catch (err: any) {
      if (!isSilent) setError("Échec du chargement.");
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [conversationId, session?.user?.id, markMessagesAsRead]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  useEffect(() => {
    if (!conversationId || !session?.user) return;

    const channel = supabase.channel(`chat_room_${conversationId}`)
      .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'messages', 
          filter: `conversation_id=eq.${conversationId}`
      }, async (payload) => {
          if (payload.eventType === 'INSERT') {
             // Si c'est un message reçu, on marque comme lu
             if (payload.new.sender_id !== session.user.id) {
                markMessagesAsRead();
             }
             fetchData(true);
             scrollToBottom();
          } else {
             fetchData(true);
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, session?.user.id, markMessagesAsRead, fetchData]);

  const handleSendMessage = async (e?: React.FormEvent, audioBlob?: Blob) => {
    e?.preventDefault();
    if ((!newMessage.trim() && !file && !audioBlob) || !session?.user || !currentUserProfile) return;
    
    setIsUploading(true);
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

        const { error: insertError } = await supabase.from('messages').insert({ 
            conversation_id: conversationId, 
            sender_id: session.user.id, 
            content: newMessage, 
            media_url: mediaUrl, 
            media_type: mediaType, 
            replying_to_message_id: replyingToMessage?.id 
        });

        if (insertError) throw insertError;
        setNewMessage('');
        setFile(null);
        setFilePreview(null);
        setReplyingToMessage(null);
        adjustHeight();
    } catch (err: any) {
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
        <header className="flex items-center p-4 border-b border-slate-100 bg-white/95 backdrop-blur-md z-10 shadow-sm">
            <button onClick={() => navigate('/chat')} className="mr-4 p-2 rounded-2xl hover:bg-slate-50 transition-colors">
                <ArrowLeft size={20} />
            </button>
            {otherParticipant && (
                <Link to={`/profile/${otherParticipant.id}`} className="flex items-center space-x-3 group min-w-0">
                    <Avatar avatarUrl={otherParticipant.avatar_url} name={otherParticipant.full_name} size="md" />
                    <div className="min-w-0">
                        <h3 className="font-black text-slate-800 tracking-tight truncate">{otherParticipant.full_name}</h3>
                        <p className={`text-[10px] font-black uppercase tracking-widest ${presenceStatus === 'En ligne' ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {presenceStatus}
                        </p> 
                    </div>
                </Link>
            )}
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 min-h-0 custom-scrollbar">
            {messages.map((msg) => (
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
            <div ref={messagesEndRef} className="h-4" />
        </div>

        <div className="p-4 border-t border-slate-100 bg-white">
            {recordingStatus === 'recording' ? (
                <div className="flex items-center space-x-4 h-14 bg-red-50 rounded-2xl px-4 border border-red-100">
                    <div className="flex-1 flex items-center space-x-3">
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-red-700 font-black">{formatTime(recordingTime)}</span>
                    </div>
                    <button type="button" onClick={stopRecording} className="bg-red-500 text-white p-2 rounded-xl"><StopCircle size={24} /></button>
                </div>
            ) : (
                <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
                    <label className="p-3 text-slate-400 hover:text-isig-blue cursor-pointer rounded-2xl">
                        <Paperclip size={24} />
                        <input type="file" ref={fileInputRef} onChange={(e) => {
                            if (e.target.files?.[0]) {
                                setFile(e.target.files[0]);
                                setFilePreview(e.target.files[0].name);
                            }
                        }} className="hidden" />
                    </label>
                    <div className="flex-1">
                        {filePreview && (
                            <div className="flex items-center bg-isig-blue/10 p-2 mb-2 rounded-xl text-xs text-isig-blue">
                                <span className="truncate flex-1">{filePreview}</span>
                                <button type="button" onClick={() => { setFile(null); setFilePreview(null); }}><X size={14}/></button>
                            </div>
                        )}
                        <textarea 
                          ref={textareaRef}
                          value={newMessage} 
                          onChange={(e) => { setNewMessage(e.target.value); adjustHeight(); }} 
                          placeholder="Votre message..." 
                          className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-isig-blue outline-none transition-all resize-none max-h-40" 
                        />
                    </div>
                    <div className="flex items-center">
                        {!newMessage.trim() && !file ? (
                            <button type="button" onClick={startRecording} className="bg-isig-blue text-white p-3 rounded-2xl"><Mic size={24} /></button>
                        ) : (
                            <button type="submit" disabled={isUploading} className="bg-isig-blue text-white p-3 rounded-2xl disabled:opacity-50">
                                {isUploading ? <Spinner /> : <Send size={24} />}
                            </button>
                        )}
                    </div>
                </form>
            )}
        </div>
        {mediaInView && <MediaViewerModal mediaUrl={mediaInView.url} mediaType={mediaInView.type} fileName={mediaInView.name} onClose={() => setMediaInView(null)} />}
    </div>
  );
};

export default ChatWindow;
