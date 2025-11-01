import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Post as PostType } from '../types';
import CreatePost from './CreatePost';
import PostCard from './Post';
import Spinner from './Spinner';
import { useAuth, useSearchFilter } from '../App';
import { Link } from 'react-router-dom';
import { RotateCw } from 'lucide-react';

const REFRESH_THRESHOLD = 80;
const LOADING_POSITION = 60;

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
  
  const { searchQuery, filterType, sortOrder } = useSearchFilter();

  // State for pull-to-refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullPosition, setPullPosition] = useState(0);
  const startY = useRef<number | null>(null);

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
    // Return a promise to allow chaining .finally()
    return Promise.resolve();
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
        const lowercasedQuery = searchQuery.toLowerCase();
        const matchesSearch = lowercasedQuery === '' ? true : (
            post.content.toLowerCase().includes(lowercasedQuery) ||
            (post.profiles && post.profiles.full_name.toLowerCase().includes(lowercasedQuery))
        );
        
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
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
  }, [posts, searchQuery, filterType, sortOrder]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0 && !isRefreshing) {
        startY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;

    if (diff < 0) return;

    e.preventDefault();

    const newPullPosition = Math.min(Math.pow(diff, 0.85), 150);
    setPullPosition(newPullPosition);
  };

  const handleTouchEnd = () => {
    if (startY.current === null || isRefreshing) return;
    
    startY.current = null;

    if (pullPosition > REFRESH_THRESHOLD) {
        setIsRefreshing(true);
        setPullPosition(LOADING_POSITION);
        fetchPosts().finally(() => {
            setTimeout(() => {
                setIsRefreshing(false);
                setPullPosition(0);
            }, 600);
        });
    } else {
        setPullPosition(0);
    }
  };

  return (
    <div
      className="max-w-2xl mx-auto relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="absolute top-0 left-0 right-0 flex justify-center items-center pointer-events-none"
        style={{
            transform: `translateY(${pullPosition - 50}px)`,
            transition: isRefreshing || startY.current !== null ? 'none' : 'transform 0.3s ease-out',
            opacity: pullPosition / LOADING_POSITION,
        }}
      >
        <div
            className={`p-2 bg-white rounded-full shadow-md flex items-center justify-center transition-transform duration-200 ${isRefreshing ? 'animate-spin' : ''}`}
            style={{ transform: `rotate(${isRefreshing ? 0 : pullPosition * 2.5}deg)` }}
        >
            <RotateCw
                size={24}
                className={`transition-colors ${pullPosition > REFRESH_THRESHOLD ? 'text-isig-blue' : 'text-slate-400'}`}
            />
        </div>
      </div>

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
