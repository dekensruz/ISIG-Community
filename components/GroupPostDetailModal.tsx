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
  const [comments, setComments] = useState<GroupPostComment[]>(postInitial.group_post_comments.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
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

  const renderContentWithLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);

    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="text-isig-blue hover:underline break-all">
            {part}
          </a>
        );
      }
      return part;
    });
  };

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
      const { data } = await supabase.from('group_post_likes').insert({ group_post_id: post.id, user_id: session.user.id }).select().single();
      if(data) setLikes(prev => [...prev, data]);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !session?.user) return;

    setIsPostingComment(true);
    const content = newComment;
    setNewComment('');

    const { data } = await supabase
      .from('group_post_comments')
      .insert({ group_post_id: post.id, user_id: session.user.id, content })
      .select('*, profiles(*)')
      .single();

    if (data) setComments(prev => [...prev, data as any]);
    setIsPostingComment(false);
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
        className={`bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] relative transition-all duration-300 ease-in-out ${isAnimatingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
      >
        <div className="flex justify-between items-center p-4 border-b">
            <h2 className="font-bold text-lg text-slate-800">Publication de {post.profiles.full_name}</h2>
            <button onClick={handleClose} className="text-slate-500 hover:text-slate-800"><X size={24} /></button>
        </div>

        <div className="flex-grow overflow-y-auto">
            {post.media_url && post.media_type?.startsWith('image/') && (
                <img src={post.media_url} alt="Média" className="w-full h-auto max-h-96 object-contain bg-slate-100" />
            )}
            <div className="p-4">
                <p className="text-slate-700 whitespace-pre-wrap">{renderContentWithLinks(post.content)}</p>
                 <div className="flex justify-between items-center text-slate-500 mt-4 pt-3 border-t">
                    <div className="flex items-center space-x-6">
                        <button onClick={handleLike} disabled={!session} className={`flex items-center space-x-2 ${!session ? 'cursor-not-allowed' : `hover:text-isig-orange ${userHasLiked ? 'text-isig-orange' : ''}`}`}>
                            <Heart size={20} fill={userHasLiked ? '#FF8C00' : 'none'}/>
                            <span className="text-sm font-semibold">{likes.length}</span>
                        </button>
                        <div className="flex items-center space-x-2">
                            <MessageCircle size={20} />
                            <span className="text-sm font-semibold">{comments.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-4 pb-4 space-y-4">
                {comments.map(comment => (
                    <div key={comment.id} className="flex items-start justify-between space-x-3">
                        <div className="flex items-start space-x-3 flex-1">
                            <Link to={`/profile/${comment.profiles.id}`} onClick={handleClose}>
                                <Avatar avatarUrl={comment.profiles.avatar_url} name={comment.profiles.full_name} size="sm" />
                            </Link>
                            <div className="bg-slate-100 p-2 rounded-lg flex-1">
                                <Link to={`/profile/${comment.profiles.id}`} onClick={handleClose} className="font-bold text-sm text-slate-800 hover:underline">{comment.profiles.full_name}</Link>
                                {editingComment?.id === comment.id ? (
                                    <form onSubmit={handleUpdateComment}>
                                        <textarea value={editingText} onChange={e => setEditingText(e.target.value)} className="w-full p-1 border rounded-md mt-1 text-sm bg-white" autoFocus/>
                                        <div className="flex space-x-2 mt-1">
                                            <button type="submit" className="text-xs bg-isig-blue text-white px-2 py-1 rounded">Enregistrer</button>
                                            <button type="button" onClick={() => setEditingComment(null)} className="text-xs bg-gray-200 px-2 py-1 rounded">Annuler</button>
                                        </div>
                                    </form>
                                ) : (
                                    <p className="text-sm text-slate-600">{comment.content}</p>
                                )}
                            </div>
                        </div>
                        {session?.user.id === comment.user_id && editingComment?.id !== comment.id && (
                            <div className="flex-shrink-0 flex space-x-2 items-center">
                                <button onClick={() => {setEditingComment(comment); setEditingText(comment.content)}} className="text-slate-400 hover:text-isig-blue"><Edit3 size={14}/></button>
                                <button onClick={() => handleDeleteComment(comment.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                            </div>
                        )}
                    </div>
                ))}
                {comments.length === 0 && <p className="text-center text-slate-500 text-sm py-4">Soyez le premier à commenter.</p>}
            </div>
        </div>

        {session && currentUserProfile && (
            <div className="p-4 border-t bg-slate-50">
                <form onSubmit={handlePostComment} className="flex items-center space-x-3">
                    <Avatar avatarUrl={currentUserProfile.avatar_url} name={currentUserProfile.full_name} size="sm" />
                    <input
                        type="text"
                        placeholder="Écrire un commentaire..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="w-full bg-white p-2 border border-slate-300 rounded-full focus:outline-none focus:ring-2 focus:ring-isig-blue text-sm"
                    />
                    <button type="submit" disabled={isPostingComment} className="text-isig-blue font-semibold disabled:text-gray-400">
                        {isPostingComment ? <Spinner /> : 'Envoyer'}
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