
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import Spinner from './Spinner';
import Avatar from './Avatar';
import { UserPlus, UserCheck, Search, X, Users, MessageSquare, LayoutGrid, TrendingUp, Sparkles, Circle } from 'lucide-react';
import { useAuth } from '../App';
import { differenceInMinutes } from 'date-fns';

const USERS_PER_PAGE = 12;

const isUserOnline = (lastSeenAt?: string | null): boolean => {
    if (!lastSeenAt) return false;
    return differenceInMinutes(new Date(), new Date(lastSeenAt)) < 3;
};

const UsersPage: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<Profile[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [followingMap, setFollowingMap] = useState<Map<string, boolean>>(new Map());
  const [sortBy, setSortBy] = useState<'all' | 'online' | 'active' | 'popular'>('all');
  
  const searchTimeout = useRef<number | null>(null);

  const fetchUsers = useCallback(async (isInitial = false, currentSearch = search) => {
    if (!session?.user) return;
    
    if (isInitial) {
      setLoading(true);
      setPage(0);
    } else {
      setLoadingMore(true);
    }

    const currentPage = isInitial ? 0 : page + 1;
    const from = currentPage * USERS_PER_PAGE;
    const to = from + USERS_PER_PAGE - 1;

    try {
      // 1. Déterminer le décompte total pour l'affichage informatif
      let countQuery = supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .neq('id', session.user.id);

      if (currentSearch.trim()) {
        countQuery = countQuery.ilike('full_name', `%${currentSearch.trim()}%`);
      }
      
      if (sortBy === 'online') {
          const threeMinsAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
          countQuery = countQuery.gt('last_seen_at', threeMinsAgo);
      }

      const { count: total } = await countQuery;
      setTotalCount(total);

      // 2. Récupérer les membres avec le tri approprié
      let query = supabase
        .from('profiles')
        .select('*')
        .neq('id', session.user.id);

      if (currentSearch.trim()) {
        query = query.ilike('full_name', `%${currentSearch.trim()}%`);
      }

      // Gestion du tri
      if (sortBy === 'all') {
        // "Tous" triés par date d'inscription
        query = query.order('created_at', { ascending: false });
      } else if (sortBy === 'online') {
        const threeMinsAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        query = query.gt('last_seen_at', threeMinsAgo).order('last_seen_at', { ascending: false });
      } else if (sortBy === 'active') {
        // "Actifs" : Triés par nombre de publications (nécessite le script SQL)
        // @ts-ignore : On suppose que la colonne posts_count existe maintenant
        query = query.order('posts_count', { ascending: false, nullsFirst: false });
      } else if (sortBy === 'popular') {
        // "Populaires" : Triés par nombre d'abonnés (nécessite le script SQL)
        // @ts-ignore : On suppose que la colonne followers_count existe maintenant
        query = query.order('followers_count', { ascending: false, nullsFirst: false });
      }

      const { data: usersData, error: usersError } = await query.range(from, to);
      if (usersError) throw usersError;

      const newUsers = usersData || [];
      
      // Récupérer les statuts de suivi pour les nouveaux utilisateurs
      const newUserIds = newUsers.map(u => u.id);
      if (newUserIds.length > 0) {
        const { data: followingData } = await supabase
          .from('followers')
          .select('following_id')
          .eq('follower_id', session.user.id)
          .in('following_id', newUserIds);
        
        setFollowingMap(prev => {
            const next = new Map(prev);
            followingData?.forEach(item => next.set(item.following_id, true));
            return next;
        });
      }

      if (isInitial) {
        setUsers(newUsers);
      } else {
        setUsers(prev => [...prev, ...newUsers]);
        setPage(currentPage);
      }

      setHasMore(newUsers.length === USERS_PER_PAGE);

    } catch (error: any) {
      console.error("Error fetching users:", error.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [session?.user?.id, page, sortBy, search]);

  useEffect(() => {
    if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
    
    searchTimeout.current = window.setTimeout(() => {
        fetchUsers(true, search);
    }, 400);

    return () => {
        if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
    };
  }, [search, sortBy]); // Ne dépend plus de fetchUsers pour éviter les loops
  
  const handleToggleFollow = async (targetUserId: string) => {
    if (!session?.user) return;

    const isCurrentlyFollowing = followingMap.get(targetUserId);
    setFollowingMap(prev => {
        const next = new Map(prev);
        next.set(targetUserId, !isCurrentlyFollowing);
        return next;
    });

    if (isCurrentlyFollowing) {
        await supabase.from('followers').delete().match({ follower_id: session.user.id, following_id: targetUserId });
    } else {
        await supabase.from('followers').insert({ follower_id: session.user.id, following_id: targetUserId });
    }
  };

  const handleQuickMessage = async (targetUserId: string) => {
    if (!session?.user) return;
    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation', { other_user_id: targetUserId });
      if (!error && data) {
        navigate(`/chat/${data}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6 sm:py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 px-2">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight italic uppercase">Membres</h1>
          <p className="text-slate-500 font-medium text-xs sm:text-sm mt-1 flex items-center">
            {totalCount !== null ? (
                <>{sortBy === 'online' ? 'Étudiants actuellement' : 'Découvrez la communauté'} (<span className="text-isig-blue font-black px-1">{totalCount}</span> {sortBy === 'online' ? 'en ligne' : 'étudiants'})</>
            ) : (
                <>Chargement des membres...</>
            )}
          </p>
        </div>
        
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Rechercher par nom..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-10 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-isig-blue outline-none transition-all shadow-soft"
          />
          {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                <X size={16} />
              </button>
          )}
        </div>
      </div>

      <div className="flex overflow-x-auto no-scrollbar pb-2 mb-10 -mx-2 px-2 animate-fade-in-up">
          <div className="flex p-1 bg-slate-200/50 rounded-2xl w-fit whitespace-nowrap shadow-sm">
            <button 
                onClick={() => setSortBy('all')}
                className={`flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'all' ? 'bg-white text-isig-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <LayoutGrid size={14} />
                <span>Tous</span>
            </button>
            <button 
                onClick={() => setSortBy('online')}
                className={`flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'online' ? 'bg-white text-emerald-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <Circle size={10} fill={sortBy === 'online' ? '#10b981' : 'none'} className={sortBy === 'online' ? 'animate-pulse' : ''} />
                <span>En ligne</span>
            </button>
            <button 
                onClick={() => setSortBy('active')}
                className={`flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'active' ? 'bg-white text-indigo-500 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <Sparkles size={14} />
                <span>Actifs</span>
            </button>
            <button 
                onClick={() => setSortBy('popular')}
                className={`flex items-center justify-center space-x-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sortBy === 'popular' ? 'bg-white text-isig-orange shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <TrendingUp size={14} />
                <span>Populaires</span>
            </button>
          </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center mt-20"><Spinner /></div>
      ) : (
        <>
            {users.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-6 px-1">
                    {users.map((user, index) => {
                        const isFollowing = followingMap.get(user.id);
                        const online = isUserOnline(user.last_seen_at);
                        const majorLabel = user.major || 'Étudiant ISIG';
                        return (
                            <div 
                                key={user.id} 
                                className="group bg-white p-3 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] shadow-soft border border-slate-50 flex flex-col items-center text-center transition-all hover:shadow-premium hover:-translate-y-1.5 animate-fade-in-up relative"
                                style={{ animationDelay: `${(index % 12) * 0.03}s` }}
                            >
                                <button 
                                    onClick={() => handleQuickMessage(user.id)}
                                    className="absolute top-3 right-3 p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-isig-blue hover:text-white transition-all shadow-sm active:scale-90"
                                    title="Message rapide"
                                >
                                    <MessageSquare size={16} />
                                </button>

                                <Link to={`/profile/${user.id}`} className="relative mb-3">
                                    <Avatar 
                                        avatarUrl={user.avatar_url} 
                                        name={user.full_name} 
                                        size="xl" 
                                        isOnline={online}
                                        className="ring-4 ring-slate-50 group-hover:ring-isig-blue/10 transition-all duration-500 sm:w-20 sm:h-20 w-16 h-16" 
                                    />
                                </Link>
                                <h2 className="text-sm font-black text-slate-800 tracking-tight line-clamp-1 w-full">{user.full_name}</h2>
                                <p className="text-[9px] text-isig-blue font-black uppercase tracking-widest mt-0.5 line-clamp-1 opacity-70">
                                    {user.promotion ? `${user.promotion} • ` : ''}{majorLabel}
                                </p>
                                
                                <div className="mt-4 flex flex-col gap-1.5 w-full">
                                    <button
                                        onClick={() => handleToggleFollow(user.id)}
                                        className={`w-full flex items-center justify-center space-x-1.5 py-2 px-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${isFollowing ? 'bg-isig-blue text-white shadow-md shadow-isig-blue/10' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                    >
                                        {isFollowing ? <UserCheck size={12} /> : <UserPlus size={12} />}
                                        <span>{isFollowing ? 'Abonné' : 'Suivre'}</span>
                                    </button>
                                    <Link to={`/profile/${user.id}`} className="w-full py-2 px-2 bg-slate-50/50 text-slate-500 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all text-center">
                                        Profil
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center bg-white p-12 sm:p-20 rounded-[2.5rem] shadow-soft border border-slate-100 mt-6 mx-2">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users size={24} className="text-slate-300" />
                    </div>
                    <h3 className="text-xl font-black text-slate-700">{sortBy === 'online' ? 'Personne en ligne' : 'Aucun membre trouvé'}</h3>
                    <p className="text-slate-400 mt-1 text-sm font-medium">Revenez un peu plus tard.</p>
                </div>
            )}

            {hasMore && users.length > 0 && (
                <div className="mt-10 flex justify-center pb-12">
                    <button
                        onClick={() => fetchUsers(false)}
                        disabled={loadingMore}
                        className="px-8 py-3 bg-white border border-slate-200 text-slate-700 font-black uppercase tracking-widest text-[10px] rounded-2xl shadow-soft hover:bg-slate-50 hover:border-isig-blue transition-all disabled:opacity-50 flex items-center space-x-2"
                    >
                        {loadingMore ? <Spinner /> : <span>Afficher plus</span>}
                    </button>
                </div>
            )}
        </>
      )}
    </div>
  );
};

export default UsersPage;