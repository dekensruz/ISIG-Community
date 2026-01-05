
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Post as PostType } from '../types';
import CreatePost from './CreatePost';
import PostCard from './Post';
import Spinner from './Spinner';
import { useAuth, useSearchFilter } from '../App';
import { Link } from 'react-router-dom';

const Feed: React.FC = () => {
  const { session } = useAuth();
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState<PostType | null>(null);
  const { searchQuery, sortOrder } = useSearchFilter();

  const shuffleArray = (array: any[]) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[shuffled[j]]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const fetchPosts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`*, profiles(*), comments(*, profiles(*)), likes(*)`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const allPosts = data as any || [];
      if (allPosts.length > 3) {
        const topThree = allPosts.slice(0, 3);
        const rest = allPosts.slice(3);
        setPosts([...topThree, ...shuffleArray(rest)]);
      } else {
        setPosts(allPosts);
      }
    } catch (error: any) {
      console.error('Feed loading error:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
    const channel = supabase.channel('feed-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, fetchPosts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchPosts]);

  const handleEditRequested = (post: PostType) => {
    setEditingPost(post);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      const q = searchQuery.toLowerCase();
      return post.content.toLowerCase().includes(q) || post.profiles.full_name.toLowerCase().includes(q);
    });
  }, [posts, searchQuery]);

  return (
    <div className="max-w-3xl mx-auto w-full">
      <div className="space-y-6">
        {session ? (
          <CreatePost 
            onPostCreated={() => { fetchPosts(); setEditingPost(null); }} 
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
          {loading ? (
             <div className="flex justify-center py-20"><Spinner /></div>
          ) : filteredPosts.length > 0 ? (
            filteredPosts.map((post, index) => (
              <div 
                key={post.id} 
                className="animate-fade-in-up" 
                style={{ animationDelay: `${Math.min(index * 0.1, 1)}s` }}
              >
                <PostCard post={post} onEditRequested={handleEditRequested} />
              </div>
            ))
          ) : (
            <div className="text-center p-16 bg-white rounded-3xl border border-slate-200 shadow-soft animate-fade-in-up">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"></path></svg>
                </div>
                <p className="text-slate-500 font-bold text-lg">Aucune publication pour le moment.</p>
                <p className="text-slate-400 text-sm mt-1">Soyez le premier à partager quelque chose !</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Feed;
