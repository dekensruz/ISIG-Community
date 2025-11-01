import React, { useState, useEffect, useMemo } from 'react';
import { Post as PostType, Profile, Like, Comment } from '../types';
import { useAuth } from '../App';
import { supabase } from '../services/supabase';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Heart, MessageCircle, Share2, FileText, Trash2, Edit3, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import SummarizeButton from './SummarizeButton';
import ImageModal from './ImageModal';
import PostDetailModal from './PostDetailModal';
import Avatar from './Avatar';

interface PostProps {
  post: PostType;
}

const PostCard: React.FC<PostProps> = ({ post }) => {
  const { session } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showPostDetailModal, setShowPostDetailModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Local state for immediate UI updates
  const [likes, setLikes] = useState<Like[]>(post.likes);
  const [comments, setComments] = useState<Comment[]>(post.comments);
  
  const [editingComment, setEditingComment] = useState<Comment | null>(null);
  const [editingText, setEditingText] = useState('');
  
  // State for replying
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const [replyContent, setReplyContent] = useState('');

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
    // Update local state if props change (e.g., from real-time subscription)
    setLikes(post.likes);
    setComments(post.comments);
  }, [post.likes, post.comments]);

  useEffect(() => {
    const getCurrentUserProfile = async () => {
      if (!session?.user) {
        setCurrentUserProfile(null);
        return;
      }
      setProfileError(null);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(`*`)
          .eq('id', session.user.id)
          .single();

        if (error) throw error;
        if (data) setCurrentUserProfile(data);

      } catch (error: any) {
        console.error('Erreur de chargement du profil utilisateur:', error);
        setProfileError("Votre profil n'a pas pu être chargé. La page pourrait ne pas fonctionner correctement.");
      }
    };
    getCurrentUserProfile();
  }, [session]);

    const nestedComments = useMemo(() => {
        const commentMap: { [key: string]: Comment } = {};
        const rootComments: Comment[] = [];

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

        const sortComments = (c: Comment[]) => c.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        
        rootComments.forEach(c => {
            if(c.replies) c.replies = sortComments(c.replies);
        });

        return sortComments(rootComments);
    }, [comments]);


  const userHasLiked = likes.some(like => like.user_id === session?.user.id);
  const likeCount = likes.length;

  const handleLike = async () => {
    if (!session?.user) return;
    
    if (userHasLiked) {
      const like = likes.find(l => l.user_id === session.user.id);
      if (like) {
        setLikes(likes.filter(l => l.id !== like.id));
        await supabase.from('likes').delete().eq('id', like.id);
      }
    } else {
      const tempLike: Like = { id: `temp-${Date.now()}`, post_id: post.id, user_id: session.user.id };
      setLikes([...likes, tempLike]);
      await supabase.from('likes').insert({ post_id: post.id, user_id: session.user.id });
    }
  };
  
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !session?.user || !currentUserProfile) return;
    
    const content = newComment;
    setNewComment('');

    const { data, error } = await supabase.from('comments').insert({ 
      post_id: post.id, 
      user_id: session.user.id, 
      content: content 
    }).select('*, profiles(*)').single();

    if (error) {
        console.error("Erreur lors de la publication du commentaire:", error);
        setNewComment(content);
    } else if(data) {
        setComments([...comments, data as any]);
    }
  };
  
  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !session?.user || !replyingTo) return;
    
    const content = replyContent;
    const parentComment = replyingTo; // Conserver la référence au commentaire parent
    
    setReplyContent('');
    setReplyingTo(null);

    const { data, error } = await supabase.from('comments').insert({ 
      post_id: post.id, 
      user_id: session.user.id, 
      content: content,
      parent_comment_id: parentComment.id
    }).select('*, profiles(*)').single();

    if (error) {
        console.error("Erreur lors de la publication de la réponse:", error);
        alert(`Erreur lors de la publication de la réponse : ${error.message}`);
        // Restaurer l'état en cas d'erreur
        setReplyContent(content);
        setReplyingTo(parentComment);
    } else if(data) {
        setComments([...comments, data as any]);
    }
  };


  const handleDeleteComment = async (commentId: string) => {
    const originalComments = comments;
    setComments(comments.filter(c => c.id !== commentId));
    const { error } = await supabase.from('comments').delete().eq('id', commentId);
    if (error) {
        alert("Échec de la suppression du commentaire.");
        setComments(originalComments);
    }
  };

  const handleStartEditing = (comment: Comment) => {
    setEditingComment(comment);
    setEditingText(comment.content);
  };

  const handleCancelEditing = () => {
    setEditingComment(null);
    setEditingText('');
  };

  const handleUpdateComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingComment || !editingText.trim()) return;

    const { error } = await supabase.from('comments').update({ content: editingText }).eq('id', editingComment.id);
    if (error) {
      alert("Échec de la mise à jour du commentaire.");
    } else {
      setComments(comments.map(c => c.id === editingComment.id ? { ...c, content: editingText } : c));
      handleCancelEditing();
    }
  };

  const renderCommentContent = (text: string) => {
    const mentionRegex = /(^|\s)(@[a-zA-Z0-9_]+)/g;
    return text.split(mentionRegex).map((part, index) => {
        if (part.startsWith('@')) {
            return <strong key={index} className="text-isig-blue">{part}</strong>;
        }
        return part;
    });
  };

  const handleOpenCommentsFromImage = () => {
    setShowImageModal(false);
    setShowPostDetailModal(true);
  };
  
  const handleShare = async () => {
    const postUrl = `${window.location.origin}${window.location.pathname}#/post/${post.id}`;
    const shareData = {
      title: `Publication de ${post.profiles.full_name} sur ISIG Community`,
      text: post.content,
      url: postUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        throw new Error('Web Share API non supportée');
      }
    } catch (err) {
      // Fallback to clipboard
      navigator.clipboard.writeText(postUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // Hide message after 2 seconds
      });
    }
  };
  
    const CommentComponent: React.FC<{ comment: Comment, isReply?: boolean }> = ({ comment, isReply }) => (
        <div className={`flex items-start justify-between space-x-3 ${isReply ? 'mt-2' : ''}`}>
            <div className="flex items-start space-x-3 flex-1">
                <Link to={`/profile/${comment.profiles.id}`}>
                    <Avatar avatarUrl={comment.profiles.avatar_url} name={comment.profiles.full_name} size="sm" />
                </Link>
                <div className="flex-1">
                    <div className="bg-slate-100 p-2 rounded-lg">
                        <Link to={`/profile/${comment.profiles.id}`} className="font-bold text-sm text-slate-800 hover:underline">{comment.profiles.full_name}</Link>
                        {editingComment?.id === comment.id ? (
                            <form onSubmit={handleUpdateComment}>
                                <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} className="w-full p-1 border rounded-md mt-1 text-sm bg-white" autoFocus/>
                                <div className="flex space-x-2 mt-1">
                                    <button type="submit" className="text-xs bg-isig-blue text-white px-2 py-1 rounded">Enregistrer</button>
                                    <button type="button" onClick={handleCancelEditing} className="text-xs bg-gray-200 px-2 py-1 rounded">Annuler</button>
                                </div>
                            </form>
                        ) : (
                            <p className="text-sm text-slate-600">{renderCommentContent(comment.content)}</p>
                        )}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-500 mt-1">
                        <button onClick={() => setReplyingTo(comment)} className="hover:underline">Répondre</button>
                        <span>·</span>
                        <p>{formatDistanceToNow(new Date(comment.created_at), { locale: fr })}</p>
                         {session?.user.id === comment.user_id && editingComment?.id !== comment.id && (
                            <>
                                <span>·</span>
                                <button onClick={() => handleStartEditing(comment)} className="hover:underline">Modifier</button>
                            </>
                         )}
                    </div>
                </div>
            </div>
             {session?.user.id === comment.user_id && editingComment?.id !== comment.id && (
                <button onClick={() => handleDeleteComment(comment.id)} className="flex-shrink-0 text-slate-400 hover:text-red-500 p-1"><Trash2 size={14}/></button>
            )}
        </div>
    );

  return (
    <>
      <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center mb-4">
          <Link to={`/profile/${post.profiles.id}`}>
            <Avatar avatarUrl={post.profiles.avatar_url} name={post.profiles.full_name} size="lg" className="mr-4" />
          </Link>
          <div>
            <Link to={`/profile/${post.profiles.id}`} className="font-bold text-slate-800 hover:underline">{post.profiles.full_name}</Link>
            <p className="text-sm text-slate-500">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: fr })}
            </p>
          </div>
        </div>
        <p className="text-slate-700 whitespace-pre-wrap mb-4">{renderContentWithLinks(post.content)}</p>
        
        {post.media_url && (
          <div className="mb-4">
            {post.media_type === 'image' ? (
               <button onClick={() => setShowImageModal(true)} className="w-full h-auto cursor-pointer focus:outline-none rounded-lg overflow-hidden">
                  <img src={post.media_url} alt="Média de la publication" className="rounded-lg max-h-96 w-full object-cover" />
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
              <button
                  onClick={handleLike}
                  disabled={!session}
                  className={`flex items-center space-x-2 transition-colors ${!session ? 'cursor-not-allowed text-slate-400' : `hover:text-isig-orange ${userHasLiked ? 'text-isig-orange' : ''}`}`}
              >
                  <Heart size={20} fill={userHasLiked ? '#FF8C00' : 'none'}/>
                  <span className="text-sm font-semibold">{likeCount}</span>
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
           <div className="flex items-center space-x-2">
              {post.content.length > 200 && <SummarizeButton textToSummarize={post.content} />}
           </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-100">
            {nestedComments.length > 1 && <button onClick={() => setShowPostDetailModal(true)} className="text-sm text-slate-500 font-semibold mb-3 hover:underline">Voir les {comments.length} commentaires</button>}
            
            {nestedComments.slice(0, 1).map(comment => (
                <div key={comment.id}>
                    <CommentComponent comment={comment} />
                    
                    {comment.replies?.map(reply => (
                        <div key={reply.id} className="ml-8 mt-2">
                             <CommentComponent comment={reply} isReply />
                        </div>
                    ))}
                    
                    {replyingTo?.id === comment.id && session && currentUserProfile && (
                        <form onSubmit={handleReplySubmit} className="flex items-center space-x-3 mt-2 ml-10">
                            <Avatar avatarUrl={currentUserProfile.avatar_url} name={currentUserProfile.full_name} size="sm" />
                            <input type="text" placeholder={`Répondre à ${comment.profiles.full_name}...`} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} className="w-full bg-slate-100 p-2 border border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-isig-blue text-sm" autoFocus />
                        </form>
                    )}
                </div>
            ))}
          
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
                  {profileError && 
                    <p className="text-red-500 mb-2 flex items-center text-xs">
                        <AlertCircle size={14} className="mr-2" /> {profileError}
                    </p>
                  }
                  <Link to="/auth" className="text-isig-blue font-semibold hover:underline">Connectez-vous</Link> pour laisser un commentaire.
              </div>
            )}
        </div>
      </div>

      {showImageModal && (
        <ImageModal 
          post={post} 
          onClose={() => setShowImageModal(false)}
          onOpenComments={handleOpenCommentsFromImage}
        />
      )}
      {showPostDetailModal && (
        <PostDetailModal
          post={post}
          onClose={() => setShowPostDetailModal(false)}
        />
      )}
    </>
  );
};

export default PostCard;