
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart, MessageCircle, Send, Trash2, Pencil, MoreHorizontal } from 'lucide-react';
import { Post as PostType, Like, Comment as CommentType, Profile } from '../types';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';
import Spinner from './Spinner';
import Avatar from './Avatar';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link, useNavigate } from 'react-router-dom';

interface PostDetailModalProps {
  post: PostType;
  onClose: () => void;
  onInteractionUpdate?: (likes: Like[], commentCount: number) => void;
}

// Helper pour le rendu des liens
const renderLinks = (text: string, isOwnMessage: boolean) => {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, index) => {
        if (part.match(urlRegex)) {
            return (
                <a key={index} href={part} target="_blank" rel="noopener noreferrer" className={`underline break-all ${isOwnMessage ? 'text-white' : 'text-isig-blue'}`} onClick={e => e.stopPropagation()}>
                    {part}
                </a>
            );
        }
        return part;
    });
};

interface CommentItemProps {
    comment: CommentType;
    isReply?: boolean;
    currentUserId?: string;
    onReply: (comment: CommentType) => void;
    onDelete: (id: string) => void;
    onUpdate: (id: string, content: string) => void;
    onCloseModal: () => void;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, isReply, currentUserId, onReply, onDelete, onUpdate, onCloseModal }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(comment.content);

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onUpdate(comment.id, editContent);
        setIsEditing(false);
    };

    return (
        <div className={`flex items-start space-x-3 ${isReply ? 'ml-10 mt-3' : 'mt-4 animate-fade-in'}`}>
            <Link to={`/profile/${comment.user_id}`} onClick={onCloseModal} className="shrink-0 transition-transform active:scale-90">
                <Avatar avatarUrl={comment.profiles?.avatar_url} name={comment.profiles?.full_name || '...'} size="sm" />
            </Link>
            <div className="flex-1 min-w-0">
                <div className="relative group/comment bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div className="flex justify-between items-start">
                        <Link to={`/profile/${comment.user_id}`} onClick={onCloseModal} className="hover:underline">
                            <p className="font-black text-[10px] text-isig-blue uppercase tracking-widest mb-1">{comment.profiles?.full_name || 'Utilisateur'}</p>
                        </Link>
                        
                        {currentUserId === comment.user_id && (
                            <div className="relative">
                                <button onClick={() => setMenuOpen(!menuOpen)} className="text-slate-400 hover:text-slate-600 transition-colors p-1">
                                    <MoreHorizontal size={14} />
                                </button>
                                {menuOpen && (
                                    <div className="absolute right-0 bottom-full mb-2 w-32 bg-white rounded-xl shadow-premium border border-slate-100 py-1 z-20 overflow-hidden">
                                        <button 
                                            onClick={() => { setIsEditing(true); setMenuOpen(false); }} 
                                            className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center"
                                        >
                                            <Pencil size={12} className="mr-2 text-isig-orange" /> Modifier
                                        </button>
                                        <button 
                                            onClick={() => { onDelete(comment.id); setMenuOpen(false); }} 
                                            className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center"
                                        >
                                            <Trash2 size={12} className="mr-2" /> Supprimer
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {isEditing ? (
                        <form onSubmit={handleEditSubmit} className="mt-1">
                            <textarea 
                                value={editContent} 
                                onChange={(e) => setEditContent(e.target.value)} 
                                className="w-full bg-white border border-slate-100 rounded-xl p-2 text-sm font-medium outline-none focus:ring-1 focus:ring-isig-blue resize-none min-h-[60px]"
                                autoFocus
                            />
                            <div className="flex space-x-3 mt-2">
                                <button type="submit" className="text-[10px] font-black uppercase text-isig-blue hover:underline">Enregistrer</button>
                                <button type="button" onClick={() => setIsEditing(false)} className="text-[10px] font-black uppercase text-slate-400 hover:underline">Annuler</button>
                            </div>
                        </form>
                    ) : (
                        <p className="text-sm text-slate-700 font-medium leading-relaxed break-words">
                            {renderLinks(comment.content, false)}
                        </p>
                    )}
                </div>
                
                <div className="flex items-center space-x-3 mt-1 ml-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                    <button onClick={() => onReply(comment)} className="hover:text-isig-blue transition-colors">Répondre</button>
                    <span>•</span>
                    <span>{formatDistanceToNow(new Date(comment.created_at), { locale: fr })}</span>
                </div>
                {comment.replies?.map(reply => (
                    <CommentItem 
                        key={reply.id} 
                        comment={reply} 
                        isReply 
                        currentUserId={currentUserId}
                        onReply={onReply}
                        onDelete={onDelete}
                        onUpdate={onUpdate}
                        onCloseModal={onCloseModal}
                    />
                ))}
            </div>
        </div>
    );
};

const PostDetailModal: React.FC<PostDetailModalProps> = ({ post, onClose, onInteractionUpdate }) => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [likes, setLikes] = useState<Like[]>(post.likes || []);
  
  // Utilisation de la même logique que PostCard pour l'initialisation précise
  const [likesCount, setLikesCount] = useState(() => {
    const actualArrayCount = post.likes?.length || 0;
    return Math.max(post.likes_count || 0, actualArrayCount);
  });

  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [replyingTo, setReplyingTo] = useState<CommentType | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  
  const modalRef = useRef<HTMLDivElement>(null);
  const modalRootRef = useRef(document.getElementById('modal-root'));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleClose = useCallback(() => {
    setIsAnimatingOut(true);
    setTimeout(onClose, 300);
  }, [onClose]);

  // Synchronisation avec le parent à chaque changement important
  useEffect(() => {
    if (onInteractionUpdate) {
        onInteractionUpdate(likes, comments.length);
    }
  }, [likes, comments.length, onInteractionUpdate]);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '48px';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 120;
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  };

  const fetchComments = async () => {
      const { data } = await supabase.from('comments').select(`*, profiles(*)`).eq('post_id', post.id).order('created_at', { ascending: true });
      if (data) setComments(data as any);
  };

  useEffect(() => {
    fetchComments();
    if (session?.user) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
            .then(({ data }) => setCurrentUserProfile(data));
        
        const commentChannel = supabase
            .channel(`comments-${post.id}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'comments', 
                filter: `post_id=eq.${post.id}` 
            }, () => fetchComments())
            .subscribe();

        return () => { supabase.removeChannel(commentChannel); };
    }
  }, [post.id, session]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const nestedComments = useMemo(() => {
    const commentMap: { [key: string]: CommentType } = {};
    const rootComments: CommentType[] = [];
    comments.forEach(c => { c.replies = []; commentMap[c.id] = c; });
    comments.forEach(c => {
        if (c.parent_comment_id && commentMap[c.parent_comment_id]) commentMap[c.parent_comment_id].replies?.push(c);
        else rootComments.push(c);
    });
    return rootComments;
  }, [comments]);

  const handleLike = async () => {
    if (!session?.user) {
      navigate('/auth?mode=signup');
      return;
    }
    const userHasLiked = likes.some(like => like.user_id === session?.user.id);
    if (userHasLiked) {
      const like = likes.find(l => l.user_id === session.user.id);
      if (like) {
        const newLikes = likes.filter(l => l.id !== like.id);
        setLikes(newLikes);
        setLikesCount(prev => Math.max(0, prev - 1));
        await supabase.from('likes').delete().eq('id', like.id);
      }
    } else {
      const tempId = `temp-${Date.now()}`;
      const tempLike = { id: tempId, post_id: post.id, user_id: session.user.id };
      setLikes(prev => [...prev, tempLike as any]);
      setLikesCount(prev => prev + 1);
      const { data } = await supabase.from('likes').insert({ post_id: post.id, user_id: session.user.id }).select().single();
      if(data) setLikes(prev => prev.map(l => l.id === tempId ? data : l));
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = replyingTo ? replyContent : newComment;
    if (!content.trim() || !session?.user || !currentUserProfile) {
      if(!session?.user) navigate('/auth?mode=signup');
      return;
    }
    setIsPostingComment(true);
    
    try {
        const { data, error } = await supabase.from('comments').insert({ 
            post_id: post.id, 
            user_id: session.user.id, 
            content, 
            parent_comment_id: replyingTo?.id 
        }).select('*, profiles(*)').single();

        if (error) throw error;
        if (data) {
            setComments(prev => [...prev, data as any]);
            setNewComment(''); 
            setReplyContent(''); 
            setReplyingTo(null);
            if (textareaRef.current) textareaRef.current.style.height = '48px';
        }
    } catch (err) {
        console.error("Erreur commentaire:", err);
    } finally {
        setIsPostingComment(false);
    }
  };

  const handleDeleteComment = async (id: string) => {
    if (!window.confirm("Supprimer ce commentaire ?")) return;
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (!error) setComments(prev => prev.filter(c => c.id !== id));
  };

  const handleUpdateComment = async (id: string, content: string) => {
    const { error } = await supabase.from('comments').update({ content }).eq('id', id);
    if (!error) setComments(prev => prev.map(c => c.id === id ? {...c, content} : c));
  };

  if (!modalRootRef.current) return null;

  return createPortal(
    <div className={`fixed inset-0 bg-brand-dark/80 backdrop-blur-md z-[100] flex justify-center items-center p-4 transition-opacity duration-300 ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`} onClick={handleClose}>
      <div onClick={e => e.stopPropagation()} className={`bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl flex flex-col h-[90vh] overflow-hidden transition-all duration-300 ${isAnimatingOut ? 'scale-95' : 'scale-100'}`}>
        <div className="flex justify-between items-center p-6 border-b border-slate-50 flex-shrink-0">
            <h2 className="font-black text-xl text-slate-800 tracking-tight italic uppercase">Publication</h2>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full transition-all"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 scroll-smooth">
            <div className="flex items-center space-x-4 mb-6">
                <Link to={`/profile/${post.profiles.id}`} onClick={handleClose}>
                  <Avatar avatarUrl={post.profiles.avatar_url} name={post.profiles.full_name} size="lg" />
                </Link>
                <div>
                    <Link to={`/profile/${post.profiles.id}`} onClick={handleClose}>
                      <p className="font-extrabold text-slate-800 hover:text-isig-blue transition-colors">{post.profiles.full_name}</p>
                    </Link>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{post.profiles.major} • {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}</p>
                </div>
            </div>
            <p className="text-slate-700 whitespace-pre-wrap font-medium leading-relaxed mb-6">{renderLinks(post.content, false)}</p>
            {post.media_url && post.media_type === 'image' && (
                <div className="rounded-[2rem] overflow-hidden mb-6 bg-slate-100 border border-slate-100">
                    <img src={post.media_url} alt="Média" className="w-full h-auto max-h-[500px] object-contain mx-auto" />
                </div>
            )}
            <div className="pt-6 space-y-2 border-t border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Commentaires ({comments.length})</p>
                {nestedComments.map(comment => (
                    <CommentItem 
                        key={comment.id} 
                        comment={comment} 
                        currentUserId={session?.user.id}
                        onReply={setReplyingTo}
                        onDelete={handleDeleteComment}
                        onUpdate={handleUpdateComment}
                        onCloseModal={handleClose}
                    />
                ))}
                {comments.length === 0 && <div className="text-center py-10 opacity-40 italic text-sm font-medium">Aucun commentaire pour le moment.</div>}
            </div>
        </div>

        <div className="border-t border-slate-50 bg-white flex-shrink-0 relative z-10 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
            <div className="px-6 py-4 flex items-center space-x-6 border-b border-slate-50">
                <button onClick={handleLike} className={`flex items-center space-x-2 font-black transition-all ${likes.some(l => l.user_id === session?.user.id) ? 'text-isig-orange' : 'text-slate-400 hover:text-slate-800'}`}>
                    <Heart size={24} fill={likes.some(l => l.user_id === session?.user.id) ? '#FF8C00' : 'none'}/>
                    <span className="text-sm">{likesCount}</span>
                </button>
                <div className="flex items-center space-x-2 font-black text-slate-400">
                    <MessageCircle size={24} />
                    <span className="text-sm">{comments.length}</span>
                </div>
            </div>
            <div className="p-4 sm:p-6">
                {replyingTo && (
                    <div className="bg-slate-50 p-3 rounded-2xl mb-3 flex items-center justify-between border border-slate-100 animate-fade-in">
                        <p className="text-xs font-bold text-slate-500">Répondre à <span className="text-isig-blue">{replyingTo.profiles?.full_name || '...'}</span></p>
                        <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-red-500"><X size={16}/></button>
                    </div>
                )}
                <form onSubmit={handlePostComment} className="flex items-center space-x-3">
                    <Avatar avatarUrl={currentUserProfile?.avatar_url} name={currentUserProfile?.full_name || ''} size="md" className="shrink-0" />
                    <div className="flex-1 min-w-0 pr-2">
                        <textarea 
                            ref={textareaRef}
                            rows={1}
                            placeholder={replyingTo ? "Écrire une réponse..." : "Ajouter un commentaire..."} 
                            value={replyingTo ? replyContent : newComment} 
                            onChange={(e) => {
                                if (replyingTo) setReplyContent(e.target.value);
                                else setNewComment(e.target.value);
                                adjustHeight();
                            }} 
                            className="w-full bg-slate-50 p-4 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none text-sm font-medium transition-all resize-none max-h-32 overflow-y-hidden" 
                        />
                    </div>
                    <button type="submit" disabled={isPostingComment || !(replyingTo ? replyContent : newComment).trim()} className="bg-isig-blue text-white w-12 h-12 shrink-0 flex items-center justify-center rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50">
                        {isPostingComment ? <Spinner /> : <Send size={20} />}
                    </button>
                </form>
            </div>
        </div>
      </div>
    </div>,
    modalRootRef.current
  );
};

export default PostDetailModal;
