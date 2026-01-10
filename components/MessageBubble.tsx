
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../services/supabase';
import { Message } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCheck, MoreHorizontal, MessageSquareReply, Pencil, Trash2, XCircle, Download, Play, Pause, X, Copy, AlertTriangle, FileAudio } from 'lucide-react';

interface MessageBubbleProps {
    message: Message;
    isOwnMessage: boolean;
    onSetEditing: (message: Message) => void;
    onSetReplying: (message: Message) => void;
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    onMediaClick: (url: string, type: string, name: string) => void;
}

const AudioPlayer: React.FC<{ src: string; isOwnMessage: boolean }> = ({ src, isOwnMessage }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [hasError, setHasError] = useState(false);

    const handlePlayPause = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (audioRef.current) {
            try {
                if (isPlaying) {
                    audioRef.current.pause();
                } else {
                    setHasError(false);
                    await audioRef.current.play();
                }
            } catch (err) {
                console.error("Erreur de lecture audio:", err);
                setHasError(true);
            }
        }
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const clickPosition = e.clientX - rect.left;
        const newTime = (clickPosition / rect.width) * duration;
        if (audioRef.current && isFinite(newTime)) audioRef.current.currentTime = newTime;
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;
        const setAudioData = () => { if (isFinite(audio.duration)) setDuration(audio.duration); };
        const setAudioTime = () => setCurrentTime(audio.currentTime);
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onError = () => setHasError(true);

        audio.addEventListener('loadedmetadata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onPause);
        audio.addEventListener('error', onError);

        return () => {
            audio.removeEventListener('loadedmetadata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onPause);
            audio.removeEventListener('error', onError);
        };
    }, []);

    const formatTimeDisplay = (time: number) => {
        if (isNaN(time) || !isFinite(time)) return '0:00';
        const min = Math.floor(time / 60);
        const sec = Math.floor(time % 60);
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };
    
    const progress = duration ? (currentTime / duration) * 100 : 0;
    const playerColorClass = isOwnMessage ? 'text-white' : 'text-slate-600';
    const progressBgClass = isOwnMessage ? 'bg-white/30' : 'bg-slate-200';
    const progressFillClass = isOwnMessage ? 'bg-white' : 'bg-isig-blue';
    const buttonBgClass = isOwnMessage ? 'bg-white/20 hover:bg-white/40' : 'bg-slate-200 hover:bg-slate-300';

    if (hasError) {
        return (
            <div className={`mt-1 p-3 rounded-xl flex items-center justify-between border transition-all ${isOwnMessage ? 'bg-white/10 border-white/20 text-white' : 'bg-red-50 border-red-100 text-red-600'}`}>
                <div className="flex items-center space-x-3">
                    <FileAudio size={24} className={isOwnMessage ? 'text-white' : 'text-red-500'} />
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest">Note vocale</p>
                        <p className="text-[9px] font-medium opacity-80">Format incompatible sur cet iPhone</p>
                    </div>
                </div>
                <a 
                    href={src} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className={`p-2 rounded-lg transition-all active:scale-95 ${isOwnMessage ? 'bg-white/20 hover:bg-white/40 text-white' : 'bg-white text-red-500 shadow-sm border border-red-100'}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Download size={18} />
                </a>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-2 mt-1 w-full max-w-full overflow-hidden ${playerColorClass}`}>
            <audio ref={audioRef} src={src} preload="auto" playsInline></audio>
            <button type="button" onClick={handlePlayPause} className={`p-2.5 rounded-full transition-all shrink-0 ${buttonBgClass}`}>
                {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current" />}
            </button>
            <div className="flex-1 flex flex-col justify-center min-w-0 pr-1">
                <div onClick={handleProgressClick} className={`h-1.5 w-full rounded-full cursor-pointer relative ${progressBgClass}`}>
                    <div style={{ width: `${Math.min(progress, 100)}%` }} className={`h-full rounded-full transition-all duration-100 ${progressFillClass}`}></div>
                </div>
                 <div className="flex justify-between items-center text-[10px] font-mono mt-1 opacity-80">
                    <span>{formatTimeDisplay(currentTime)}</span>
                    <span>{formatTimeDisplay(duration)}</span>
                </div>
            </div>
        </div>
    );
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwnMessage, onSetEditing, onSetReplying, setMessages, onMediaClick }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const modalRoot = document.getElementById('modal-root');
    const time = format(new Date(message.created_at), 'HH:mm', { locale: fr });
    
    const isEdited = message.updated_at && (new Date(message.updated_at).getTime() - new Date(message.created_at).getTime() > 60000);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        if (menuOpen) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [menuOpen]);
    
    const handleDeleteForMe = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(false);
        setMessages(prev => prev.filter(m => m.id !== message.id));
    };
    
    const handleDeleteForEveryone = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setMenuOpen(false);
        const { error } = await supabase.from('messages').delete().eq('id', message.id);
        if (error) alert("Erreur de suppression.");
    };

    const handleReplyAction = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onSetReplying(message);
        setMenuOpen(false);
    };

    const handleEditAction = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onSetEditing(message);
        setMenuOpen(false);
    };

    const handleCopyAction = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (message.content) {
            navigator.clipboard.writeText(message.content);
            alert("Texte copié !");
        }
        setMenuOpen(false);
    };

    const renderContentWithLinks = (text: string) => {
        const urlRegex = /((?:https?:\/\/|www\.)[^\s]+|[a-z0-9.-]+\.(?:com|net|org|edu|ac|cd|io|me|fr|be)[^\s/]*[^\s.,;?!])/gi;
        
        return text.split(urlRegex).map((part, index) => {
            if (part.match(urlRegex)) {
                let href = part;
                if (!href.match(/^https?:\/\//i)) {
                    href = `https://${href}`;
                }
                return (
                    <a 
                        key={index} 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className={`underline break-all transition-colors duration-200 ${isOwnMessage ? 'text-white hover:opacity-80' : 'text-isig-blue hover:text-blue-600'}`} 
                        onClick={e => e.stopPropagation()}
                    >
                        {part}
                    </a>
                );
            }
            return part;
        });
    };

    const renderMedia = () => {
        if (!message.media_url || !message.media_type) return null;
        if (message.media_type.startsWith('image/') || message.media_type === 'image') {
            return (
                <div onClick={() => onMediaClick(message.media_url!, message.media_type!, "image.jpg")} className="mt-1 mb-1 rounded-xl overflow-hidden cursor-pointer max-w-full bg-black/5 transition-transform duration-300 hover:scale-[1.02] active:scale-100">
                    <img src={message.media_url} alt="Média" className="w-full max-h-64 object-contain" />
                </div>
            );
        }
        if (message.media_type.startsWith('audio/')) return <AudioPlayer src={message.media_url} isOwnMessage={isOwnMessage} />;
        return (
             <button type="button" onClick={() => onMediaClick(message.media_url!, message.media_type!, "fichier")} className={`flex items-center w-full space-x-3 p-3 mt-1 rounded-xl text-left transition-all active:scale-[0.98] ${isOwnMessage ? 'bg-black/20 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}>
                <Download size={24} />
                <div className="flex-1 min-w-0">
                    <p className="font-bold truncate text-xs">{message.media_url.split('/').pop()}</p>
                </div>
            </button>
        );
    };

    const OptionsMenuContent = () => (
        <div className="flex flex-col">
            <button 
                type="button" 
                onClick={handleReplyAction} 
                className="w-full text-left flex items-center px-4 py-3 text-sm font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors"
            >
                <MessageSquareReply size={18} className="mr-3 text-isig-blue"/>Répondre
            </button>
            {message.content && (
                <button 
                    type="button" 
                    onClick={handleCopyAction} 
                    className="w-full text-left flex items-center px-4 py-3 text-sm font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors"
                >
                    <Copy size={18} className="mr-3 text-emerald-500"/>Copier
                </button>
            )}
            {isOwnMessage && message.content && (
                <button 
                    type="button" 
                    onClick={handleEditAction} 
                    className="w-full text-left flex items-center px-4 py-3 text-sm font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors"
                >
                    <Pencil size={18} className="mr-3 text-isig-orange"/>Modifier
                </button>
            )}
            <div className="border-t border-slate-100 my-1 mx-2"></div>
            <button 
                type="button" 
                onClick={handleDeleteForMe} 
                className="w-full text-left flex items-center px-4 py-3 text-sm font-black uppercase tracking-widest text-red-600 hover:bg-red-50 transition-colors"
            >
                <XCircle size={18} className="mr-3"/>Supprimer (Moi)
            </button>
            {isOwnMessage && (
                <button 
                    type="button" 
                    onClick={handleDeleteForEveryone} 
                    className="w-full text-left flex items-center px-4 py-3 text-sm font-black uppercase tracking-widest text-red-600 hover:bg-red-50 transition-colors"
                >
                    <Trash2 size={18} className="mr-3"/>Supprimer (Tous)
                </button>
            )}
        </div>
    );

    const MobileOptionsMenu = () => {
        if (!modalRoot) return null;
        return createPortal(
            <div className="fixed inset-0 z-[1000] flex items-end animate-fade-in" onClick={() => setMenuOpen(false)}>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>
                <div className="relative w-full bg-white rounded-t-[2.5rem] p-6 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                    <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-black text-slate-800 uppercase italic">Options</h3>
                        <button type="button" onClick={() => setMenuOpen(false)} className="p-2 bg-slate-100 rounded-full transition-colors active:bg-slate-200">
                            <X size={20}/>
                        </button>
                    </div>
                    <div className="space-y-1">
                        <OptionsMenuContent />
                    </div>
                </div>
            </div>,
            modalRoot
        );
    };

    return (
        <div className={`group flex items-end gap-1 w-full ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
             <div className={`relative self-center ${isOwnMessage ? 'order-1' : 'order-3'}`}>
                <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} 
                    className="p-2 rounded-full text-slate-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-slate-100 active:bg-slate-200"
                >
                    <MoreHorizontal size={18} />
                </button>
                {menuOpen && (
                    <>
                        <div className="hidden md:block">
                            <div 
                                ref={menuRef} 
                                className={`absolute bottom-full mb-2 w-56 bg-white rounded-2xl shadow-premium py-2 z-[60] border border-slate-100 animate-fade-in-up ${isOwnMessage ? 'right-0' : 'left-0'}`}
                            >
                                <OptionsMenuContent />
                            </div>
                        </div>
                        <MobileOptionsMenu />
                    </>
                )}
            </div>
            <div className={`relative max-w-[85%] sm:max-w-md lg:max-w-lg px-4 py-3 rounded-[1.25rem] order-2 shadow-soft overflow-hidden transition-transform duration-300 ${isOwnMessage ? 'bg-isig-blue text-white rounded-br-none' : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'}`}>
                 {message.replied_to && (
                     <div className={`p-3 mb-2 border-l-4 rounded-xl flex flex-col transition-colors ${isOwnMessage ? 'border-white/40 bg-black/10' : 'border-isig-blue/30 bg-slate-50'}`}>
                         <p className={`font-black text-[9px] uppercase tracking-widest mb-0.5 ${isOwnMessage ? 'text-white/80' : 'text-isig-blue'}`}>
                             {message.replied_to.profiles?.full_name || '...'}
                         </p>
                         <p className={`text-xs italic line-clamp-2 ${isOwnMessage ? 'text-white/70' : 'text-slate-500'}`}>
                             {message.replied_to.content || "Média"}
                         </p>
                     </div>
                 )}
                {renderMedia()}
                {message.content && <div className="text-sm font-medium break-words whitespace-pre-wrap leading-relaxed">{renderContentWithLinks(message.content)}</div>}
                <div className="text-right text-[9px] mt-1.5 flex justify-end items-center font-black uppercase tracking-widest opacity-60">
                    {isEdited && <span className="mr-1">modifié</span>}
                    {time}
                    {isOwnMessage && (
                        <CheckCheck size={14} className={`ml-1 transition-colors duration-300 ${message.is_read ? 'text-emerald-300' : 'text-white/50'}`} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;
