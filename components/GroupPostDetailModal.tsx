
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart, MessageCircle, Send, Trash2 } from 'lucide-react';
import { GroupPost, GroupPostLike, GroupPostComment, Profile } from '../types';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';
import { Link } from 'react-router-dom';
import Spinner from './Spinner';
import Avatar from './Avatar';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  
  const [replyingTo, setReplyingTo] = useState<GroupPostComment | null>(null);
  const [replyContent, setReplyContent] = useState('');
  
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const modalRootRef = useRef(document.getElementById('modal-root'));

  const handleClose = () => {
    setIsAnimatingOut(true);
    setTimeout(onClose, 300);
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from('group_post_comments')
      .select('*, profiles(*)')
      .eq('group_post_id', postInitial.id);
    if (data) setComments(data as any);
  };

  useEffect(() => {
    fetchComments();
  }, [postInitial.id]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  useEffect(() => {
    if (session?.user) {
        supabase.from('profiles').select('*').eq('id', session.user.id).single()
            .then(({ data }) => setCurrentUserProfile(data));
    }
  }, [session]);

  const nestedComments = useMemo(() => {
    const commentMap: { [key: string]: GroupPostComment } = {};
    const rootComments: GroupPostComment[] = [];

    comments.forEach(comment => {
        comment.replies = [];
        commentMap[comment.id] = comment;
    });

    comments.forEach(comment => {
        if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
            commentMap[comment.parent_comment_id].replies?.push(comment);
        } else {
            rootComments.push(comment);
        }
    });

    const sortComments = (c: GroupPostComment[]) => c.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    rootComments.forEach(c => { if(c.replies) c.replies = sortComments(c.replies); });
    return sortComments(rootComments);
  }, [comments]);

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
    const contentText = newComment;
    setNewComment('');
    const { data } = await supabase.from('group_post_comments').insert({ group_post_id: post.id, user_id: session.user.id, content: contentText }).select('*, profiles(*)').single();
    if (data) setComments(prev => [...prev, data as any]);
    setIsPostingComment(false);
  };

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !session?.user || !replyingTo) return;
    setIsPostingComment(true);
    const content = replyContent;
    const parentId = replyingTo.id;
    setReplyContent('');
    setReplyingTo(null);
    const { data } = await supabase.from('group_post_comments').insert({ group_post_id: post.id, user_id: session.user.id, content, parent_comment_id: parentId }).select('*, profiles(*)').single();
    if (data) setComments(prev => [...prev, data as any]);
    setIsPostingComment(false);
  };

  const CommentItem: React.FC<{ comment: GroupPostComment, isReply?: boolean }> = ({ comment, isReply }) => (
    <div className={`flex items-start space-x-3 ${isReply ? 'ml-10 mt-3' : 'mt-4 animate-fade-in'}`}>
        <Avatar avatarUrl={comment.profiles.avatar_url} name={comment.profiles.full_name} size="sm" />
        <div className="flex-1 min-w-0">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <p className="font-black text-[10px] text-isig-blue uppercase tracking-widest mb-1">{comment.profiles.full_name}</p>
                <p className="text-sm text-slate-700 font-medium leading-relaxed">{comment.content}</p>
            </div>
            <div className="flex items-center space-x-3 mt-1 ml-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                <button onClick={() => setReplyingTo(comment)} className="hover:text-isig-blue">Répondre</button>
                <span>•</span>
                <span>{formatDistanceToNow(new Date(comment.created_at), { locale: fr })}</span>
            </div>
            {comment.replies?.map(reply => <CommentItem key={reply.id} comment={reply} isReply />)}
        </div>
    </div>
  );

  if (!modalRootRef.current) return null;

  return createPortal(
    <div className={`fixed inset-0 bg-brand-dark/80 backdrop-blur-md z-[999] flex justify-center items-center p-4 transition-opacity duration-300 ${isAnimatingOut ? 'opacity-0' : 'opacity-100'}`} onClick={handleClose}>
      <div
        ref={modalRef}
        onClick={e => e.stopPropagation()}
        className={`bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl flex flex-col h-[90vh] overflow-hidden transition-all duration-300 ${isAnimatingOut ? 'scale-95' : 'scale-100'}`}
      >
        <div className="flex justify-between items-center p-6 border-b border-slate-50">
            <h2 className="font-black text-xl text-slate-800 tracking-tight italic uppercase">Groupe • Post</h2>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-50 rounded-full transition-all"><X size={24} /></button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <div className="flex items-center space-x-4 mb-6">
                <Avatar avatarUrl={post.profiles.avatar_url} name={post.profiles.full_name} size="lg" />
                <div>
                    <p className="font-extrabold text-slate-800">{post.profiles.full_name}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}</p>
                </div>
            </div>

            <p className="text-slate-700 whitespace-pre-wrap font-medium leading-relaxed mb-6">{post.content}</p>
            
            {post.media_url && post.media_type?.startsWith('image/') && (
                <div className="rounded-[2rem] overflow-hidden mb-6 bg-slate-100 border border-slate-100">
                    <img src={post.media_url} alt="Post content" className="w-full h-auto max-h-[500px] object-contain" />
                </div>
            )}

            <div className="flex items-center space-x-6 pb-6 border-b border-slate-50">
                <button onClick={handleLike} className={`flex items-center space-x-2 font-black transition-all ${userHasLiked ? 'text-isig-orange' : 'text-slate-400 hover:text-slate-800'}`}>
                    <Heart size={20} fill={userHasLiked ? '#FF8C00' : 'none'}/>
                    <span className="text-sm">{likes.length}</span>
                </button>
                <div className="flex items-center space-x-2 font-black text-slate-400">
                    <MessageCircle size={20} />
                    <span className="text-sm">{comments.length}</span>
                </div>
            </div>

            <div className="pt-6">
                {nestedComments.map(comment => <CommentItem key={comment.id} comment={comment} />)}
                {comments.length === 0 && <div className="text-center py-10 opacity-40 italic text-sm font-medium">Lancez la discussion !</div>}
            </div>
        </div>

        <div className="p-6 border-t border-slate-50 bg-white">
            {replyingTo && (
                <div className="bg-slate-50 p-3 rounded-2xl mb-3 flex items-center justify-between border border-slate-100 animate-fade-in">
                    <p className="text-xs font-bold text-slate-500">Répondre à <span className="text-isig-blue">{replyingTo.profiles.full_name}</span></p>
                    <button onClick={() => setReplyingTo(null)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={16}/></button>
                </div>
            )}
            <form onSubmit={replyingTo ? handleReplySubmit : handlePostComment} className="flex items-center space-x-3">
                <Avatar avatarUrl={currentUserProfile?.avatar_url} name={currentUserProfile?.full_name || ''} size="md" />
                <input
                    type="text"
                    placeholder={replyingTo ? "Écrire une réponse..." : "Votre commentaire..."}
                    value={replyingTo ? replyContent : newComment}
                    onChange={(e) => replyingTo ? setReplyContent(e.target.value) : setNewComment(e.target.value)}
                    className="flex-1 bg-slate-50 p-4 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none text-sm font-medium transition-all"
                />
                <button type="submit" disabled={isPostingComment || !(replyingTo ? replyContent : newComment).trim()} className="bg-isig-blue text-white w-12 h-12 flex items-center justify-center rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50">
                    {isPostingComment ? <Spinner /> : <Send size={20} />}
                </button>
            </form>
        </div>
      </div>
    </div>,
    modalRootRef.current
  );
};

export default GroupPostDetailModal;
