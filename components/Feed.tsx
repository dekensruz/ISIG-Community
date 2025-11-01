import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Post as PostType } from '../types';
import CreatePost from './CreatePost';
import PostCard from './Post';
import Spinner from './Spinner';
import { useAuth, useSearchFilter } from '../App';
import { Link } from 'react-router-dom';

const LoginPrompt = () => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
            <h2 className="font-bold text-lg text-slate-800">Rejoignez la conversation !</h2>
            <p className="text-slate-600 text-sm">Connectez-vous pour publier, commenter et interagir avec la communauté ISIG.</p>
        </div>
        <Link to="/auth" className="bg-isig-orange hover:bg-orange-600 text-white font-bold py-2 px-6 rounded-lg focus:outline-none focus:shadow-outline transition-colors duration-300 w-full sm:w-auto text-center flex-shrink-0">
            Se connecter / S'inscrire
        </Link>
    </div>
);

const Feed: React.FC = () => {
  const { session } = useAuth();
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State for filtering and searching from context
  const { searchQuery, filterType, sortOrder } = useSearchFilter();

  const fetchPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles(*),
          comments(*, profiles(*)),
          likes(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      if (data) {
        setPosts(data as any);
      }
    } catch (error: any) {
      console.error('Erreur de récupération des posts:', error.message);
    }
  }, []);

  useEffect(() => {
    const initialFetch = async () => {
        setLoading(true);
        await fetchPosts();
        setLoading(false);
    }
    initialFetch();
    
    const postsSubscription = supabase
      .channel('public:posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchPosts();
      })
      .subscribe();

    const commentsSubscription = supabase
      .channel('public:comments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
          fetchPosts();
      })
      .subscribe();

    const likesSubscription = supabase
      .channel('public:likes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, () => {
          fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(postsSubscription);
      supabase.removeChannel(commentsSubscription);
      supabase.removeChannel(likesSubscription);
    };
  }, [fetchPosts]);

  const onPostCreated = () => {
      fetchPosts();
  }

  const filteredAndSortedPosts = useMemo(() => {
    return posts
      .filter(post => {
        // Search filter (content and user name)
        const lowercasedQuery = searchQuery.toLowerCase();
        const matchesSearch = lowercasedQuery === '' ? true : (
            post.content.toLowerCase().includes(lowercasedQuery) ||
            (post.profiles && post.profiles.full_name.toLowerCase().includes(lowercasedQuery))
        );
        
        // Type filter
        let matchesType = true;
        if (filterType !== 'all') {
          if (filterType === 'link') {
              matchesType = /(https?:\/\/[^\s]+)/g.test(post.content);
          } else {
              matchesType = post.media_type === filterType;
          }
        }

        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        // Sort order
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
  }, [posts, searchQuery, filterType, sortOrder]);

  return (
    <div className="max-w-2xl mx-auto">
      {!session && <LoginPrompt />}
      {session && <CreatePost onPostCreated={onPostCreated} />}

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center mt-8">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-6">
             {filteredAndSortedPosts.length > 0 ? (
              filteredAndSortedPosts.map(post => (
                <PostCard key={post.id} post={post} />
              ))
            ) : posts.length > 0 && filteredAndSortedPosts.length === 0 ? (
              <div className="text-center bg-white p-8 rounded-lg shadow-sm border border-slate-200 mt-6">
                  <h3 className="text-2xl font-semibold text-gray-700">Aucun résultat</h3>
                  <p className="text-gray-500 mt-2">Essayez d'ajuster votre recherche ou vos filtres.</p>
              </div>
             ) : (
               <div className="text-center bg-white p-8 rounded-lg shadow-sm border border-slate-200 mt-6">
                  <h3 className="text-2xl font-semibold text-gray-700">Aucune publication pour le moment !</h3>
                  <p className="text-gray-500 mt-2">Soyez le premier à partager quelque chose avec la communauté.</p>
                  {!session && <p className="text-gray-500 mt-4"><Link to="/auth" className="text-isig-blue font-semibold hover:underline">Connectez-vous</Link> pour créer une publication.</p>}
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Feed;