
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Message, Profile } from '../types';
import Spinner from './Spinner';
import Avatar from './Avatar';
import { Send, ArrowLeft, Paperclip, X, Mic, StopCircle, Pencil, RotateCcw, Trash2 } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
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
    }, 50);
  };
  
  const markMessagesAsRead = useCallback(async () => {
    if (!session?.user || !conversationId) return;
    const { error } = await supabase.from('messages').update({ is_read: true }).eq('conversation_id', conversationId).neq('sender_id', session.user.id).is('is_read', false);
    if (!error) {
        fetchUnreadCount();
        onMessagesRead();
    }
  }, [session?.user?.id, conversationId, fetchUnreadCount, onMessagesRead]);

  const fetchData = useCallback(async () => {
    if (!session?.user || !conversationId) return;
    if (messages.length === 0) setLoading(true);

    try {
      const { data: participantData } = await supabase.from('conversation_participants').select('profiles:user_id(*)').eq('conversation_id', conversationId).neq('user_id', session.user.id).maybeSingle();
      if (participantData?.profiles) {
          const p = participantData.profiles as unknown as Profile;
          setOtherParticipant(p);
          setIsOnlineRealtime(isUserOnline(p.last_seen_at));
      }
      
      const { data: myProfile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (myProfile) setCurrentUserProfile(myProfile);

      const { data: messagesData } = await supabase.from('messages').select('*, profiles:sender_id(*), replied_to:replying_to_message_id(*, profiles:sender_id(*))').eq('conversation_id', conversationId).order('created_at', { ascending: true });
      setMessages(messagesData as any[] || []);
      
      if (messagesData?.some(m => !m.is_read && m.sender_id !== session.user.id)) markMessagesAsRead();
      scrollToBottom("auto");
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [conversationId, session?.user?.id]);

  useEffect(() => { 
    setMessages([]);
    fetchData(); 
  }, [fetchData]);

  useEffect(() => {
    if (!conversationId || !session?.user) return;
    const channel = supabase.channel(`chat_messages_${conversationId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, async (payload) => {
          const { data } = await supabase.from('messages').select('*, profiles:sender_id(*), replied_to:replying_to_message_id(*, profiles:sender_id(*))').eq('id', payload.new.id).single();
          if (data) {
              setMessages(current => {
                  if (current.some(m => m.id === data.id)) return current;
                  return [...current, data as Message];
              });
              if (data.sender_id !== session.user.id) markMessagesAsRead();
              scrollToBottom();
          }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
          setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` }, (payload) => {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId, session?.user.id, markMessagesAsRead]);

  const handleSendMessage = async (e?: React.FormEvent, audioBlob?: Blob) => {
    e?.preventDefault();
    if ((!newMessage.trim() && !file && !audioBlob) || !session?.user || !currentUserProfile) return;
    
    setIsUploading(true);

    try {
        if (editingMessage) {
            const { error } = await supabase.from('messages').update({ content: newMessage }).eq('id', editingMessage.id);
            if (error) throw error;
            setEditingMessage(null);
            setNewMessage('');
        } else {
            let mediaUrl, mediaType;
            if (file || audioBlob) {
                const mediaFile = file || new File([audioBlob!], "audio.webm", { type: "audio/webm" });
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
        }
        setTimeout(adjustHeight, 10);
        scrollToBottom();
    } catch (err) { console.error(err); } finally { setIsUploading(false); }
  };

  const handleDeleteConversation = async () => {
      if (!window.confirm("Voulez-vous vraiment supprimer toute cette conversation ?")) return;
      setLoading(true);
      try {
          const { error } = await supabase.from('conversations').delete().eq('id', conversationId);
          if (error) throw error;
          navigate('/chat');
      } catch (err) {
          console.error(err);
          alert("Erreur lors de la suppression.");
          setLoading(false);
      }
  };

  const startRecording = async (e?: React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
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

  const stopRecording = (e?: React.MouseEvent) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      mediaRecorderRef.current?.stop();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      setRecordingTime(0);
  };

  const handleSetEditing = (msg: Message) => {
    setEditingMessage(msg);
    setNewMessage(msg.content);
    setReplyingToMessage(null);
    setTimeout(() => {
        textareaRef.current?.focus();
        adjustHeight();
    }, 100);
  };

  if (loading && messages.length === 0) return <div className="flex-1 flex items-center justify-center bg-white"><Spinner /></div>;

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
        <header className="flex items-center justify-between p-4 border-b border-slate-100 bg-white/95 backdrop-blur-md z-10 shadow-sm shrink-0">
            <div className="flex items-center min-w-0">
                <button type="button" onClick={() => navigate('/chat')} className="mr-3 p-2.5 rounded-2xl hover:bg-slate-50 transition-all text-slate-600 bg-slate-100/50 active:bg-slate-200">
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
            </div>
            <button 
                onClick={handleDeleteConversation} 
                className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all active:scale-90"
                title="Supprimer la conversation"
            >
                <Trash2 size={20} />
            </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30 custom-scrollbar">
            {messages.map((msg) => (
                <MessageBubble 
                  key={msg.id} 
                  message={msg} 
                  isOwnMessage={msg.sender_id === session?.user.id} 
                  onSetEditing={handleSetEditing} 
                  onSetReplying={setReplyingToMessage} 
                  setMessages={setMessages} 
                  onMediaClick={(url, type, name) => setMediaInView({ url, type, name })} 
                />
            ))}
            <div ref={messagesEndRef} className="h-4" />
        </div>

        <div className="p-4 border-t border-slate-100 bg-white shrink-0">
            {recordingStatus === 'recording' ? (
                <div className="flex items-center space-x-4 h-14 bg-red-50 rounded-2xl px-4 border border-red-100 animate-pulse">
                    <div className="flex-1 flex items-center space-x-3">
                        <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></div>
                        <span className="text-red-700 font-black tracking-tighter">{formatTime(recordingTime)}</span>
                    </div>
                    <button type="button" onClick={stopRecording} className="bg-red-500 text-white p-2.5 rounded-xl shadow-lg shadow-red-200 transition-transform active:scale-95"><StopCircle size={24} /></button>
                </div>
            ) : (
                <div className="space-y-2">
                    {replyingToMessage && (
                        <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl mb-2 border border-slate-100 text-xs animate-fade-in-up">
                            <div className="truncate pr-4">
                                <span className="font-black text-isig-blue uppercase tracking-widest text-[9px] mr-2">Réponse :</span>
                                <span className="text-slate-500 italic font-medium">{replyingToMessage.content || 'Média'}</span>
                            </div>
                            <button type="button" onClick={() => setReplyingToMessage(null)} className="text-slate-400 hover:text-red-500 p-1 transition-colors"><X size={16}/></button>
                        </div>
                    )}
                    {editingMessage && (
                        <div className="flex items-center justify-between bg-isig-orange/10 p-3 rounded-2xl mb-2 border border-isig-orange/20 text-xs animate-fade-in-up">
                            <div className="flex items-center text-isig-orange font-black uppercase tracking-widest text-[9px]">
                                <Pencil size={12} className="mr-2" /> Modification...
                            </div>
                            <button type="button" onClick={() => { setEditingMessage(null); setNewMessage(''); }} className="text-isig-orange hover:text-orange-600 p-1 transition-colors"><RotateCcw size={16}/></button>
                        </div>
                    )}
                    <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
                        {!editingMessage && (
                            <label className="p-3 text-slate-400 hover:text-isig-blue cursor-pointer rounded-2xl shrink-0 transition-colors active:bg-slate-100">
                                <Paperclip size={24} />
                                <input type="file" onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                        setFile(e.target.files[0]);
                                        setFilePreview(e.target.files[0].name);
                                    }
                                }} className="hidden" />
                            </label>
                        )}
                        <div className="flex-1 min-w-0">
                            {filePreview && (
                                <div className="flex items-center bg-isig-blue/10 p-2 mb-2 rounded-xl text-[10px] font-black uppercase text-isig-blue border border-isig-blue/20">
                                    <span className="truncate flex-1 ml-2">{filePreview}</span>
                                    <button type="button" onClick={() => { setFile(null); setFilePreview(null); }} className="p-1 transition-colors hover:text-red-500"><X size={14}/></button>
                                </div>
                            )}
                            <textarea 
                                ref={textareaRef}
                                value={newMessage} 
                                onChange={(e) => { setNewMessage(e.target.value); adjustHeight(); }} 
                                placeholder={editingMessage ? "Modifier..." : "Message..."} 
                                className="chat-textarea w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3.5 focus:ring-2 focus:ring-isig-blue outline-none transition-all resize-none max-h-40 font-medium text-slate-700" 
                                style={{ 
                                    minHeight: '48px',
                                    overflow: 'hidden'
                                }}
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
