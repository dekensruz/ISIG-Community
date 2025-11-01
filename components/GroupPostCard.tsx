import React, { useState, useEffect, useMemo } from 'react';
import { GroupPost, Profile, GroupPostLike, GroupPostComment } from '../types';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Heart, MessageCircle, Share2, FileText, Trash2, Edit3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import GroupImageModal from './GroupImageModal';
import GroupPostDetailModal from './GroupPostDetailModal';

interface GroupPostCardProps {
  post: GroupPost;
}

const GroupPostCard: React.FC<GroupPostCardProps> = ({ post }) => {
  const { session } = useAuth();
  const [copied, setCopied] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showPostDetailModal, setShowPostDetailModal] = useState(false);

  // Local state for immediate UI updates
  const [likes, setLikes] = useState<GroupPostLike[]>(post.group_post_likes);
  const [comments, setComments] = useState<GroupPostComment[]>(post.group_post_comments);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState<GroupPostComment | null>(null);
  const [editingText, setEditingText] = useState('');

  const renderContentWithLinks = (text: string) => {
    // A regex to find URLs and wrap them in anchor tags
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
    setLikes(post.group_post_likes);
    setComments(post.group_post_comments);
  }, [post.group_post_likes, post.group_post_comments]);

  useEffect(() => {
    if (session?.user) {
      supabase.from('profiles').select('*').eq('id', session.user.id).single()
        .then(({ data }) => setCurrentUserProfile(data));
    }
  }, [session]);

  const sortedComments = useMemo(() =>
    [...comments].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [comments]
  );
  const lastComment = sortedComments.length > 0 ? sortedComments[sortedComments.length - 1] : null;

  const userHasLiked = likes.some(like => like.user_id === session?.user.id);

  const handleLike = async () => {
    if (!session?.user) return;
    
    if (userHasLiked) {
      const like = likes.find(l => l.user_id === session.user.id);
      if (like) {
        setLikes(likes.filter(l => l.id !== like.id));
        await supabase.from('group_post_likes').delete().eq('id', like.id);
      }
    } else {
      const { data } = await supabase.from('group_post_likes').insert({ group_post_id: post.id, user_id: session.user.id }).select().single();
      if(data) setLikes([...likes, data]);
    }
  };

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !session?.user) return;
    
    const content = newComment;
    setNewComment('');

    const { data } = await supabase.from('group_post_comments').insert({ 
      group_post_id: post.id, 
      user_id: session.user.id, 
      content: content 
    }).select('*, profiles(*)').single();

    if (data) setComments([...comments, data as any]);
  };

  const handleDeleteComment = async (commentId: string) => {
    setComments(comments.filter(c => c.id !== commentId));
    await supabase.from('group_post_comments').delete().eq('id', commentId);
  };

  const handleUpdateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComment || !editingText.trim()) return;
    
    const { error } = await supabase.from('group_post_comments').update({ content: editingText }).eq('id', editingComment.id);
    if (!error) {
      setComments(comments.map(c => c.id === editingComment.id ? { ...c, content: editingText } : c));
      setEditingComment(null);
      setEditingText('');
    }
  };

  const handleOpenCommentsFromImage = () => {
    setShowImageModal(false);
    setShowPostDetailModal(true);
  };

  const handleShare = async () => {
    const groupUrl = `${window.location.origin}${window.location.pathname}#/group/${post.group_id}`;
    const shareData = {
      title: `Publication de ${post.profiles.full_name} sur ISIG Community`,
      text: post.content,
      url: groupUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        throw new Error('Web Share API non supportée');
      }
    } catch (err) {
      navigator.clipboard.writeText(groupUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <>
    <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center mb-4">
        <Link to={`/profile/${post.profiles.id}`}>
          <Avatar avatarUrl={post.profiles.avatar_url} name={post.profiles.full_name} size="lg" className="mr-4" />
        </Link>
        <div>
          <Link to={`/profile/${post.profiles.id}`} className="font-bold text-slate-800 hover:underline">{post.profiles.full_name}</Link>
          <p className="text-sm text-slate-500">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}</p>
        </div>
      </div>
      <p className="text-slate-700 whitespace-pre-wrap mb-4">{renderContentWithLinks(post.content)}</p>

      {post.media_url && (
        <div className="mb-4">
          {post.media_type?.startsWith('image/') ? (
            <button onClick={() => setShowImageModal(true)} className="w-full h-auto cursor-pointer focus:outline-none rounded-lg overflow-hidden">
                <img src={post.media_url} alt="Média" className="max-h-96 w-full object-cover" />
            </button>
          ) : (
            <a href={post.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center p-3 bg-slate-100 rounded-lg hover:bg-slate-200">
              <FileText className="text-isig-blue mr-3" />
              <span className="text-slate-800 font-medium">Voir le document</span>
            </a>
          )}
        </div>
      )}

      <div className="flex justify-between items-center text-slate-500 border-t border-slate-200 pt-3">
        <div className="flex items-center space-x-6">
          <button onClick={handleLike} disabled={!session} className={`flex items-center space-x-2 transition-colors ${!session ? 'cursor-not-allowed text-slate-400' : `hover:text-isig-orange ${userHasLiked ? 'text-isig-orange' : ''}`}`}>
            <Heart size={20} fill={userHasLiked ? '#FF8C00' : 'none'}/>
            <span className="text-sm font-semibold">{likes.length}</span>
          </button>
          <button onClick={() => setShowPostDetailModal(true)} className="flex items-center space-x-2 hover:text-isig-blue">
            <MessageCircle size={20} />
            <span className="text-sm font-semibold">{comments.length}</span>
          </button>
          <div className="relative">
            <button onClick={handleShare} className="flex items-center space-x-2 hover:text-isig-blue">
                <Share2 size={20} />
            </button>
            {copied && <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 text-xs bg-slate-800 text-white px-2 py-1 rounded-md">Lien copié !</div>}
          </div>
        </div>
      </div>
      
       <div className="mt-4 pt-4 border-t border-slate-100">
          {sortedComments.length > 1 && <button onClick={() => setShowPostDetailModal(true)} className="text-sm text-slate-500 font-semibold mb-3 hover:underline">Voir les {sortedComments.length} commentaires</button>}
          
          {lastComment && (
            <div className="flex items-start justify-between space-x-3">
              <div className="flex items-start space-x-3 flex-1">
                <Link to={`/profile/${lastComment.profiles.id}`}>
                    <Avatar avatarUrl={lastComment.profiles.avatar_url} name={lastComment.profiles.full_name} size="sm" />
                </Link>
                <div className="bg-slate-100 p-2 rounded-lg flex-1">
                  <Link to={`/profile/${lastComment.profiles.id}`} className="font-bold text-sm text-slate-800 hover:underline">{lastComment.profiles.full_name}</Link>
                   {editingComment?.id === lastComment.id ? (
                      <form onSubmit={handleUpdateComment}>
                        <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} className="w-full p-1 border rounded-md mt-1 text-sm bg-white"></textarea>
                        <div className="flex space-x-2 mt-1">
                            <button type="submit" className="text-xs bg-isig-blue text-white px-2 py-1 rounded">Enregistrer</button>
                            <button type="button" onClick={() => setEditingComment(null)} className="text-xs bg-gray-200 px-2 py-1 rounded">Annuler</button>
                        </div>
                      </form>
                    ) : (
                      <p className="text-sm text-slate-600">{lastComment.content}</p>
                    )}
                </div>
              </div>
              {session?.user.id === lastComment.user_id && editingComment?.id !== lastComment.id && (
                  <div className="flex-shrink-0 flex space-x-2 items-center">
                      <button onClick={() => {setEditingComment(lastComment); setEditingText(lastComment.content)}} className="text-slate-400 hover:text-isig-blue"><Edit3 size={14}/></button>
                      <button onClick={() => handleDeleteComment(lastComment.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={14}/></button>
                  </div>
              )}
            </div>
          )}

          {session ? (
              currentUserProfile ? (
                  <form onSubmit={handleCommentSubmit} className="flex items-center space-x-3 mt-4">
                      <Avatar avatarUrl={currentUserProfile.avatar_url} name={currentUserProfile.full_name} size="sm" />
                      <input
                          type="text"
                          placeholder="Écrire un commentaire..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="w-full bg-slate-100 p-2 border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-isig-blue text-sm"
                      />
                  </form>
              ) : (
                  <div className="flex items-center space-x-3 mt-4">
                      <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse"></div>
                      <div className="h-9 w-full rounded-full bg-slate-100 animate-pulse"></div>
                  </div>
              )
          ) : (
              <div className="mt-4 text-sm text-slate-500">
                  <Link to="/auth" className="text-isig-blue font-semibold hover:underline">Connectez-vous</Link> pour laisser un commentaire.
              </div>
          )}
        </div>
    </div>

    {showImageModal && (
        <GroupImageModal
            post={post}
            onClose={() => setShowImageModal(false)}
            onOpenComments={handleOpenCommentsFromImage}
        />
    )}
    {showPostDetailModal && (
        <GroupPostDetailModal
            postInitial={post}
            onClose={() => setShowPostDetailModal(false)}
        />
    )}
    </>
  );
};

export default GroupPostCard;