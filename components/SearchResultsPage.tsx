
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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

const SearchResultsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [results, setResults] = useState<SearchResults>({ users: [], groups: [], posts: [] });
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'users' | 'groups' | 'posts'>('all');

  const fetchResults = useCallback(async () => {
    if (!query) {
        setResults({ users: [], groups: [], posts: [] });
        setLoading(false);
        return;
    }
    setLoading(true);
    try {
      const usersPromise = supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', `%${query}%`)
        .limit(20);

      const groupsPromise = supabase
        .from('groups')
        .select('*, profiles:created_by(*), group_members(count)')
        .ilike('name', `%${query}%`)
        .limit(20);

      const postsPromise = supabase
        .from('posts')
        .select('*, profiles(*), comments(*, profiles(*)), likes(*)')
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(20);

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
        group_members: [], // Reset to avoid carrying heavy data
      }));

      setResults({
        users: users || [],
        groups: groups,
        posts: (posts as any) || [],
      });

    } catch (error: any) {
      console.error('Error fetching search results:', error.message);
      setResults({ users: [], groups: [], posts: [] });
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchResults();
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
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {results.users.map(user => (
                          <Link to={`/profile/${user.id}`} key={user.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4 hover:shadow-md hover:border-isig-blue transition-all">
                            <Avatar avatarUrl={user.avatar_url} name={user.full_name} size="xl" />
                            <div>
                              <h3 className="font-bold text-slate-800">{user.full_name}</h3>
                              <p className="text-sm text-isig-blue">{user.major}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
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