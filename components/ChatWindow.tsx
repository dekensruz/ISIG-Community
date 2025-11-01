import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Message, Profile } from '../types';
import Spinner from './Spinner';
import Avatar from './Avatar';
import { Send, ArrowLeft, Paperclip, X, FileText, Info, Mic, Trash2, StopCircle, Search } from 'lucide-react';
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

    if (diffMins < 5) { // Threshold increased to 5 minutes
        return 'en ligne';
    }
    // More natural phrasing
    return `en ligne ${formatDistanceToNow(lastSeenDate, { locale: fr, addSuffix: true })}`;
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

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Voice message state
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording'>('idle');
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const visualizerFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);


  // Presence state
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
        if (selectedFile.size > 100 * 1024 * 1024) { // 100MB
            alert("Le fichier est trop volumineux. La taille maximale est de 100 Mo.");
            return;
        }
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
      if (filePreview && filePreview.startsWith("blob:")) {
        URL.revokeObjectURL(filePreview);
      }
      setFilePreview(null);
      if(fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const cancelEdit = () => {
    setEditingMessage(null);
    setNewMessage('');
  };

  useEffect(() => {
    if (messages.length) {
        scrollToBottom("auto");
    }
  }, [messages.length]);

  const markMessagesAsRead = useCallback(async () => {
    if (!session?.user || !conversationId) return;

    const { error } = await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', session.user.id)
      .is('is_read', false);
    
    if (error) {
        console.error("Error marking messages as read:", error);
    } else {
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


      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*, profiles:sender_id(*), replied_to:replying_to_message_id(*, profiles:sender_id(*))')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (messagesError) throw messagesError;
      setMessages(messagesData as any[]);
      await markMessagesAsRead();
    } catch (error) {
      console.error('Error fetching chat data:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId, session?.user, markMessagesAsRead]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
   // Presence Effect
    useEffect(() => {
        if (!session?.user) return;

        const updateMyPresence = () => {
            supabase.from('profiles')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', session.user.id)
                .then();
        };

        updateMyPresence();
        const interval = setInterval(updateMyPresence, 30000); // Update every 30 seconds

        const profileChannel = supabase
            .channel(`profiles-channel`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'profiles',
                filter: `id=eq.${otherParticipant?.id}`
            }, (payload) => {
                const newProfile = payload.new as Profile;
                setOtherParticipant(prev => prev ? {...prev, last_seen_at: newProfile.last_seen_at} : null);
                setPresenceStatus(formatPresence(newProfile.last_seen_at));
            })
            .subscribe();

        return () => {
            clearInterval(interval);
            supabase.removeChannel(profileChannel);
        };

    }, [session?.user, otherParticipant?.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}`},
        (payload) => {
            if (payload.eventType === 'INSERT') {
                const newMessage = payload.new as Message;
                if (newMessage.sender_id !== session?.user.id) {
                    supabase.from('profiles').select('*').eq('id', newMessage.sender_id).single().then(({data: profileData}) => {
                         if(profileData){
                             setMessages(prev => [...prev, {...newMessage, profiles: profileData}])
                         }
                    })
                    markMessagesAsRead();
                }
            }
            if (payload.eventType === 'UPDATE') {
                const updatedMessage = payload.new as Message;
                setMessages(prev => prev.map(msg => msg.id === updatedMessage.id ? { ...msg, content: updatedMessage.content, updated_at: updatedMessage.updated_at } : msg));
            }
            if (payload.eventType === 'DELETE') {
                 setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
            }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, markMessagesAsRead, session?.user.id]);

const handleSendMessage = async (e?: React.FormEvent, audioBlobToSend?: Blob) => {
    e?.preventDefault();
    if ((!newMessage.trim() && !file && !audioBlobToSend) || !session?.user) return;
    
    if (editingMessage) {
        const { error } = await supabase.from('messages').update({ content: newMessage, updated_at: new Date().toISOString() }).eq('id', editingMessage.id);
        if (error) alert("Erreur lors de la modification du message.");
        cancelEdit();
        return;
    }
    
    setIsUploading(true);
    const tempId = `temp_${Date.now()}`;
    const contentToSend = newMessage;
    const mediaFile = file || (audioBlobToSend ? new File([audioBlobToSend], "voix.webm", { type: "audio/webm" }) : null);

    try {
        let mediaUrl: string | undefined = undefined;
        let mediaType: string | undefined = undefined;

        if (mediaFile) {
            const fileExt = mediaFile.name.split('.').pop();
            const fileName = `${conversationId}/${session.user.id}-${Date.now()}.${fileExt}`;
            const { data: uploadData, error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, mediaFile);
            
            if (uploadError) {
                throw new Error(`Erreur de stockage : ${uploadError.message}`);
            }
            
            const { data: urlData } = supabase.storage.from('chat_media').getPublicUrl(uploadData.path);
            mediaUrl = urlData.publicUrl;
            mediaType = mediaFile.type;
        }
        
        if (!contentToSend.trim() && !mediaUrl) {
            throw new Error("Le message ne peut pas être entièrement vide.");
        }

        const messageData = {
          conversation_id: conversationId,
          sender_id: session.user.id,
          // Always send the content string. An empty string is not NULL and satisfies the constraint.
          content: contentToSend,
          media_url: mediaUrl,
          media_type: mediaType,
          replying_to_message_id: replyingToMessage?.id,
          is_read: false,
        };
        
        const {data: currentUserProfile} = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        
        const optimisticMessage: Message = {
            id: tempId,
            conversation_id: conversationId,
            sender_id: session.user.id,
            content: contentToSend, // Display original content optimistically
            media_url: mediaUrl,
            media_type: mediaType,
            replying_to_message_id: replyingToMessage?.id,
            is_read: false,
            created_at: new Date().toISOString(),
            profiles: currentUserProfile || undefined,
            replied_to: replyingToMessage || undefined,
        };

        setMessages(prev => [...prev, optimisticMessage]);

        setNewMessage('');
        removeFile();
        setReplyingToMessage(null);

        const { data: insertedMessage, error } = await supabase.from('messages').insert(messageData).select().single();
        
        if (error) {
            throw new Error(`Erreur de base de données : ${error.message}`);
        }

        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, ...insertedMessage, id: insertedMessage.id, content: insertedMessage.content || '' } : m));
    } catch (err: any) {
        console.error('Error sending message:', err);
        alert(`Erreur d'envoi du message:\n${err.message}`);
        setMessages(prev => prev.filter(m => m.id !== tempId));
        if(contentToSend) setNewMessage(contentToSend);
    } finally {
        setIsUploading(false);
    }
  };
  
  const handleSetEditing = (message: Message) => {
      setEditingMessage(message);
      setNewMessage(message.content);
      setReplyingToMessage(null);
      removeFile();
  }

  const handleSetReplying = (message: Message) => {
      setReplyingToMessage(message);
      setEditingMessage(null);
  }
  
  const cleanupRecording = useCallback(() => {
    if (visualizerFrameRef.current) cancelAnimationFrame(visualizerFrameRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    
    mediaRecorderRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    audioChunksRef.current = [];
    
    setRecordingTime(0);
  }, []);

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (event) => audioChunksRef.current.push(event.data);
        
        mediaRecorderRef.current.onstop = async () => {
            const finalAudioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            if (finalAudioBlob.size < 100) {
                console.warn("L'enregistrement était trop court ou a échoué.");
                cleanupRecording();
                setRecordingStatus('idle');
                return;
            }
            await handleSendMessage(undefined, finalAudioBlob);
            cleanupRecording();
            setRecordingStatus('idle');
        };

        mediaRecorderRef.current.start();
        setRecordingStatus('recording');
        
        timerIntervalRef.current = window.setInterval(() => setRecordingTime(prev => prev + 1), 1000);
        visualize();
    } catch (err) {
        console.error("Erreur d'accès au microphone:", err);
        alert("Impossible d'accéder au microphone. Veuillez vérifier les autorisations de votre navigateur.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingStatus === 'recording') {
        mediaRecorderRef.current.stop();
    }
  };
  
  const cancelRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      }
      cleanupRecording();
      setRecordingStatus('idle');
  };

  const visualize = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');
    if (!canvasCtx) return;
    
    // Set canvas resolution to match its displayed size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    canvasCtx.scale(window.devicePixelRatio, window.devicePixelRatio);


    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const draw = () => {
        visualizerFrameRef.current = requestAnimationFrame(draw);
        analyserRef.current!.getByteTimeDomainData(dataArray);

        canvasCtx.fillStyle = '#f1f5f9'; // bg-slate-100
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = '#00AEEF'; // isig-blue
        canvasCtx.beginPath();
        
        const sliceWidth = rect.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * rect.height / 2;
            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    };
    draw();
  };

  useEffect(() => {
      return () => cleanupRecording();
  }, [cleanupRecording]);

  const filteredMessages = messages.filter(message => 
    (message.content && message.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (message.media_url && message.media_url.split('/').pop()?.toLowerCase().includes(searchQuery.toLowerCase()))
  );


  if (loading) {
    return <div className="flex-grow flex items-center justify-center"><Spinner /></div>;
  }
  
  if (!otherParticipant) {
    return <div className="flex-grow flex items-center justify-center text-slate-500">Conversation non trouvée.</div>;
  }

  const SmallSpinner = () => (
    <div className="animate-spin rounded-full h-5 w-5 border-2 border-solid border-white/50 border-t-white"></div>
  );

  return (
    <>
      <div className="flex flex-col h-full bg-white">
        <header className="flex items-center p-3 border-b border-slate-200 flex-shrink-0 bg-white/95 backdrop-blur-sm z-10">
            <Link to="/chat" className="md:hidden mr-3 p-2 rounded-full hover:bg-slate-100">
                <ArrowLeft size={20} />
            </Link>
            {!showSearch && (
                <Link to={`/profile/${otherParticipant.id}`} className="flex items-center space-x-3 hover:bg-slate-100 p-1 rounded-lg min-w-0">
                    <Avatar avatarUrl={otherParticipant.avatar_url} name={otherParticipant.full_name} />
                    <div className="min-w-0">
                        <h3 className="font-bold text-slate-800 truncate">{otherParticipant.full_name}</h3>
                        <p className="text-xs text-slate-500">{presenceStatus}</p> 
                    </div>
                </Link>
            )}

            <div className={`flex items-center space-x-1 ${showSearch ? 'w-full' : 'ml-auto'}`}>
                {showSearch ? (
                    <div className="flex-grow flex items-center transition-all duration-300">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Rechercher..."
                            className="w-full bg-slate-100 border-transparent rounded-full px-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-isig-blue"
                            autoFocus
                        />
                        <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
                            <X size={20} />
                        </button>
                    </div>
                ) : (
                    <>
                        <button onClick={() => setShowSearch(true)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-isig-blue">
                            <Search size={20} />
                        </button>
                        <Link to={`/profile/${otherParticipant.id}`} className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-isig-blue">
                            <Info size={20} />
                        </Link>
                    </>
                )}
            </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-1 bg-slate-50 min-h-0" style={{backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23d8e1f0' fill-opacity='0.4' fill-rule='evenodd'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/svg%3E")`}}>
            {filteredMessages.map((message) => (
            <MessageBubble 
                key={message.id} 
                message={message}
                isOwnMessage={message.sender_id === session?.user.id}
                onSetEditing={handleSetEditing}
                onSetReplying={handleSetReplying}
                setMessages={setMessages}
                onMediaClick={(url, type, name) => setMediaInView({ url, type, name })}
            />
            ))}
            <div ref={messagesEndRef} />
        </div>

        <div className="p-2 sm:p-4 border-t border-slate-200 bg-white flex-shrink-0">
            {(replyingToMessage || editingMessage || filePreview) && recordingStatus === 'idle' && (
                <div className="bg-slate-100 p-2 rounded-t-lg text-sm">
                    {replyingToMessage && (
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-isig-blue">Répondre à {replyingToMessage.profiles?.full_name}</p>
                                <p className="text-slate-600 truncate">{replyingToMessage.content}</p>
                            </div>
                            <button onClick={() => setReplyingToMessage(null)} className="p-1"><X size={16}/></button>
                        </div>
                    )}
                    {editingMessage && (
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-isig-orange">Modification du message</p>
                                <p className="text-slate-600 truncate">{editingMessage.content}</p>
                            </div>
                            <button onClick={cancelEdit} className="p-1"><X size={16}/></button>
                        </div>
                    )}
                    {filePreview && (
                        <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                                {file?.type.startsWith("image/") ? (
                                    <img src={filePreview} alt="preview" className="h-10 w-10 object-cover rounded"/>
                                ) : (
                                    <FileText className="h-8 w-8 text-slate-500"/>
                                )}
                                <p className="text-slate-600 truncate">{file?.name}</p>
                            </div>
                            <button onClick={removeFile} className="p-1"><X size={16}/></button>
                        </div>
                    )}
                </div>
            )}
            
            {recordingStatus !== 'idle' ? (
                <div className="flex items-center space-x-3 h-10">
                    <button type="button" onClick={cancelRecording} className="p-2 text-red-500 hover:bg-red-100 rounded-full">
                        <Trash2 size={22} />
                    </button>
                    <div className="flex-1 flex items-center bg-slate-100 rounded-full h-full px-4">
                        <div className="w-4 h-4 bg-red-500 rounded-full animate-pulse mr-3"></div>
                        <canvas ref={canvasRef} className="w-full h-8" />
                        <span className="text-slate-600 font-mono ml-3">{formatTime(recordingTime)}</span>
                    </div>
                     <button 
                        type="button" 
                        onClick={stopRecording}
                        className="bg-isig-blue text-white w-12 h-12 flex items-center justify-center rounded-full hover:bg-blue-600 transition-colors flex-shrink-0 disabled:bg-blue-300" 
                        disabled={isUploading}
                    >
                       {isUploading ? <SmallSpinner /> : <StopCircle size={20} />}
                    </button>
                </div>
            ) : (
                <form onSubmit={handleSendMessage} className="flex items-center space-x-2 sm:space-x-3">
                    <label htmlFor="chat-file-upload" className="p-2 text-slate-500 hover:text-isig-blue cursor-pointer rounded-full hover:bg-slate-100">
                        <Paperclip size={22} />
                        <input id="chat-file-upload" type="file" ref={fileInputRef} onChange={handleSetFile} className="hidden" />
                    </label>
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Écrire un message..."
                        className="w-full bg-slate-100 border border-transparent rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-isig-blue"
                        autoComplete="off"
                    />
                    {newMessage.trim() || file ? (
                         <button type="submit" disabled={isUploading} className="bg-isig-blue text-white w-12 h-12 flex items-center justify-center rounded-full hover:bg-blue-600 disabled:bg-blue-300 transition-colors flex-shrink-0">
                            {isUploading ? <SmallSpinner/> : <Send size={20} />}
                        </button>
                    ) : (
                        <button type="button" onClick={startRecording} className="bg-isig-blue text-white p-3 rounded-full hover:bg-blue-600 transition-colors flex-shrink-0">
                            <Mic size={20} />
                        </button>
                    )}
                </form>
            )}
        </div>
      </div>
      {mediaInView && (
        <MediaViewerModal
          mediaUrl={mediaInView.url}
          mediaType={mediaInView.type}
          fileName={mediaInView.name}
          onClose={() => setMediaInView(null)}
        />
      )}
    </>
  );
};

export default ChatWindow;