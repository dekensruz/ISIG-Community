
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Profile as ProfileType, Post as PostType } from '../types';
import Spinner from './Spinner';
import { Edit, Save, BookOpen, Star, Upload, Camera, Calendar, MessageCircle, UserPlus, UserCheck, X, Search } from 'lucide-react';
import PostCard from './Post';
import CreatePost from './CreatePost';
import Avatar from './Avatar';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

const Profile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPost, setEditingPost] = useState<PostType | null>(null);
  const [profileSearch, setProfileSearch] = useState('');
  const [formData, setFormData] = useState<Partial<ProfileType>>({});
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [skillsStr, setSkillsStr] = useState('');
  const [coursesStr, setCoursesStr] = useState('');
  
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const [modalImage, setModalImage] = useState<string | null>(null);
  const editAreaRef = useRef<HTMLDivElement>(null);

  const isOwnProfile = session?.user.id === userId;

  const fetchProfileData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoadingProfile(true);
      const { data: profileData, error: profileError } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (profileError) throw profileError;

      if (profileData) {
        setProfile(profileData);
        setFormData({
            full_name: profileData.full_name,
            student_id: profileData.student_id,
            major: profileData.major,
            promotion: profileData.promotion,
            bio: profileData.bio,
            cover_url: profileData.cover_url,
            birth_date: profileData.birth_date,
            show_birth_year: profileData.show_birth_year,
        });
        setSkillsStr((profileData.skills || []).join(', '));
        setCoursesStr((profileData.courses || []).join(', '));
      }
      
      const { count: followers } = await supabase.from('followers').select('*', { count: 'exact' }).eq('following_id', userId);
      const { count: following } = await supabase.from('followers').select('*', { count: 'exact' }).eq('follower_id', userId);
      setFollowerCount(followers || 0);
      setFollowingCount(following || 0);

      if (session?.user && !isOwnProfile) {
        const { data: followData } = await supabase.from('followers').select('*').eq('follower_id', session.user.id).eq('following_id', userId).single();
        setIsFollowing(!!followData);
      }
      
      setLoadingProfile(false);
      
      setLoadingPosts(true);
      const { data: postsData } = await supabase.from('posts').select(`*, profiles(*), comments(*, profiles(*)), likes(*)`).eq('user_id', userId).order('created_at', { ascending: false });
      if (postsData) setPosts(postsData as any);
      setLoadingPosts(false);

    } catch (error: any) {
      console.error('Erreur profil:', error.message);
      setLoadingProfile(false);
      setLoadingPosts(false);
    }
  }, [userId, session?.user, isOwnProfile]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);
  
  const handleUpdateProfile = async () => {
    if (!isOwnProfile) return;
    try {
        setLoadingProfile(true);
        const updates = {
            ...formData,
            skills: skillsStr.split(',').map(s => s.trim()).filter(Boolean),
            courses: coursesStr.split(',').map(s => s.trim()).filter(Boolean),
            birth_date: formData.birth_date === '' ? null : formData.birth_date,
            id: userId,
            updated_at: new Date(),
        };
        const { error } = await supabase.from('profiles').upsert(updates);
        if (error) throw error;
        setIsEditing(false);
        fetchProfileData();
    } catch (error: any) {
        alert(error.message);
    } finally {
        setLoadingProfile(false);
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !isOwnProfile) return;
    const file = event.target.files[0];
    const fileName = `avatars/${userId}-${Date.now()}`;

    try {
        setAvatarUploading(true);
        const { data, error } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
        if (error) throw error;
        
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.path);
        await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', userId);
        fetchProfileData();
    } catch (error: any) {
        alert(error.message);
    } finally {
        setAvatarUploading(false);
    }
  }

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !isOwnProfile) return;
    const file = event.target.files[0];
    const fileName = `covers/${userId}-${Date.now()}`;

    try {
      setCoverUploading(true);
      const { data, error } = await supabase.storage.from('covers').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('covers').getPublicUrl(data.path);
      await supabase.from('profiles').update({ cover_url: urlData.publicUrl }).eq('id', userId);
      fetchProfileData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setCoverUploading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleFollow = async () => {
    if (!session?.user || isOwnProfile || followLoading) return;
    setFollowLoading(true);
    setIsFollowing(true);
    setFollowerCount(c => c + 1);
    const { error } = await supabase.from('followers').insert({ follower_id: session.user.id, following_id: userId });
    if (error) {
        setIsFollowing(false);
        setFollowerCount(c => c - 1);
    }
    setFollowLoading(false);
  };

  const handleUnfollow = async () => {
    if (!session?.user || isOwnProfile || followLoading) return;
    setFollowLoading(true);
    setIsFollowing(false);
    setFollowerCount(c => c - 1);
    const { error } = await supabase.from('followers').delete().match({ follower_id: session.user.id, following_id: userId });
     if (error) {
        setIsFollowing(true);
        setFollowerCount(c => c + 1);
    }
    setFollowLoading(false);
  };

  const handleSendMessage = async () => {
    if (!session?.user || !userId || isOwnProfile) return;
    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation', { other_user_id: userId });
      if (error) throw error;
      if (data) navigate(`/chat/${data}`);
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditRequested = (post: PostType) => {
    setEditingPost(post);
    // Défilement direct vers le haut de la section des publications (là où CreatePost apparaît)
    setTimeout(() => {
        if (editAreaRef.current) {
            const yOffset = -100; // Offset pour compenser la navbar
            const y = editAreaRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    }, 100);
  };

  const filteredPosts = useMemo(() => {
    if (!profileSearch.trim()) return posts;
    return posts.filter(p => p.content.toLowerCase().includes(profileSearch.toLowerCase()));
  }, [posts, profileSearch]);


  if (loadingProfile && !profile) {
    return <div className="flex justify-center mt-8"><Spinner /></div>;
  }

  if (!profile) return <p className="text-center py-20 font-bold text-slate-400">Profil introuvable.</p>;
  
  const formattedBirthDate = profile.birth_date 
      ? format(parseISO(profile.birth_date), profile.show_birth_year ? 'd MMMM yyyy' : 'd MMMM', { locale: fr })
      : null;

  return (
    <>
    <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-[3rem] shadow-soft border border-slate-100 overflow-hidden group">
            <div className="relative">
                <div 
                    className={`w-full h-48 sm:h-64 md:h-72 bg-gradient-to-br from-isig-blue to-blue-600 relative rounded-b-[3.5rem] bg-cover bg-center transition-transform duration-700 ${profile.cover_url ? 'cursor-pointer' : ''}`}
                    style={{ backgroundImage: profile.cover_url ? `url(${profile.cover_url})` : undefined }}
                    onClick={() => profile.cover_url && setModalImage(profile.cover_url)}
                >
                    {isEditing && (
                        <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex items-center justify-center rounded-b-[3.5rem] opacity-0 group-hover:opacity-100 transition-opacity">
                            <label className="bg-white/90 text-slate-800 px-6 py-3 rounded-2xl flex items-center space-x-2 cursor-pointer hover:bg-white transition-all shadow-xl font-black text-sm uppercase tracking-widest">
                                {coverUploading ? <Spinner /> : <Camera size={20} className="text-isig-blue"/>}
                                <span>Changer la couverture</span>
                                <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={coverUploading}/>
                            </label>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="px-4 sm:px-10">
                <div className="relative flex flex-col sm:flex-row items-center sm:items-start -mt-16 sm:-mt-20 mb-6 sm:space-x-8">
                    <div className="relative group/avatar shrink-0">
                        <button 
                            onClick={() => profile.avatar_url && setModalImage(profile.avatar_url)} 
                            disabled={!profile.avatar_url}
                            className="relative"
                        >
                           <Avatar avatarUrl={profile.avatar_url} name={profile.full_name} size="3xl" className="ring-[12px] ring-white shadow-premium" />
                        </button>
                        {isOwnProfile && (
                            <label className="absolute bottom-2 right-2 bg-isig-orange text-white p-3 rounded-2xl cursor-pointer hover:bg-orange-600 shadow-lg transition-all active:scale-90 flex items-center justify-center">
                                {avatarUploading ? <Spinner/> : <Upload size={20} />}
                                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={avatarUploading}/>
                            </label>
                        )}
                    </div>

                    <div className="mt-6 sm:mt-24 flex-grow text-center sm:text-left min-w-0">
                       {isEditing ? (
                            <input type="text" name="full_name" value={formData.full_name || ''} onChange={handleInputChange} className="text-3xl font-black text-slate-800 w-full p-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-isig-blue transition-all" placeholder="Nom complet"/>
                        ) : (
                            <h1 className="text-3xl sm:text-4xl font-black text-slate-800 tracking-tight leading-tight">{profile.full_name}</h1>
                        )}
                        {isEditing ? (
                            <div className="flex flex-col sm:flex-row gap-3 mt-3">
                                <input type="text" name="major" value={formData.major || ''} onChange={handleInputChange} placeholder="Filière (ex: Génie Logiciel)" className="text-sm font-bold p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-isig-blue w-full"/>
                                <input type="text" name="promotion" value={formData.promotion || ''} onChange={handleInputChange} placeholder="Promotion (ex: L2)" className="text-sm font-bold p-3 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-isig-blue w-full"/>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center sm:justify-start mt-1 space-x-2">
                                <span className="text-lg text-isig-blue font-black uppercase tracking-widest text-xs sm:text-sm">{profile.major || 'Étudiant ISIG'}</span>
                                {profile.promotion && <span className="bg-slate-100 text-slate-500 text-xs font-black px-2 py-1 rounded-lg">{profile.promotion}</span>}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-shrink-0 flex items-center space-x-3 mt-6 sm:mt-24 w-full sm:w-auto">
                         {isOwnProfile ? (
                             <button onClick={() => isEditing ? handleUpdateProfile() : setIsEditing(true)} className="flex-1 sm:flex-none py-3 px-6 bg-slate-50 text-slate-700 rounded-2xl flex items-center justify-center space-x-2 hover:bg-slate-100 font-black text-xs sm:text-sm uppercase tracking-widest transition-all active:scale-95 border border-slate-100">
                                {isEditing ? <><Save size={20} /><span>Sauver</span></> : <><Edit size={20} /><span>Éditer</span></>}
                            </button>
                        ) : (
                            <>
                                <button onClick={handleSendMessage} className="flex-1 py-3 px-6 bg-slate-50 text-slate-700 rounded-2xl flex items-center justify-center space-x-2 hover:bg-slate-100 font-black text-xs sm:text-sm uppercase tracking-widest transition-all border border-slate-100">
                                    <MessageCircle size={20} className="text-isig-blue"/>
                                    <span>Chat</span>
                                </button>
                                {isFollowing ? (
                                    <button onClick={handleUnfollow} disabled={followLoading} className="flex-1 py-3 px-6 bg-isig-blue text-white rounded-2xl flex items-center justify-center space-x-2 hover:bg-blue-600 font-black text-xs sm:text-sm uppercase tracking-widest transition-all shadow-lg shadow-isig-blue/20">
                                        <UserCheck size={20} />
                                        <span>Abonné</span>
                                    </button>
                                ) : (
                                    <button onClick={handleFollow} disabled={followLoading} className="flex-1 py-3 px-6 bg-isig-orange text-white rounded-2xl flex items-center justify-center space-x-2 hover:bg-orange-600 font-black text-xs sm:text-sm uppercase tracking-widest transition-all shadow-lg shadow-isig-orange/20">
                                        <UserPlus size={20} />
                                        <span>Suivre</span>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-center sm:justify-start space-x-8 pb-8 border-b border-slate-50">
                    <div className="text-center sm:text-left">
                        <span className="block text-xl font-black text-slate-800">{followerCount}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Abonnés</span>
                    </div>
                    <div className="text-center sm:text-left">
                        <span className="block text-xl font-black text-slate-800">{followingCount}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Abonnements</span>
                    </div>
                    <div className="text-center sm:text-left">
                        <span className="block text-xl font-black text-slate-800">{posts.length}</span>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Posts</span>
                    </div>
                </div>

                <div className="py-8">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Biographie</h3>
                     <div className="text-slate-600 font-medium leading-relaxed italic">
                        {isEditing ? (
                            <textarea name="bio" value={formData.bio || ''} onChange={handleInputChange} placeholder="Dites-nous en plus sur vous..." className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-isig-blue transition-all min-h-[100px]"/>
                        ) : (
                            <p className="whitespace-pre-wrap">{profile.bio || "Pas encore de biographie. L'étudiant mystère !"}</p>
                        )}
                    </div>
                    
                    <div className="mt-6 flex flex-wrap gap-4">
                        {isEditing ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Matricule</label>
                                <input type="text" name="student_id" value={formData.student_id || ''} onChange={handleInputChange} placeholder="Matricule" className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold"/>
                            </div>
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block ml-1">Date de naissance</label>
                                <input type="date" name="birth_date" value={formData.birth_date || ''} onChange={handleInputChange} className="w-full p-3 bg-slate-50 border-none rounded-xl text-sm font-bold"/>
                            </div>
                          </div>
                        ) : (
                          <>
                            {profile.student_id && <div className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold text-slate-500 border border-slate-100 flex items-center shrink-0">Matricule : {profile.student_id}</div>}
                            {formattedBirthDate && <div className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] sm:text-xs font-bold text-slate-500 border border-slate-100 flex items-center shrink-0"><Calendar size={14} className="mr-2 text-isig-blue"/>Né le {formattedBirthDate}</div>}
                          </>
                        )}
                    </div>
                </div>
            </div>
        </div>
        
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100">
                <h3 className="text-lg font-black mb-4 flex items-center text-slate-800 uppercase tracking-tight"><Star className="text-isig-orange mr-3" size={24}/> Compétences</h3>
                {isEditing ? (
                    <input type="text" value={skillsStr} onChange={(e) => setSkillsStr(e.target.value)} placeholder="React, Python, UI/UX..." className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm focus:ring-2 focus:ring-isig-blue"/>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {(profile.skills && profile.skills.length > 0) ? profile.skills.map(skill => <span key={skill} className="bg-isig-blue/10 text-isig-blue px-4 py-2 text-[10px] font-black rounded-xl uppercase tracking-widest">{skill}</span>) : <p className="text-slate-400 font-medium italic text-sm">Aucune compétence listée.</p>}
                    </div>
                )}
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] shadow-soft border border-slate-100">
                <h3 className="text-lg font-black mb-4 flex items-center text-slate-800 uppercase tracking-tight"><BookOpen className="text-isig-blue mr-3" size={24}/> Points forts</h3>
                {isEditing ? (
                    <input type="text" value={coursesStr} onChange={(e) => setCoursesStr(e.target.value)} placeholder="Algorithmes, Marketing..." className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-sm focus:ring-2 focus:ring-isig-blue"/>
                ) : (
                     <div className="flex flex-wrap gap-2">
                         {(profile.courses && profile.courses.length > 0) ? profile.courses.map(course => <span key={course} className="bg-slate-100 text-slate-600 px-4 py-2 text-[10px] font-black rounded-xl uppercase tracking-widest">{course}</span>) : <p className="text-slate-400 font-medium italic text-sm">Aucun point fort listé.</p>}
                    </div>
                )}
            </div>
        </div>

        <div className="mt-12" ref={editAreaRef}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Publications</h2>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Chercher dans ces posts..." 
                      value={profileSearch}
                      onChange={(e) => setProfileSearch(e.target.value)}
                      className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-isig-blue outline-none transition-all shadow-sm"
                    />
                </div>
            </div>

            {isOwnProfile && editingPost && (
                <div className="mb-8">
                  <CreatePost 
                    onPostCreated={() => { fetchProfileData(); setEditingPost(null); }} 
                    editingPost={editingPost}
                    onCancelEdit={() => setEditingPost(null)}
                  />
                </div>
            )}

            {loadingPosts ? (
                <div className="flex justify-center py-10"><Spinner /></div>
            ) : filteredPosts.length > 0 ? (
                <div className="space-y-8">
                    {filteredPosts.map(post => <PostCard key={post.id} post={post} onEditRequested={handleEditRequested} />)}
                </div>
            ) : (
                <div className="text-center bg-white p-16 rounded-[3rem] shadow-soft border border-slate-100">
                    <p className="text-slate-400 font-bold italic">Rien à voir ici pour le moment.</p>
                </div>
            )}
        </div>
    </div>

    {modalImage && (
        <div className="fixed inset-0 bg-brand-dark/95 z-[100] flex items-center justify-center p-4 backdrop-blur-md" onClick={() => setModalImage(null)}>
            <img src={modalImage} alt="Vue agrandie" className="max-w-full max-h-full object-contain rounded-3xl shadow-2xl animate-fade-in-up"/>
            <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors bg-white/10 p-3 rounded-full">
                <X size={32} />
            </button>
        </div>
    )}
    </>
  );
};

export default Profile;
