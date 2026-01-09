
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../services/supabase';
import { Message } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CheckCheck, MoreHorizontal, MessageSquareReply, Pencil, Trash2, XCircle, Download, Play, Pause, X } from 'lucide-react';

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

    const handlePlayPause = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (audioRef.current) {
            if (isPlaying) audioRef.current.pause();
            else audioRef.current.play();
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
        audio.addEventListener('loadedmetadata', setAudioData);
        audio.addEventListener('timeupdate', setAudioTime);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onPause);
        return () => {
            audio.removeEventListener('loadedmetadata', setAudioData);
            audio.removeEventListener('timeupdate', setAudioTime);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onPause);
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

    return (
        <div className={`flex items-center gap-2 mt-1 w-full max-w-full overflow-hidden ${playerColorClass}`}>
            <audio ref={audioRef} src={src} preload="metadata"></audio>
            <button type="button" onClick={handlePlayPause} className={`p-2 rounded-full transition-colors shrink-0 ${buttonBgClass}`}>
                {isPlaying ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current" />}
            </button>
            <div className="flex-1 flex flex-col justify-center min-w-0 pr-1">
                <div onClick={handleProgressClick} className={`h-1.5 w-full rounded-full cursor-pointer relative ${progressBgClass}`}>
                    <div style={{ width: `${Math.min(progress, 100)}%` }} className={`h-full rounded-full transition-all duration-100 ${progressFillClass}`}></div>
                </div>
                 <div className="text-[10px] font-mono mt-1 self-end opacity-80">
                    {formatTimeDisplay(currentTime)} / {formatTimeDisplay(duration)}
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
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
        };
        if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpen]);
    
    const handleDeleteForMe = (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        setMessages(prev => prev.filter(m => m.id !== message.id));
    };
    
    const handleDeleteForEveryone = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setMenuOpen(false);
        const { error } = await supabase.from('messages').delete().eq('id', message.id);
        if (error) alert("Erreur de suppression.");
    };

    const handleReplyAction = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSetReplying(message);
        setMenuOpen(false);
    };

    const handleEditAction = (e: React.MouseEvent) => {
        e.stopPropagation();
        onSetEditing(message);
        setMenuOpen(false);
    };

    const renderMedia = () => {
        if (!message.media_url || !message.media_type) return null;
        if (message.media_type.startsWith('image/')) {
            return (
                <div onClick={() => onMediaClick(message.media_url!, message.media_type!, "image.jpg")} className="mt-1 mb-1 rounded-xl overflow-hidden cursor-pointer max-w-full bg-black/5">
                    <img src={message.media_url} alt="Média" className="w-full max-h-64 object-contain" />
                </div>
            );
        }
        if (message.media_type.startsWith('audio/')) return <AudioPlayer src={message.media_url} isOwnMessage={isOwnMessage} />;
        return (
             <button type="button" onClick={() => onMediaClick(message.media_url!, message.media_type!, "fichier")} className={`flex items-center w-full space-x-3 p-3 mt-1 rounded-xl text-left ${isOwnMessage ? 'bg-black/20 text-white' : 'bg-slate-100 text-slate-800'}`}>
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
                className="w-full text-left flex items-center px-4 py-4 md:py-2.5 text-sm md:text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors"
            >
                <MessageSquareReply size={18} className="mr-4 md:mr-3 text-isig-blue"/>Répondre
            </button>
            {isOwnMessage && message.content && (
                <button 
                    type="button" 
                    onClick={handleEditAction} 
                    className="w-full text-left flex items-center px-4 py-4 md:py-2.5 text-sm md:text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 transition-colors"
                >
                    <Pencil size={18} className="mr-4 md:mr-3 text-isig-orange"/>Modifier
                </button>
            )}
            <div className="border-t border-slate-100 my-1 mx-2"></div>
            <button 
                type="button" 
                onClick={handleDeleteForMe} 
                className="w-full text-left flex items-center px-4 py-4 md:py-2.5 text-sm md:text-xs font-black uppercase tracking-widest text-red-600 hover:bg-red-50 transition-colors"
            >
                <XCircle size={18} className="mr-4 md:mr-3"/>Supprimer (Moi)
            </button>
            {isOwnMessage && (
                <button 
                    type="button" 
                    onClick={handleDeleteForEveryone} 
                    className="w-full text-left flex items-center px-4 py-4 md:py-2.5 text-sm md:text-xs font-black uppercase tracking-widest text-red-600 hover:bg-red-50 transition-colors"
                >
                    <Trash2 size={18} className="mr-4 md:mr-3"/>Supprimer (Tous)
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
                    onClick={(e) => { e.stopPropagation(); setMenuOpen(true); }} 
                    className="p-2 rounded-full text-slate-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-slate-100 active:bg-slate-100"
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
            <div className={`relative max-w-[85%] sm:max-w-md lg:max-w-lg px-4 py-3 rounded-[1.25rem] order-2 shadow-soft overflow-hidden ${isOwnMessage ? 'bg-isig-blue text-white rounded-br-none' : 'bg-white text-slate-800 rounded-bl-none border border-slate-100'}`}>
                 {message.replied_to && (
                     <div className={`p-3 mb-2 border-l-4 rounded-xl flex flex-col ${isOwnMessage ? 'border-white/40 bg-black/10' : 'border-isig-blue/30 bg-slate-50'}`}>
                         <p className={`font-black text-[9px] uppercase tracking-widest mb-0.5 ${isOwnMessage ? 'text-white/80' : 'text-isig-blue'}`}>
                             {message.replied_to.profiles?.full_name || '...'}
                         </p>
                         <p className={`text-xs italic line-clamp-2 ${isOwnMessage ? 'text-white/70' : 'text-slate-500'}`}>
                             {message.replied_to.content || "Média"}
                         </p>
                     </div>
                 )}
                {renderMedia()}
                {message.content && <p className="text-sm font-medium break-words whitespace-pre-wrap leading-relaxed">{message.content}</p>}
                <div className="text-right text-[9px] mt-1.5 flex justify-end items-center font-black uppercase tracking-widest opacity-60">
                    {isEdited && <span className="mr-1">modifié</span>}
                    {time}
                    {isOwnMessage && (
                        <CheckCheck size={14} className={`ml-1 ${message.is_read ? 'text-isig-orange' : 'text-white/50'}`} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default MessageBubble;
