
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { Profile } from '../types';
import { Link } from 'react-router-dom';
import Spinner from './Spinner';
import Avatar from './Avatar';
import { UserPlus, UserCheck, Search, X, Users } from 'lucide-react';
import { useAuth } from '../App';

const USERS_PER_PAGE = 10;

const UsersPage: React.FC = () => {
  const { session } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [followingMap, setFollowingMap] = useState<Map<string, boolean>>(new Map());
  
  // Ref pour éviter les doubles déclenchements de recherche
  const searchTimeout = useRef<number | null>(null);

  const fetchUsers = useCallback(async (isInitial = false, currentSearch = search) => {
    if (!session?.user) return;
    
    if (isInitial) setLoading(true);
    else setLoadingMore(true);

    const currentPage = isInitial ? 0 : page + 1;
    const from = currentPage * USERS_PER_PAGE;
    const to = from + USERS_PER_PAGE - 1;

    try {
      // 1. Requête des profils avec pagination et recherche
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .neq('id', session.user.id);

      if (currentSearch.trim()) {
        query = query.ilike('full_name', `%${currentSearch.trim()}%`);
      }

      const { data: usersData, count, error: usersError } = await query
        .order('full_name', { ascending: true })
        .range(from, to);
        
      if (usersError) throw usersError;

      const newUsers = usersData || [];
      
      // 2. Requête des abonnements pour les nouveaux utilisateurs chargés
      const newUserIds = newUsers.map(u => u.id);
      if (newUserIds.length > 0) {
        const { data: followingData } = await supabase
          .from('followers')
          .select('following_id')
          .eq('follower_id', session.user.id)
          .in('following_id', newUserIds);
        
        const newFollowingMap = new Map(followingMap);
        followingData?.forEach(item => newFollowingMap.set(item.following_id, true));
        setFollowingMap(newFollowingMap);
      }

      if (isInitial) {
        setUsers(newUsers);
        setPage(0);
      } else {
        setUsers(prev => [...prev, ...newUsers]);
        setPage(currentPage);
      }

      setHasMore(usersData.length === USERS_PER_PAGE);

    } catch (error: any) {
      console.error("Error fetching users:", error.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [session?.user, page, search, followingMap]);

  // Gérer la recherche avec un délai (debounce)
  useEffect(() => {
    if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
    
    searchTimeout.current = window.setTimeout(() => {
        fetchUsers(true, search);
    }, 500);

    return () => {
        if (searchTimeout.current) window.clearTimeout(searchTimeout.current);
    };
  }, [search]);
  
  const handleToggleFollow = async (targetUserId: string) => {
    if (!session?.user) return;

    const isCurrentlyFollowing = followingMap.get(targetUserId);
    const newMap = new Map(followingMap);
    newMap.set(targetUserId, !isCurrentlyFollowing);
    setFollowingMap(newMap);

    if (isCurrentlyFollowing) {
        await supabase.from('followers').delete().match({ follower_id: session.user.id, following_id: targetUserId });
    } else {
        await supabase.from('followers').insert({ follower_id: session.user.id, following_id: targetUserId });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
        <div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tight italic uppercase">Membres</h1>
          <p className="text-slate-500 font-medium mt-1">Découvrez et collaborez avec vos pairs ({users.length} affichés).</p>
        </div>
        
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher par nom..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-12 py-4 bg-white border border-slate-100 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-isig-blue outline-none transition-all shadow-soft"
          />
          {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
              >
                <X size={18} />
              </button>
          )}
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center mt-20"><Spinner /></div>
      ) : (
        <>
            {users.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {users.map((user, index) => {
                        const isFollowing = followingMap.get(user.id);
                        const majorPromotion = [user.promotion, user.major].filter(Boolean).join(' ');
                        return (
                            <div 
                                key={user.id} 
                                className="group bg-white p-6 rounded-[2rem] shadow-soft border border-slate-50 flex flex-col items-center text-center transition-all hover:shadow-premium hover:-translate-y-2 animate-fade-in-up"
                                style={{ animationDelay: `${(index % 10) * 0.05}s` }}
                            >
                                <Link to={`/profile/${user.id}`} className="relative">
                                    <Avatar avatarUrl={user.avatar_url} name={user.full_name} size="3xl" className="ring-8 ring-slate-50 group-hover:ring-isig-blue/5 transition-all duration-500" />
                                </Link>
                                <h2 className="text-lg font-black text-slate-800 mt-6 tracking-tight line-clamp-1">{user.full_name}</h2>
                                <p className="text-xs text-isig-blue font-black uppercase tracking-widest mt-1 line-clamp-1">{majorPromotion || 'Étudiant ISIG'}</p>
                                
                                <div className="mt-8 flex flex-col gap-2 w-full">
                                    <Link to={`/profile/${user.id}`} className="w-full py-3 px-4 bg-slate-50 text-slate-700 text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-all active:scale-95">
                                        Profil
                                    </Link>
                                    <button
                                        onClick={() => handleToggleFollow(user.id)}
                                        className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 ${isFollowing ? 'bg-isig-blue text-white shadow-lg shadow-isig-blue/20' : 'bg-isig-orange/10 text-isig-orange hover:bg-isig-orange/20'}`}
                                    >
                                        {isFollowing ? <UserCheck size={16} /> : <UserPlus size={16} />}
                                        <span>{isFollowing ? 'Abonné' : 'Suivre'}</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center bg-white p-20 rounded-[3rem] shadow-soft border border-slate-100 mt-10">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-700">Aucun membre trouvé</h3>
                    <p className="text-slate-400 mt-2 font-medium">Réessayez avec un autre nom ou invitez des collègues !</p>
                </div>
            )}

            {hasMore && (
                <div className="mt-12 flex justify-center pb-10">
                    <button
                        onClick={() => fetchUsers(false)}
                        disabled={loadingMore}
                        className="px-10 py-4 bg-white border border-slate-200 text-slate-700 font-black uppercase tracking-widest text-xs rounded-2xl shadow-soft hover:bg-slate-50 hover:border-isig-blue transition-all disabled:opacity-50 flex items-center space-x-3"
                    >
                        {loadingMore ? (
                            <>
                                <Spinner />
                                <span>Chargement...</span>
                            </>
                        ) : (
                            <span>Afficher plus d'étudiants</span>
                        )}
                    </button>
                </div>
            )}
        </>
      )}
    </div>
  );
};

export default UsersPage;
