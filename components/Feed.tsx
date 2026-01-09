
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Post as PostType } from '../types';
import CreatePost from './CreatePost';
import PostCard from './Post';
import Spinner from './Spinner';
import { useAuth, useSearchFilter } from '../App';
import { Link } from 'react-router-dom';
import { Search, X } from 'lucide-react';

const Feed: React.FC = () => {
  const { session } = useAuth();
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
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
    
    try {
      isFetchingRef.current = true;
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const currentPage = isInitial ? 0 : page + 1;
      const from = currentPage * POSTS_PER_PAGE;
      const to = from + POSTS_PER_PAGE - 1;

      const { data, error } = await supabase
        .from('posts')
        .select(`*, profiles(*), comments(*, profiles(*)), likes(*)`)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      
      const newPosts = data as any || [];
      
      if (isInitial) {
        setPosts(newPosts);
        setPage(0);
      } else {
        setPosts(prev => {
            const combined = [...prev, ...newPosts];
            // Déduplication stricte par ID
            const unique = combined.filter((p, idx, self) => 
                self.findIndex(t => t.id === p.id) === idx
            );
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
  }, [page]);

  useEffect(() => {
    fetchPosts(true);

    const channel = supabase
      .channel('feed-realtime-global')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'posts' 
      }, async (payload) => {
        const { data } = await supabase
          .from('posts')
          .select(`*, profiles(*), comments(*, profiles(*)), likes(*)`)
          .eq('id', payload.new.id)
          .single();
        
        if (data) {
          setPosts(prev => {
            if (prev.some(p => p.id === data.id)) return prev;
            return [data as any, ...prev];
          });
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload) => {
        setPosts(prev => prev.filter(p => p.id !== payload.old.id));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, async (payload) => {
        const { data } = await supabase
          .from('posts')
          .select(`*, profiles(*), comments(*, profiles(*)), likes(*)`)
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setPosts(prev => prev.map(p => p.id === data.id ? data as any : p));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!hasMore || loading || loadingMore || searchQuery) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingRef.current) {
        fetchPosts(false);
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, searchQuery, fetchPosts]);

  const handlePostCreated = (newPost?: PostType) => {
    if (newPost) {
        setPosts(prev => {
            if (editingPost) {
                return prev.map(p => p.id === newPost.id ? newPost : p);
            }
            if (prev.some(p => p.id === newPost.id)) return prev;
            return [newPost, ...prev];
        });
        setEditingPost(null);
    } else {
        fetchPosts(true);
        setEditingPost(null);
    }
  };

  const handleEditRequested = (post: PostType) => {
    setEditingPost(post);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts;
    const q = searchQuery.toLowerCase();
    return posts.filter(post => 
      post.content.toLowerCase().includes(q) || 
      post.profiles.full_name.toLowerCase().includes(q)
    );
  }, [posts, searchQuery]);

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="space-y-6">
        <div className="md:hidden mb-4">
            <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-isig-blue transition-colors" size={18} />
                <input 
                    type="text" 
                    placeholder="Rechercher un post, un étudiant..." 
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

        {session ? (
          <CreatePost 
            onPostCreated={handlePostCreated} 
            editingPost={editingPost}
            onCancelEdit={() => setEditingPost(null)}
          />
        ) : (
            <div className="bg-isig-blue p-8 rounded-3xl text-white shadow-xl mb-8 relative overflow-hidden animate-fade-in-up">
                <div className="relative z-10">
                    <h2 className="text-2xl font-black italic">ISIG COMMUNITY</h2>
                    <p className="mt-2 opacity-90 text-lg">Le réseau social exclusif des étudiants de l'ISIG Goma.</p>
                    <Link to="/auth" className="inline-block mt-6 px-8 py-3 bg-white text-isig-blue font-bold rounded-2xl transition-all hover:shadow-lg active:scale-95">Rejoindre maintenant</Link>
                </div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            </div>
        )}

        <div className="space-y-8 pb-10">
          {loading && posts.length === 0 ? (
             <div className="flex justify-center py-20"><Spinner /></div>
          ) : filteredPosts.length > 0 ? (
            <>
              {filteredPosts.map((post, index) => (
                <div 
                  key={post.id} 
                  className="animate-fade-in-up" 
                  style={{ animationDelay: `${Math.min((index % POSTS_PER_PAGE) * 0.05, 0.5)}s` }}
                >
                  <PostCard post={post} onEditRequested={handleEditRequested} />
                </div>
              ))}
              {hasMore && !searchQuery && (
                <div ref={loaderRef} className="h-24 flex items-center justify-center">
                    {loadingMore && <Spinner />}
                </div>
              )}
            </>
          ) : (
            <div className="text-center p-16 bg-white rounded-3xl border border-slate-200 shadow-soft animate-fade-in-up">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg>
                </div>
                <p className="text-slate-500 font-bold text-lg">Aucune publication pour le moment.</p>
                <p className="text-slate-400 text-sm mt-1">Soyez le premier à partager quelque chose !</p>
                {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="mt-4 text-isig-blue font-black uppercase tracking-widest text-xs hover:underline">Effacer la recherche</button>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Feed;
