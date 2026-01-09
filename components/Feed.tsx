
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Post as PostType } from '../types';
import CreatePost from './CreatePost';
import PostCard from './Post';
import Spinner from './Spinner';
import { useAuth, useSearchFilter } from '../App';
import { Link } from 'react-router-dom';
import { Search, X, TrendingUp, Clock, Ghost } from 'lucide-react';

let recentCache: PostType[] = [];
let popularCache: PostType[] = [];
let lastFetchTime: number = 0;
const CACHE_EXPIRATION = 1000 * 60 * 5;

const PostSkeleton = () => (
    <div className="bg-white rounded-[2rem] border border-slate-100 p-6 animate-pulse shadow-soft mb-8">
        <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 bg-slate-100 rounded-full"></div>
            <div className="space-y-2">
                <div className="h-4 w-32 bg-slate-100 rounded"></div>
                <div className="h-3 w-20 bg-slate-50 rounded"></div>
            </div>
        </div>
        <div className="h-4 w-full bg-slate-50 rounded mb-4"></div>
        <div className="h-48 w-full bg-slate-100 rounded-[1.5rem]"></div>
    </div>
);

const Feed: React.FC = () => {
  const { session } = useAuth();
  const [sortBy, setSortBy] = useState<'recent' | 'popular'>('recent');
  const [posts, setPosts] = useState<PostType[]>(sortBy === 'recent' ? recentCache : popularCache);
  const [loading, setLoading] = useState(posts.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [editingPost, setEditingPost] = useState<PostType | null>(null);
  const { searchQuery, setSearchQuery } = useSearchFilter();
  
  const loaderRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);
  const POSTS_PER_PAGE = 10;

  const fetchPosts = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current) return;
    
    const currentCache = sortBy === 'recent' ? recentCache : popularCache;
    if (isInitial && currentCache.length > 0 && (Date.now() - lastFetchTime < CACHE_EXPIRATION)) {
        setPosts(currentCache);
        setLoading(false);
        return;
    }

    try {
      isFetchingRef.current = true;
      if (isInitial) setLoading(true);
      else setLoadingMore(true);

      const currentPage = isInitial ? 0 : page + 1;
      const from = currentPage * POSTS_PER_PAGE;
      const to = from + POSTS_PER_PAGE - 1;

      let query = supabase
        .from('posts')
        .select(`*, profiles(*), comments(*, profiles(*)), likes(*)`);

      if (sortBy === 'popular') {
        query = query
          .order('likes_count', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query.range(from, to);
      if (error) throw error;
      
      const newPosts = (data as any) || [];
      
      if (isInitial) {
        setPosts(newPosts);
        if (sortBy === 'recent') recentCache = newPosts;
        else popularCache = newPosts;
        lastFetchTime = Date.now();
        setPage(0);
      } else {
        setPosts(prev => {
            const combined = [...prev, ...newPosts];
            const unique = combined.filter((p, idx, self) => self.findIndex(t => t.id === p.id) === idx);
            if (sortBy === 'recent') recentCache = unique;
            else popularCache = unique;
            return unique;
        });
        setPage(currentPage);
      }
      setHasMore(newPosts.length === POSTS_PER_PAGE);
    } catch (error: any) {
      console.error('Feed loading error:', error.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [page, sortBy]);

  useEffect(() => {
    const currentCache = sortBy === 'recent' ? recentCache : popularCache;
    setPosts(currentCache);
    fetchPosts(true);
  }, [sortBy]);

  useEffect(() => {
    if (!hasMore || loading || loadingMore || searchQuery) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingRef.current) fetchPosts(false);
    }, { threshold: 0.1 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, searchQuery, fetchPosts]);

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter(post => 
      (post.content?.toLowerCase().includes(q)) || 
      (post.profiles?.full_name?.toLowerCase().includes(q))
    );
  }, [posts, searchQuery]);

  return (
    <div className="max-w-3xl mx-auto w-full animate-fade-in">
      <div className="space-y-6">
        <div className="md:hidden mb-4">
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                    type="text" 
                    placeholder="Rechercher étudiant ou post..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 bg-white border border-slate-100 rounded-[1.5rem] text-sm font-bold focus:ring-2 focus:ring-isig-blue outline-none transition-all shadow-soft"
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300">
                        <X size={18} />
                    </button>
                )}
            </div>
        </div>

        {!searchQuery && (
          <div className="flex p-1 bg-slate-200/50 rounded-2xl w-fit mx-auto shadow-sm">
              <button 
                  onClick={() => setSortBy('recent')}
                  className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'recent' ? 'bg-white text-isig-blue shadow-sm' : 'text-slate-500'}`}
              >
                  <Clock size={16} />
                  <span>Récent</span>
              </button>
              <button 
                  onClick={() => setSortBy('popular')}
                  className={`flex items-center space-x-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'popular' ? 'bg-white text-isig-orange shadow-sm' : 'text-slate-500'}`}
              >
                  <TrendingUp size={16} />
                  <span>Populaire</span>
              </button>
          </div>
        )}

        {session ? (
          <CreatePost 
            onPostCreated={(newPost) => {
              if (newPost) {
                setPosts(prev => [newPost, ...prev]);
                recentCache = [newPost, ...recentCache];
              } else fetchPosts(true);
              setEditingPost(null);
            }} 
            editingPost={editingPost}
            onCancelEdit={() => setEditingPost(null)}
          />
        ) : (
            <div className="bg-isig-blue p-8 rounded-[2rem] text-white shadow-xl mb-8 relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-2xl font-black italic">ISIG COMMUNITY</h2>
                    <p className="mt-2 opacity-90 text-lg">Le réseau social exclusif des étudiants de l'ISIG Goma.</p>
                    <Link to="/auth" className="inline-block mt-6 px-8 py-3 bg-white text-isig-blue font-bold rounded-2xl transition-all active:scale-95">Rejoindre</Link>
                </div>
            </div>
        )}

        <div className="space-y-8 pb-10">
          {loading && posts.length === 0 ? (
             <div className="space-y-8">{[1, 2, 3].map(i => <PostSkeleton key={i} />)}</div>
          ) : filteredPosts.length > 0 ? (
            <>
              {filteredPosts.map((post) => (
                <PostCard key={post.id} post={post} onEditRequested={setEditingPost} />
              ))}
              {hasMore && !searchQuery && (
                <div ref={loaderRef} className="h-24 flex items-center justify-center">
                    {loadingMore ? <Spinner /> : <div className="w-1.5 h-1.5 bg-slate-200 rounded-full animate-bounce"></div>}
                </div>
              )}
            </>
          ) : (
            <div className="text-center p-16 bg-white rounded-[2rem] border border-slate-200 shadow-soft">
                <Ghost className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500 font-bold">Aucune publication trouvée.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Feed;
