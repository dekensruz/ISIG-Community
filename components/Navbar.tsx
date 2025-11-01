import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth, useSearchFilter } from '../App';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Profile } from '../types';
import { User, LogOut, Settings, Search, Filter, X, Users as UsersIcon, FileText, ArrowLeft, Bell } from 'lucide-react';
import Avatar from './Avatar';
import Spinner from './Spinner';


const Navbar: React.FC = () => {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  
  // State for search and filter UI in Navbar
  const [isSearchOpenOnFeed, setIsSearchOpenOnFeed] = useState(false);
  const [areFiltersOpen, setAreFiltersOpen] = useState(false);

  const { searchQuery, setSearchQuery, filterType, setFilterType, sortOrder, setSortOrder, isSearchActive, setIsSearchActive } = useSearchFilter();
  
  // State for notifications
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  
  type Suggestion = {
      id: string;
      primaryText: string;
      secondaryText: string;
      type: 'user' | 'group' | 'post';
      avatar_url?: string | null;
      avatarName: string;
  };

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);


  const dropdownRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);

  const isFeedPage = location.pathname === '/';
  
  useEffect(() => {
    if (!location.pathname.startsWith('/search') && !location.pathname.startsWith('/profile/') && !location.pathname.startsWith('/group/') && !location.pathname.startsWith('/post/')) {
      setIsSearchActive(false);
    }
    setAreFiltersOpen(false);
    setDropdownOpen(false);
    setShowSuggestions(false);
    setIsSearchOpenOnFeed(false);
  }, [location.pathname, setIsSearchActive]);


  useEffect(() => {
    const handler = setTimeout(async () => {
        if (searchQuery.trim().length > 1 && showSuggestions) {
            setSuggestionsLoading(true);
            const { data: usersData } = await supabase.from('profiles').select('id, full_name, avatar_url').ilike('full_name', `%${searchQuery}%`).limit(3);
            const { data: groupsData } = await supabase.from('groups').select('id, name, avatar_url').ilike('name', `%${searchQuery}%`).limit(3);
            const { data: postsData } = await supabase.from('posts').select('id, content, profiles(full_name, avatar_url)').ilike('content', `%${searchQuery}%`).limit(2);

            const userSuggestions: Suggestion[] = (usersData || []).map(u => ({ id: u.id, primaryText: u.full_name, secondaryText: 'Utilisateur', type: 'user', avatar_url: u.avatar_url, avatarName: u.full_name }));
            const groupSuggestions: Suggestion[] = (groupsData || []).map(g => ({ id: g.id, primaryText: g.name, secondaryText: 'Groupe', type: 'group', avatar_url: g.avatar_url, avatarName: g.name }));
            const postSuggestions: Suggestion[] = (postsData || []).map((p: any) => ({ id: p.id, primaryText: p.content, secondaryText: `Post par ${p.profiles.full_name}`, type: 'post', avatar_url: p.profiles.avatar_url, avatarName: p.profiles.full_name }));

            setSuggestions([...userSuggestions, ...groupSuggestions, ...postSuggestions]);
            setSuggestionsLoading(false);
        } else {
            setSuggestions([]);
        }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, showSuggestions]);


  useEffect(() => {
    if (session?.user) getProfile();
    else setProfile(null);
  }, [session]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (dropdownRef.current && !dropdownRef.current.contains(target)) setDropdownOpen(false);
        if (filterRef.current && !filterRef.current.contains(target)) setAreFiltersOpen(false);

        const clickedOnSearchToggle = searchToggleRef.current?.contains(target);
        const clickedInsideSearchContainer = searchContainerRef.current?.contains(target);

        if (!clickedOnSearchToggle && !clickedInsideSearchContainer) {
            setShowSuggestions(false);
            if (isFeedPage && !isSearchActive) setIsSearchOpenOnFeed(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFeedPage, isSearchActive]);

  useEffect(() => {
    if (isSearchOpenOnFeed || isSearchActive) {
        searchInputRef.current?.focus();
    }
  }, [isSearchOpenOnFeed, isSearchActive]);
  
  useEffect(() => {
    if (!session?.user) {
        setUnreadNotificationsCount(0);
        return;
    }

    const fetchUnreadCount = async () => {
        const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id)
            .eq('is_read', false);
        
        if (error) {
            console.error("Error fetching notifications count:", error.message);
        } else {
            setUnreadNotificationsCount(count || 0);
        }
    };


    fetchUnreadCount();

    const channel = supabase
        .channel(`public:notifications:navbar:${session.user.id}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${session.user.id}`
        }, () => {
            fetchUnreadCount();
        })
        .subscribe();

    return () => {
        supabase.removeChannel(channel);
    };
  }, [session]);


  const getProfile = async () => {
    if (!session?.user) return;
    try {
      const { data, error } = await supabase.from('profiles').select(`*`).eq('id', session.user.id).single();
      if (error && error.code !== 'PGRST116') throw error;
      if (data) setProfile(data);
    } catch (error: any) {
      console.error('Erreur de chargement du profil:', error.message);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };
  
    const handleSuggestionClick = () => {
        setShowSuggestions(false);
        setIsSearchActive(true);
        setSuggestions([]);
    };

    const handleSearchSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (searchQuery.trim()) {
            setShowSuggestions(false);
            setIsSearchActive(true);
            setSuggestions([]);
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };
    
    const handleBack = () => {
        setIsSearchActive(false);
        setSearchQuery('');
        navigate(-1);
    };

    const renderHighlightedText = (text: string, highlight: string) => {
        if (!text) return '';
        const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
        return (<span>{parts.map((part, i) => part.toLowerCase() === highlight.toLowerCase() ? <strong key={i}>{part}</strong> : part)}</span>);
    };
    
    const getSuggestionIcon = (type: Suggestion['type']) => {
        switch (type) {
            case 'user': return <User size={12} className="mr-1"/>;
            case 'group': return <UsersIcon size={12} className="mr-1"/>;
            case 'post': return <FileText size={12} className="mr-1"/>;
        }
    };
  
  const displaySearch = isSearchActive || (isFeedPage && isSearchOpenOnFeed);

  return (
    <>
      <nav className="bg-white/80 backdrop-blur-lg shadow-sm fixed w-full z-20 top-0 border-b border-slate-200">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-3 gap-4">
            
            {isSearchActive && (
                <button onClick={handleBack} className="p-2 rounded-full hover:bg-slate-100 text-slate-600 flex-shrink-0">
                    <ArrowLeft size={24} />
                </button>
            )}

            {!displaySearch && (
                <Link to="/" className="text-2xl font-bold text-isig-blue">
                    ISIG Community
                </Link>
            )}

            {displaySearch && (
                <div className="relative flex-grow" ref={searchContainerRef}>
                    <form onSubmit={handleSearchSubmit} className="relative">
                        <input
                            ref={searchInputRef}
                            type="search"
                            placeholder="Rechercher utilisateurs, groupes, posts..."
                            value={searchQuery}
                            onChange={e => {
                                setSearchQuery(e.target.value);
                                setShowSuggestions(true);
                            }}
                             onFocus={() => {
                                if (searchQuery.trim().length > 1) {
                                    setShowSuggestions(true);
                                }
                            }}
                            className="w-full bg-slate-100 border-transparent rounded-lg pl-4 pr-12 py-2 focus:outline-none focus:ring-2 focus:ring-isig-blue"
                        />
                        <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full text-slate-500 hover:bg-slate-200 hover:text-isig-blue">
                            <Search size={20} />
                        </button>
                    </form>
                    {showSuggestions && searchQuery.length > 1 && (
                        <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-slate-200 z-30 max-h-80 overflow-y-auto">
                            {suggestionsLoading ? <div className="p-4 flex justify-center"><Spinner /></div>
                            : suggestions.length > 0 ? (<ul>
                                {suggestions.map(suggestion => (
                                    <li key={`${suggestion.type}-${suggestion.id}`}>
                                        <Link to={suggestion.type === 'user' ? `/profile/${suggestion.id}` : suggestion.type === 'group' ? `/group/${suggestion.id}` : `/post/${suggestion.id}`} onClick={handleSuggestionClick} className="flex items-center p-3 hover:bg-slate-100">
                                            <Avatar avatarUrl={suggestion.avatar_url} name={suggestion.avatarName} shape={suggestion.type === 'group' ? 'square' : 'circle'} size="md" className="mr-3 flex-shrink-0"/>
                                            <div className="flex flex-col overflow-hidden">
                                                <span className={`text-slate-700 ${suggestion.type === 'post' ? 'truncate' : ''}`}>{renderHighlightedText(suggestion.primaryText, searchQuery)}</span>
                                                <span className="text-xs text-slate-500 flex items-center">{getSuggestionIcon(suggestion.type)}{suggestion.secondaryText}</span>
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>) : (<p className="p-4 text-slate-500 text-center">Aucun résultat trouvé.</p>)}
                        </div>
                    )}
                </div>
            )}

            <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                 {!isSearchActive && isFeedPage && (
                    <>
                        <button ref={searchToggleRef} onClick={() => { setIsSearchOpenOnFeed(!isSearchOpenOnFeed); if (isSearchOpenOnFeed) setSearchQuery(''); }} className="p-2 rounded-full hover:bg-slate-100 text-slate-600">
                           {isSearchOpenOnFeed ? <X size={24} /> : <Search size={24} />}
                        </button>
                        <div className="relative" ref={filterRef}>
                             <button onClick={() => setAreFiltersOpen(!areFiltersOpen)} className="p-2 rounded-full hover:bg-slate-100 text-slate-600"><Filter size={24} /></button>
                             {areFiltersOpen && (<div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 p-4 z-20">
                                <h4 className="font-semibold text-slate-700 mb-3">Filtrer & Trier</h4>
                                <div className="space-y-3">
                                    <div><label className="text-sm font-medium text-slate-600 block mb-1">Type de contenu</label><select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full bg-slate-100 border-transparent rounded-lg py-2 px-3 text-sm"><option value="all">Tous</option><option value="image">Images</option><option value="document">Documents</option><option value="link">Liens</option></select></div>
                                    <div><label className="text-sm font-medium text-slate-600 block mb-1">Trier par</label><select value={sortOrder} onChange={e => setSortOrder(e.target.value)} className="w-full bg-slate-100 border-transparent rounded-lg py-2 px-3 text-sm"><option value="desc">Plus récents</option><option value="asc">Plus anciens</option></select></div>
                                </div>
                            </div>)}
                        </div>
                    </>
                 )}

                {session && profile && (
                    <>
                        <Link
                            to="/notifications"
                            className="relative p-2 rounded-full hover:bg-slate-100 text-slate-600"
                            aria-label="Notifications"
                        >
                            <Bell size={24} />
                            {unreadNotificationsCount > 0 && (
                                <span className="absolute top-1 right-1 flex h-4 w-4">
                                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-[10px] items-center justify-center">
                                        {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                                    </span>
                                </span>
                            )}
                        </Link>
                        <div className="relative" ref={dropdownRef}>
                          <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center p-1 rounded-full hover:bg-slate-100"><Avatar avatarUrl={profile.avatar_url} name={profile.full_name} /></button>
                          {dropdownOpen && (<div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-20 border border-slate-100">
                              <Link to={`/profile/${session?.user.id}`} className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><User size={16} className="mr-2"/>Mon Profil</Link>
                              <a href="#" className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"><Settings size={16} className="mr-2"/>Paramètres</a>
                              <div className="border-t my-1"></div>
                              <button onClick={handleSignOut} className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50"><LogOut size={16} className="mr-2"/>Se déconnecter</button>
                          </div>)}
                        </div>
                    </>
                )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;