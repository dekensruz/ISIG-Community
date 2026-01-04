
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart, MessageCircle, Edit3, Trash2, Send } from 'lucide-react';
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
    return () => {
        document.body.style.overflow = 'auto';
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
    const contentText = newComment;
    setNewComment('');

    try {
        const { data, error } = await supabase
          .from('group_post_comments')
          .insert({ 
              group_post_id: post.id, 
              user_id: session.user.id, 
              content: contentText 
          })
          .select('*, profiles(*)')
          .single();

        if (error) throw error;
        if (data) {
            setComments(prev => [...prev, data as any]);
        }
    } catch (error: any) {
        console.error("Comment submission error:", error);
        alert(`Erreur : ${error.message}. Vérifiez que vous êtes bien membre du groupe.`);
        setNewComment(contentText);
    } finally {
        setIsPostingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (window.confirm("Supprimer ce commentaire ?")) {
        setComments(prev => prev.filter(c => c.id !== commentId));
        await supabase.from('group_post_comments').delete().eq('id', commentId);
    }
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
    <div className={`fixed inset-0 bg-black/60 z-[999] flex justify-center items-center p-4 transition-opacity duration-300 ease-in-out ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`} onClick={(e) => e.target === e.currentTarget && handleClose()}>
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

        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 sm:p-8">
            {post.media_url && post.media_type?.startsWith('image/') && (
                <div className="mb-6">
                     <img src={post.media_url} alt="Média" className="w-full h-auto max-h-80 object-cover rounded-[1.5rem] bg-slate-100 ring-1 ring-slate-100 shadow-sm" />
                </div>
            )}
            
            <div className="mb-8">
                <div className="flex items-center mb-4">
                    <Avatar avatarUrl={post.profiles.avatar_url} name={post.profiles.full_name} size="md" className="mr-3" />
                    <div>
                        <p className="font-black text-slate-800 text-sm">{post.profiles.full_name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{post.profiles.major}</p>
                    </div>
                </div>
                <p className="text-slate-700 whitespace-pre-wrap font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl">{post.content}</p>
                
                <div className="flex items-center space-x-6 mt-4 px-2">
                    <button onClick={handleLike} className={`flex items-center space-x-2 font-black transition-all ${userHasLiked ? 'text-isig-orange' : 'text-slate-400 hover:text-slate-800'}`}>
                        <Heart size={20} fill={userHasLiked ? '#FF8C00' : 'none'}/>
                        <span className="text-sm">{likes.length}</span>
                    </button>
                    <div className="flex items-center space-x-2 font-black text-slate-400">
                        <MessageCircle size={20} />
                        <span className="text-sm">{comments.length}</span>
                    </div>
                </div>
            </div>

            <div className="space-y-5 border-t border-slate-50 pt-8">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Commentaires</h3>
                {comments.map(comment => (
                    <div key={comment.id} className="flex items-start justify-between space-x-3 group/comment animate-fade-in">
                        <div className="flex items-start space-x-3 flex-1">
                            <Link to={`/profile/${comment.profiles.id}`} onClick={handleClose}>
                                <Avatar avatarUrl={comment.profiles.avatar_url} name={comment.profiles.full_name} size="sm" />
                            </Link>
                            <div className="bg-slate-50 p-3 sm:p-4 rounded-2xl flex-1 relative border border-slate-100">
                                <Link to={`/profile/${comment.profiles.id}`} onClick={handleClose} className="font-black text-[10px] text-isig-blue hover:underline uppercase tracking-widest">{comment.profiles.full_name}</Link>
                                {editingComment?.id === comment.id ? (
                                    <form onSubmit={handleUpdateComment} className="mt-2">
                                        <textarea value={editingText} onChange={e => setEditingText(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-isig-blue outline-none resize-none" autoFocus/>
                                        <div className="flex space-x-2 mt-2">
                                            <button type="submit" className="text-[9px] font-black uppercase bg-isig-blue text-white px-3 py-1.5 rounded-lg">Sauver</button>
                                            <button type="button" onClick={() => setEditingComment(null)} className="text-[9px] font-black uppercase bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg">Annuler</button>
                                        </div>
                                    </form>
                                ) : (
                                    <p className="text-sm text-slate-700 mt-1 leading-relaxed font-medium">{comment.content}</p>
                                )}
                            </div>
                        </div>
                        {session?.user.id === comment.user_id && editingComment?.id !== comment.id && (
                            <div className="flex-shrink-0 flex flex-col space-y-1 opacity-0 group-hover/comment:opacity-100 transition-opacity">
                                <button onClick={() => {setEditingComment(comment); setEditingText(comment.content)}} className="p-1.5 text-slate-300 hover:text-isig-blue transition-all"><Edit3 size={14}/></button>
                                <button onClick={() => handleDeleteComment(comment.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition-all"><Trash2 size={14}/></button>
                            </div>
                        )}
                    </div>
                ))}
                {comments.length === 0 && !isPostingComment && (
                    <div className="text-center py-10 opacity-50">
                        <p className="text-slate-400 font-bold italic text-sm">Aucun commentaire pour le moment.</p>
                    </div>
                )}
            </div>
        </div>

        {session && currentUserProfile && (
            <div className="p-6 sm:p-8 border-t border-slate-50 bg-white shrink-0">
                <form onSubmit={handlePostComment} className="flex items-center space-x-3">
                    <Avatar avatarUrl={currentUserProfile.avatar_url} name={currentUserProfile.full_name} size="md" className="shrink-0" />
                    <input
                        type="text"
                        placeholder="Répondre au groupe..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="flex-1 bg-slate-50 p-4 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-isig-blue text-sm font-medium transition-all"
                    />
                    <button 
                        type="submit" 
                        disabled={isPostingComment || !newComment.trim()} 
                        className="bg-isig-blue text-white w-12 h-12 flex items-center justify-center rounded-2xl shadow-lg shadow-isig-blue/20 hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50"
                    >
                        {isPostingComment ? <Spinner /> : <Send size={20} />}
                    </button>
                </form>
            </div>
        )}
      </div>
    </div>,
    modalRootRef.current
  );
};

export default GroupPostDetailModal;
