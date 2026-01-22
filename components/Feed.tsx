import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Post as PostType } from '../types';
import CreatePost from './CreatePost';
import PostCard from './Post';
import Spinner from './Spinner';
import { useAuth, useSearchFilter } from '../App';
import { Link } from 'react-router-dom';
import { Search, X, TrendingUp, Clock, Ghost } from 'lucide-react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';

const PostSkeleton = () => (
    <div className="bg-white rounded-[2.5rem] border border-slate-100 p-6 animate-pulse shadow-soft mb-8">
        <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 bg-slate-100 rounded-full"></div>
            <div className="space-y-2">
                <div className="h-4 w-32 bg-slate-100 rounded"></div>
                <div className="h-3 w-20 bg-slate-50 rounded"></div>
            </div>
        </div>
        <div className="space-y-3 mb-6">
            <div className="h-4 w-full bg-slate-50 rounded"></div>
            <div className="h-4 w-5/6 bg-slate-50 rounded"></div>
        </div>
        <div className="h-48 w-full bg-slate-100 rounded-[2rem]"></div>
    </div>
);

const POSTS_PER_PAGE = 10;

const Feed: React.FC = () => {
  const { session } = useAuth();
  const [editingPost, setEditingPost] = useState<PostType | null>(null);
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const { searchQuery, setSearchQuery } = useSearchFilter();
  const queryClient = useQueryClient();
  const { ref, inView } = useInView();

  const fetchPosts = async ({ pageParam = 0 }) => {
    const from = pageParam * POSTS_PER_PAGE;
    const to = from + POSTS_PER_PAGE - 1;

    let queryBuilder = supabase
      .from('posts')
      .select(`*, profiles(*), comments(*, profiles(*)), likes(*)`);

    if (sortBy === 'popular') {
      queryBuilder = queryBuilder
          .order('likes_count', { ascending: false })
          .order('created_at', { ascending: false });
    } else {
      queryBuilder = queryBuilder.order('created_at', { ascending: false });
    }

    const { data, error } = await queryBuilder.range(from, to);
    if (error) throw error;
    return data as PostType[];
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery({
    queryKey: ['posts', sortBy],
    queryFn: fetchPosts,
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
        return lastPage.length === POSTS_PER_PAGE ? allPages.length : undefined;
    },
    staleTime: 1000 * 60 * 2, // 2 minutes avant de revalider
  });

  // Infinite scroll trigger
  useEffect(() => {
    if (inView && hasNextPage) {
        fetchNextPage();
    }
  }, [inView, hasNextPage, fetchNextPage]);

  // Realtime subscription setup
  useEffect(() => {
    const channel = supabase
      .channel('feed-realtime-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        // Invalidate query to trigger refetch in background
        queryClient.invalidateQueries({ queryKey: ['posts'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const handlePostCreated = (newPost?: PostType) => {
    if (newPost) {
        // Optimistic update if needed, or simple invalidation
        setEditingPost(null);
        queryClient.invalidateQueries({ queryKey: ['posts'] });
    } else {
        queryClient.invalidateQueries({ queryKey: ['posts'] });
        setEditingPost(null);
    }
  };

  const handleEditRequested = (post: PostType) => {
    setEditingPost(post);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Flatten pages for rendering
  const allPosts = useMemo(() => {
      return data?.pages.flat() || [];
  }, [data]);

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return allPosts;
    const q = searchQuery.toLowerCase();
    return allPosts.filter(post => 
      post.content.toLowerCase().includes(q) || 
      post.profiles.full_name.toLowerCase().includes(q)
    );
  }, [allPosts, searchQuery]);

  return (
    <div className="max-w-3xl mx-auto w-full transition-all duration-300">
      <div className="space-y-6">
        <div className="md:hidden mb-4 animate-fade-in">
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-isig-blue transition-colors" size={18} />
                <input 
                    type="text" 
                    placeholder="Rechercher étudiant ou post..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 bg-white border border-slate-100 rounded-[1.5rem] text-sm font-bold focus:ring-2 focus:ring-isig-blue outline-none transition-all shadow-soft"
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                        <X size={18} />
                    </button>
                )}
            </div>
        </div>

        {!searchQuery && (
          <div className="flex p-1 bg-slate-200/50 rounded-2xl w-full sm:w-fit mx-auto animate-fade-in-up shadow-sm">
              <button 
                  onClick={() => setSortBy('recent')}
                  className={`flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 active:scale-95 ${sortBy === 'recent' ? 'bg-white text-isig-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                  <Clock size={16} />
                  <span>Récent</span>
              </button>
              <button 
                  onClick={() => setSortBy('popular')}
                  className={`flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 active:scale-95 ${sortBy === 'popular' ? 'bg-white text-isig-orange shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                  <TrendingUp size={16} />
                  <span>Populaire</span>
              </button>
          </div>
        )}

        {session ? (
          <CreatePost 
            onPostCreated={handlePostCreated} 
            editingPost={editingPost}
            onCancelEdit={() => setEditingPost(null)}
          />
        ) : (
            <div className="bg-isig-blue p-8 rounded-[2.5rem] text-white shadow-xl mb-8 relative overflow-hidden animate-fade-in-up">
                <div className="relative z-10">
                    <h2 className="text-2xl font-black italic">ISIG COMMUNITY</h2>
                    <p className="mt-2 opacity-90 text-lg">Le réseau social exclusif des étudiants de l'ISIG Goma.</p>
                    <Link to="/auth" className="inline-block mt-6 px-8 py-3 bg-white text-isig-blue font-bold rounded-2xl transition-all hover:shadow-lg active:scale-95">Rejoindre maintenant</Link>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            </div>
        )}

        <div className="space-y-8 pb-10">
          {status === 'pending' ? (
             <div className="space-y-8">
                {[1, 2, 3].map(i => <PostSkeleton key={i} />)}
             </div>
          ) : status === 'error' ? (
              <div className="text-center p-8 text-red-500 font-bold bg-white rounded-3xl">Erreur de chargement.</div>
          ) : filteredPosts.length > 0 ? (
            <>
              {filteredPosts.map((post, index) => (
                <div 
                  key={post.id} 
                  className="animate-fade-in-up will-change-transform" 
                  style={{ animationDelay: `${Math.min((index % POSTS_PER_PAGE) * 0.05, 0.5)}s` }}
                >
                  <PostCard post={post} onEditRequested={handleEditRequested} />
                </div>
              ))}
              
              {/* Infinite scroll loader */}
              {!searchQuery && (
                  <div ref={ref} className="h-24 flex items-center justify-center">
                    {isFetchingNextPage ? <Spinner /> : hasNextPage ? <div className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-bounce"></div> : null}
                  </div>
              )}
            </>
          ) : (
            <div className="text-center p-16 bg-white rounded-[2.5rem] border border-slate-200 shadow-soft animate-fade-in-up">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Ghost className="w-10 h-10 text-slate-300" />
                </div>
                <p className="text-slate-500 font-bold text-lg">Aucune publication pour le moment.</p>
                <p className="text-slate-400 text-sm mt-1">Soyez le premier à partager quelque chose !</p>
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="mt-4 text-isig-blue font-black uppercase tracking-widest text-xs hover:underline active:scale-95 transition-all">Effacer la recherche</button>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Feed;