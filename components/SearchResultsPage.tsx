

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Profile, Group, Post } from '../types';
import Spinner from './Spinner';
import Avatar from './Avatar';
import PostCard from './Post';

type SearchResults = {
  users: Profile[];
  groups: (Group & { member_count: number })[];
  posts: Post[];
};

const PAGE_SIZE = {
    users: 9,
    groups: 9,
    posts: 5
};

const SearchResultsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [results, setResults] = useState<SearchResults>({ users: [], groups: [], posts: [] });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState({ users: false, groups: false, posts: false });
  const [hasMore, setHasMore] = useState({ users: true, groups: true, posts: true });
  const [activeFilter, setActiveFilter] = useState<'all' | 'users' | 'groups' | 'posts'>('all');
  const pageRef = useRef({ users: 1, groups: 1, posts: 1 });

  const fetchResults = useCallback(async (initialLoad = true) => {
    if (!query) {
      setResults({ users: [], groups: [], posts: [] });
      setLoading(false);
      return;
    }

    if (initialLoad) {
      setLoading(true);
      pageRef.current = { users: 1, groups: 1, posts: 1 };
      setResults({ users: [], groups: [], posts: [] });
    }

    try {
      const usersPromise = supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', `%${query}%`)
        .range(0, PAGE_SIZE.users - 1);

      const groupsPromise = supabase
        .from('groups')
        .select('*, profiles:created_by(*), group_members(count)')
        .ilike('name', `%${query}%`)
        .range(0, PAGE_SIZE.groups - 1);

      const postsPromise = supabase
        .from('posts')
        .select('*, profiles(*), comments(*, profiles(*)), likes(*)')
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE.posts - 1);

      const [
        { data: users, error: usersError },
        { data: groupsRaw, error: groupsError },
        { data: posts, error: postsError }
      ] = await Promise.all([usersPromise, groupsPromise, postsPromise]);

      if (usersError) throw usersError;
      if (groupsError) throw groupsError;
      if (postsError) throw postsError;

      const groups = (groupsRaw || []).map((g: any) => ({
        ...g,
        member_count: g.group_members[0]?.count || 0,
        group_members: [],
      }));

      setResults({
        users: users || [],
        groups: groups,
        posts: (posts as any) || [],
      });
      
      setHasMore({
          users: (users || []).length === PAGE_SIZE.users,
          groups: (groups || []).length === PAGE_SIZE.groups,
          posts: (posts || []).length === PAGE_SIZE.posts,
      });

    } catch (error: any) {
      console.error('Error fetching search results:', error.message);
      setResults({ users: [], groups: [], posts: [] });
    } finally {
      if(initialLoad) setLoading(false);
    }
  }, [query]);

  const loadMore = async (type: keyof SearchResults) => {
    if (loadingMore[type] || !hasMore[type] || !query) return;

    setLoadingMore(prev => ({ ...prev, [type]: true }));
    pageRef.current[type]++;
    const currentPage = pageRef.current[type];
    const from = (currentPage - 1) * PAGE_SIZE[type];
    const to = currentPage * PAGE_SIZE[type] - 1;

    try {
        let newData: any[] = [];
        if (type === 'users') {
            const { data, error } = await supabase.from('profiles').select('*').ilike('full_name', `%${query}%`).range(from, to);
            if (error) throw error;
            newData = data || [];
        } else if (type === 'groups') {
            const { data, error } = await supabase.from('groups').select('*, profiles:created_by(*), group_members(count)').ilike('name', `%${query}%`).range(from, to);
            if (error) throw error;
            newData = (data || []).map((g: any) => ({ ...g, member_count: g.group_members[0]?.count || 0, group_members: [] }));
        } else if (type === 'posts') {
            const { data, error } = await supabase.from('posts').select('*, profiles(*), comments(*, profiles(*)), likes(*)').ilike('content', `%${query}%`).order('created_at', { ascending: false }).range(from, to);
            if (error) throw error;
            newData = data || [];
        }
        
        setResults(prev => ({ ...prev, [type]: [...prev[type], ...newData] }));
        setHasMore(prev => ({ ...prev, [type]: newData.length === PAGE_SIZE[type] }));

    } catch (error: any) {
        console.error(`Error loading more ${type}:`, error.message);
    } finally {
        setLoadingMore(prev => ({ ...prev, [type]: false }));
    }
  };


  useEffect(() => {
    fetchResults(true);
  }, [fetchResults]);
  
  const filterButtons = [
    { key: 'all', label: 'Tout' },
    { key: 'users', label: 'Utilisateurs' },
    { key: 'groups', label: 'Groupes' },
    { key: 'posts', label: 'Publications' },
  ];

  const hasResults = useMemo(() => 
    results.users.length > 0 || results.groups.length > 0 || results.posts.length > 0,
    [results]
  );
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-slate-800 mb-2">
        Résultats pour : <span className="text-isig-blue">"{query}"</span>
      </h1>
      
      <div className="flex items-center space-x-2 my-6 border-b">
        {filterButtons.map(btn => (
          <button
            key={btn.key}
            onClick={() => setActiveFilter(btn.key as any)}
            className={`px-4 py-2 font-semibold text-sm rounded-t-lg transition-colors ${
              activeFilter === btn.key 
                ? 'border-b-2 border-isig-blue text-isig-blue bg-isig-blue/10' 
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center mt-12"><Spinner /></div>
      ) : !hasResults ? (
         <div className="text-center bg-white p-8 rounded-lg shadow-sm border border-slate-200 mt-6">
            <h3 className="text-2xl font-semibold text-gray-700">Aucun résultat trouvé</h3>
            <p className="text-gray-500 mt-2">Essayez d'utiliser d'autres mots-clés.</p>
        </div>
      ) : (
        <div className="space-y-8">
            { (activeFilter === 'all' || activeFilter === 'users') && (
                 <section>
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">Utilisateurs ({results.users.length})</h2>
                  {results.users.length > 0 ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {results.users.map(user => {
                            const majorPromotion = [user.promotion, user.major].filter(Boolean).join(' ');
                            return (
                                <Link to={`/profile/${user.id}`} key={user.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4 hover:shadow-md hover:border-isig-blue transition-all">
                                <Avatar avatarUrl={user.avatar_url} name={user.full_name} size="xl" />
                                <div>
                                    <h3 className="font-bold text-slate-800">{user.full_name}</h3>
                                    <p className="text-sm text-isig-blue">{majorPromotion}</p>
                                </div>
                                </Link>
                            );
                            })}
                        </div>
                        {hasMore.users && (
                            <div className="text-center mt-6">
                                <button onClick={() => loadMore('users')} disabled={loadingMore.users} className="bg-isig-blue text-white font-semibold py-2 px-6 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300">
                                    {loadingMore.users ? <Spinner /> : 'Charger plus'}
                                </button>
                            </div>
                        )}
                      </>
                  ) : (
                    <div className="bg-white p-6 rounded-lg border text-center text-slate-500">
                        Aucun utilisateur trouvé.
                    </div>
                  )}
                </section>
            )}

            { (activeFilter === 'all' || activeFilter === 'groups') && (
                <section>
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">Groupes ({results.groups.length})</h2>
                    {results.groups.length > 0 ? (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {results.groups.map(group => (
                                    <Link to={`/group/${group.id}`} key={group.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-isig-blue transition-all">
                                        <div className="flex items-center space-x-4 mb-3">
                                            <Avatar avatarUrl={group.avatar_url} name={group.name} shape="square" size="xl" />
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-800">{group.name}</h3>
                                                <p className="text-sm text-slate-500">{group.member_count} membre(s)</p>
                                            </div>
                                        </div>
                                        <p className="text-slate-600 text-sm line-clamp-2">{group.description}</p>
                                    </Link>
                                ))}
                            </div>
                             {hasMore.groups && (
                                <div className="text-center mt-6">
                                    <button onClick={() => loadMore('groups')} disabled={loadingMore.groups} className="bg-isig-blue text-white font-semibold py-2 px-6 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300">
                                        {loadingMore.groups ? <Spinner /> : 'Charger plus'}
                                    </button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bg-white p-6 rounded-lg border text-center text-slate-500">
                            Aucun groupe trouvé.
                        </div>
                    )}
                </section>
            )}

            { (activeFilter === 'all' || activeFilter === 'posts') && (
                 <section>
                    <h2 className="text-2xl font-bold text-slate-800 mb-4">Publications ({results.posts.length})</h2>
                     {results.posts.length > 0 ? (
                        <div className="space-y-6 max-w-2xl mx-auto">
                            {results.posts.map(post => (
                               <PostCard key={post.id} post={post} />
                            ))}
                             {hasMore.posts && (
                                <div className="text-center mt-6">
                                    <button onClick={() => loadMore('posts')} disabled={loadingMore.posts} className="bg-isig-blue text-white font-semibold py-2 px-6 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300">
                                        {loadingMore.posts ? <Spinner /> : 'Charger plus'}
                                    </button>
                                </div>
                            )}
                        </div>
                     ) : (
                        <div className="bg-white p-6 rounded-lg border text-center text-slate-500">
                            Aucune publication trouvée.
                        </div>
                     )}
                 </section>
            )}

        </div>
      )}
    </div>
  );
};

export default SearchResultsPage;
