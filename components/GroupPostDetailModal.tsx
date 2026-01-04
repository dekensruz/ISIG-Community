
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart, MessageCircle, Edit3, Trash2 } from 'lucide-react';
import { GroupPost, GroupPostLike, GroupPostComment, Profile } from '../types';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';
import { Link } from 'react-router-dom';
import Spinner from './Spinner';
import Avatar from './Avatar';

interface GroupPostDetailModalProps {
  postInitial: GroupPost;
  onClose: () => void;
}

const GroupPostDetailModal: React.FC<GroupPostDetailModalProps> = ({ postInitial, onClose }) => {
  const { session } = useAuth();
  const [post, setPost] = useState<GroupPost>(postInitial);
  const [likes, setLikes] = useState<GroupPostLike[]>(postInitial.group_post_likes);
  const [comments, setComments] = useState<GroupPostComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [editingComment, setEditingComment] = useState<GroupPostComment | null>(null);
  const [editingText, setEditingText] = useState('');
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalRootRef = useRef(document.getElementById('modal-root'));

  const handleClose = () => {
    setIsAnimatingOut(true);
    setTimeout(onClose, 300);
  };

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from('group_post_comments')
      .select('*, profiles(*)')
      .eq('group_post_id', postInitial.id)
      .order('created_at', { ascending: true });
    
    if (!error && data) {
      setComments(data as any);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [postInitial.id]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const handleClickOutside = (event: MouseEvent) => {
        if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
            handleClose();
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.body.style.overflow = 'auto';
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const getCurrentUserProfile = async () => {
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        setCurrentUserProfile(data);
      }
    };
    getCurrentUserProfile();
  }, [session]);

  const userHasLiked = likes.some(like => like.user_id === session?.user.id);

  const handleLike = async () => {
    if (!session?.user) return;
    if (userHasLiked) {
      const like = likes.find(l => l.user_id === session.user.id);
      if (like) {
        setLikes(prev => prev.filter(l => l.id !== like.id));
        await supabase.from('group_post_likes').delete().eq('id', like.id);
      }
    } else {
      const { data, error } = await supabase.from('group_post_likes').insert({ group_post_id: post.id, user_id: session.user.id }).select().single();
      if(!error && data) setLikes(prev => [...prev, data]);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !session?.user) return;

    setIsPostingComment(true);
    const content = newComment;
    setNewComment('');

    try {
        const { data, error } = await supabase
          .from('group_post_comments')
          .insert({ 
              group_post_id: post.id, 
              user_id: session.user.id, 
              content: content 
          })
          .select('*, profiles(*)')
          .single();

        if (error) throw error;
        if (data) setComments(prev => [...prev, data as any]);
    } catch (error: any) {
        console.error("Comment error:", error);
        alert("Erreur lors de l'envoi du commentaire. Assurez-vous d'être membre du groupe.");
        setNewComment(content);
    } finally {
        setIsPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setComments(prev => prev.filter(c => c.id !== commentId));
    await supabase.from('group_post_comments').delete().eq('id', commentId);
  };
  
  const handleUpdateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComment || !editingText.trim()) return;
    const { error } = await supabase.from('group_post_comments').update({ content: editingText }).eq('id', editingComment.id);
    if (!error) {
      setComments(prev => prev.map(c => c.id === editingComment.id ? { ...c, content: editingText } : c));
      setEditingComment(null);
      setEditingText('');
    }
  };

  if (!modalRootRef.current) return null;

  return createPortal(
    <div className={`fixed inset-0 bg-black z-50 flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out ${isAnimatingOut ? 'opacity-0' : 'bg-opacity-60'}`}>
      <div
        ref={modalRef}
        className={`bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] relative transition-all duration-300 ease-in-out ${isAnimatingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
      >
        <div className="flex justify-between items-center p-6 sm:p-8 border-b border-slate-50">
            <h2 className="font-black text-xl text-slate-800 tracking-tight">Discussion de groupe</h2>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-800 p-2 hover:bg-slate-100 rounded-full transition-all">
                <X size={24} />
            </button>
        </div>

        <div className="flex-grow overflow-y-auto custom-scrollbar">
            {post.media_url && post.media_type?.startsWith('image/') && (
                <div className="px-6 sm:px-8 pt-4">
                     <img src={post.media_url} alt="Média" className="w-full h-auto max-h-80 object-cover rounded-[1.5rem] bg-slate-100 ring-1 ring-slate-100" />
                </div>
            )}
            <div className="p-6 sm:p-8">
                <p className="text-slate-700 whitespace-pre-wrap font-medium leading-relaxed">{post.content}</p>
                 <div className="flex justify-between items-center text-slate-500 mt-6 pt-4 border-t border-slate-50">
                    <div className="flex items-center space-x-6">
                        <button onClick={handleLike} className={`flex items-center space-x-2 font-black transition-all ${userHasLiked ? 'text-isig-orange' : 'hover:text-slate-800'}`}>
                            <Heart size={22} fill={userHasLiked ? '#FF8C00' : 'none'}/>
                            <span className="text-sm">{likes.length}</span>
                        </button>
                        <div className="flex items-center space-x-2 font-black">
                            <MessageCircle size={22} />
                            <span className="text-sm">{comments.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 sm:px-8 pb-8 space-y-5">
                {comments.map(comment => (
                    <div key={comment.id} className="flex items-start justify-between space-x-3 group/comment animate-fade-in">
                        <div className="flex items-start space-x-3 flex-1">
                            <Link to={`/profile/${comment.profiles.id}`} onClick={handleClose}>
                                <Avatar avatarUrl={comment.profiles.avatar_url} name={comment.profiles.full_name} size="sm" />
                            </Link>
                            <div className="bg-slate-50 p-3 sm:p-4 rounded-3xl flex-1 relative border border-slate-100">
                                <Link to={`/profile/${comment.profiles.id}`} onClick={handleClose} className="font-black text-xs text-isig-blue hover:underline uppercase tracking-widest">{comment.profiles.full_name}</Link>
                                {editingComment?.id === comment.id ? (
                                    <form onSubmit={handleUpdateComment} className="mt-2">
                                        <textarea value={editingText} onChange={e => setEditingText(e.target.value)} className="w-full p-3 border border-slate-200 rounded-2xl text-sm bg-white focus:ring-2 focus:ring-isig-blue outline-none resize-none" autoFocus/>
                                        <div className="flex space-x-2 mt-2">
                                            <button type="submit" className="text-[10px] font-black uppercase tracking-widest bg-isig-blue text-white px-4 py-2 rounded-xl">Sauver</button>
                                            <button type="button" onClick={() => setEditingComment(null)} className="text-[10px] font-black uppercase tracking-widest bg-slate-200 text-slate-600 px-4 py-2 rounded-xl">Annuler</button>
                                        </div>
                                    </form>
                                ) : (
                                    <p className="text-sm text-slate-700 mt-1 leading-relaxed font-medium">{comment.content}</p>
                                )}
                            </div>
                        </div>
                        {session?.user.id === comment.user_id && editingComment?.id !== comment.id && (
                            <div className="flex-shrink-0 flex flex-col space-y-1 items-center self-center opacity-0 group-hover/comment:opacity-100 transition-opacity">
                                <button onClick={() => {setEditingComment(comment); setEditingText(comment.content)}} className="p-2 text-slate-300 hover:text-isig-blue hover:bg-isig-blue/5 rounded-full transition-all"><Edit3 size={14}/></button>
                                <button onClick={() => handleDeleteComment(comment.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"><Trash2 size={14}/></button>
                            </div>
                        )}
                    </div>
                ))}
                {comments.length === 0 && !isPostingComment && (
                    <div className="text-center py-10">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <MessageCircle className="text-slate-200" size={32} />
                        </div>
                        <p className="text-slate-400 font-bold italic text-sm">Soyez le premier à commenter ce post de groupe.</p>
                    </div>
                )}
            </div>
        </div>

        {session && currentUserProfile && (
            <div className="p-6 sm:p-8 border-t border-slate-50 bg-white shrink-0">
                <form onSubmit={handlePostComment} className="flex items-center space-x-3 sm:space-x-4">
                    <Avatar avatarUrl={currentUserProfile.avatar_url} name={currentUserProfile.full_name} size="md" className="shrink-0" />
                    <input
                        type="text"
                        placeholder="Ajouter un commentaire..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1 bg-slate-50 p-4 border border-slate-100 rounded-[1.5rem] focus:outline-none focus:ring-2 focus:ring-isig-blue text-sm font-medium transition-all"
                    />
                    <button type="submit" disabled={isPostingComment || !newComment.trim()} className="bg-isig-blue text-white w-12 h-12 flex items-center justify-center rounded-2xl shadow-lg shadow-isig-blue/20 hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50 shrink-0">
                        {isPostingComment ? <Spinner /> : <Send size={20} className="text-white" />}
                    </button>
                </form>
            </div>
        )}
      </div>
    </div>,
    modalRootRef.current
  );
};

// Simple Send icon
const Send: React.FC<{ size: number, className: string }> = ({ size, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
);

export default GroupPostDetailModal;
