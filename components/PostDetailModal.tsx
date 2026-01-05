
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart, MessageCircle, Send, Trash2, Pencil, MoreHorizontal } from 'lucide-react';
import { Post as PostType, Like, Comment as CommentType, Profile } from '../types';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';
import Spinner from './Spinner';
import Avatar from './Avatar';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface PostDetailModalProps {
  post: PostType;
  onClose: () => void;
}

const PostDetailModal: React.FC<PostDetailModalProps> = ({ post, onClose }) => {
  const { session } = useAuth();
  const [likes, setLikes] = useState<Like[]>(post.likes || []);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [replyingTo, setReplyingTo] = useState<CommentType | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  
  // États pour l'édition et la suppression
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [commentMenuOpen, setCommentMenuOpen] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const modalRootRef = useRef(document.getElementById('modal-root'));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleClose = () => {
    setIsAnimatingOut(true);
    setTimeout(onClose, 300);
  };

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 128; // max-h-32 = 8rem = 128px
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';
    }
  };

  const fetchComments = async () => {
      const { data } = await supabase.from('comments').select(`*, profiles(*)`).eq('post_id', post.id).order('created_at', { ascending: true });
      if (data) setComments(data as any);
  }

  useEffect(() => {
    fetchComments();
    if (session?.user) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
            .then(({ data }) => setCurrentUserProfile(data));
    }
  }, [post, session]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
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

  const userHasLiked = likes.some(like => like.user_id === session?.user.id);

  const handleLike = async () => {
    if (!session?.user) return;
    if (userHasLiked) {
      const like = likes.find(l => l.user_id === session.user.id);
      if (like) {
        setLikes(prev => prev.filter(l => l.id !== like.id));
        await supabase.from('likes').delete().eq('id', like.id);
      }
    } else {
      const { data } = await supabase.from('likes').insert({ post_id: post.id, user_id: session.user.id }).select().single();
      if(data) setLikes(prev => [...prev, data]);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = replyingTo ? replyContent : newComment;
    if (!content.trim() || !session?.user) return;
    setIsPostingComment(true);
    const { data } = await supabase.from('comments').insert({ 
        post_id: post.id, 
        user_id: session.user.id, 
        content, 
        parent_comment_id: replyingTo?.id 
    }).select('*, profiles(*)').single();
    if (data) {
        setComments(prev => [...prev, data as any]);
        setNewComment(''); 
        setReplyContent(''); 
        setReplyingTo(null);
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.overflowY = 'hidden';
        }
    }
    setIsPostingComment(false);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ce commentaire ?")) return;
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (!error) {
        setComments(prev => prev.filter(c => c.id !== commentId));
        setCommentMenuOpen(null);
    } else {
        alert("Erreur lors de la suppression: " + error.message);
    }
  };

  const handleEditComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editContent.trim() || !editingCommentId) return;
    const { error } = await supabase.from('comments').update({ content: editContent }).eq('id', editingCommentId);
    if (!error) {
        setComments(prev => prev.map(c => c.id === editingCommentId ? { ...c, content: editContent } : c));
        setEditingCommentId(null);
        setEditContent('');
    } else {
        alert("Erreur lors de la modification: " + error.message);
    }
  };

  const CommentItem: React.FC<{ comment: CommentType, isReply?: boolean }> = ({ comment, isReply }) => (
    <div className={`flex items-start space-x-3 ${isReply ? 'ml-10 mt-3' : 'mt-4 animate-fade-in'}`}>
        <Avatar avatarUrl={comment.profiles.avatar_url} name={comment.profiles.full_name} size="sm" />
        <div className="flex-1 min-w-0">
            <div className="relative group/comment bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="flex justify-between items-start">
                    <p className="font-black text-[10px] text-isig-blue uppercase tracking-widest mb-1">{comment.profiles.full_name}</p>
                    
                    {session?.user.id === comment.user_id && (
                        <div className="relative">
                            <button 
                                onClick={() => setCommentMenuOpen(commentMenuOpen === comment.id ? null : comment.id)} 
                                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                            >
                                <MoreHorizontal size={14} />
                            </button>
                            {commentMenuOpen === comment.id && (
                                <div className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-premium border border-slate-100 py-1 z-20 overflow-hidden">
                                    <button 
                                        onClick={() => { setEditingCommentId(comment.id); setEditContent(comment.content); setCommentMenuOpen(null); }} 
                                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center"
                                    >
                                        <Pencil size={12} className="mr-2 text-isig-blue" /> Modifier
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteComment(comment.id)} 
                                        className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center"
                                    >
                                        <Trash2 size={12} className="mr-2" /> Supprimer
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {editingCommentId === comment.id ? (
                    <form onSubmit={handleEditComment} className="mt-1">
                        <textarea 
                            value={editContent} 
                            onChange={(e) => setEditContent(e.target.value)} 
                            className="w-full bg-white border border-slate-100 rounded-xl p-2 text-sm font-medium outline-none focus:ring-1 focus:ring-isig-blue resize-none min-h-[60px]"
                            autoFocus
                        />
                        <div className="flex space-x-3 mt-2">
                            <button type="submit" className="text-[10px] font-black uppercase text-isig-blue hover:underline">Enregistrer</button>
                            <button type="button" onClick={() => setEditingCommentId(null)} className="text-[10px] font-black uppercase text-slate-400 hover:underline">Annuler</button>
                        </div>
                    </form>
                ) : (
                    <p className="text-sm text-slate-700 font-medium leading-relaxed break-words">{comment.content}</p>
                )}
            </div>
            
            <div className="flex items-center space-x-3 mt-1 ml-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <button onClick={() => setReplyingTo(comment)} className="hover:text-isig-blue transition-colors">Répondre</button>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(comment.created_at), { locale: fr })}</span>
            </div>
            {comment.replies?.map(reply => <CommentItem key={reply.id} comment={reply} isReply />)}
        </div>
    </div>
  );

  if (!modalRootRef.current) return null;

  return createPortal(
    <div className={`fixed inset-0 bg-brand-dark/80 backdrop-blur-md z-[100] flex justify-center items-center p-4 transition-opacity duration-300 ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`} onClick={handleClose}>
      <div ref={modalRef} onClick={e => e.stopPropagation()} className={`bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl flex flex-col h-[90vh] overflow-hidden transition-all duration-300 ${isAnimatingOut ? 'scale-95' : 'scale-100'}`}>
        <div className="flex justify-between items-center p-6 border-b border-slate-50 flex-shrink-0">
            <h2 className="font-black text-xl text-slate-800 tracking-tight italic uppercase">Publication</h2>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full transition-all"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 scroll-smooth">
            <div className="flex items-center space-x-4 mb-6">
                <Avatar avatarUrl={post.profiles.avatar_url} name={post.profiles.full_name} size="lg" />
                <div>
                    <p className="font-extrabold text-slate-800">{post.profiles.full_name}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{post.profiles.major} • {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}</p>
                </div>
            </div>
            <p className="text-slate-700 whitespace-pre-wrap font-medium leading-relaxed mb-6">{post.content}</p>
            {post.media_url && post.media_type === 'image' && (
                <div className="rounded-[2rem] overflow-hidden mb-6 bg-slate-100 border border-slate-100">
                    <img src={post.media_url} alt="Média" className="w-full h-auto max-h-[500px] object-contain mx-auto" />
                </div>
            )}
            <div className="pt-6 space-y-2 border-t border-slate-50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Commentaires ({comments.length})</p>
                {nestedComments.map(comment => <CommentItem key={comment.id} comment={comment} />)}
                {comments.length === 0 && <div className="text-center py-10 opacity-40 italic text-sm font-medium">Aucun commentaire pour le moment.</div>}
            </div>
        </div>

        <div className="border-t border-slate-50 bg-white flex-shrink-0 relative z-10 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.05)]">
            <div className="px-6 py-4 flex items-center space-x-6 border-b border-slate-50">
                <button onClick={handleLike} className={`flex items-center space-x-2 font-black transition-all ${userHasLiked ? 'text-isig-orange' : 'text-slate-400 hover:text-slate-800'}`}>
                    <Heart size={24} fill={userHasLiked ? '#FF8C00' : 'none'}/>
                    <span className="text-sm">{likes.length}</span>
                </button>
                <div className="flex items-center space-x-2 font-black text-slate-400">
                    <MessageCircle size={24} />
                    <span className="text-sm">{comments.length}</span>
                </div>
            </div>
            <div className="p-4 sm:p-6">
                {replyingTo && (
                    <div className="bg-slate-50 p-3 rounded-2xl mb-3 flex items-center justify-between border border-slate-100 animate-fade-in">
                        <p className="text-xs font-bold text-slate-500">Répondre à <span className="text-isig-blue">{replyingTo.profiles.full_name}</span></p>
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
                                const val = e.target.value;
                                if (replyingTo) setReplyContent(val);
                                else setNewComment(val);
                                adjustHeight();
                            }} 
                            className="w-full bg-slate-50 p-4 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none text-sm font-medium transition-all resize-none max-h-32 overflow-y-hidden custom-scrollbar" 
                        />
                    </div>
                    <button type="submit" disabled={isPostingComment || !(replyingTo ? replyContent : newComment).trim()} className="bg-isig-blue text-white w-12 h-12 shrink-0 flex items-center justify-center rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50">
                        {isPostingComment ? <Spinner /> : <Send size={20} />}
                    </button>
                </form>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center mt-2 opacity-60">Restez courtois et respectueux.</p>
            </div>
        </div>
      </div>
    </div>,
    modalRootRef.current
  );
};

export default PostDetailModal;
