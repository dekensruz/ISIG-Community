import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Profile as ProfileType, Post as PostType } from '../types';
import Spinner from './Spinner';
import { Edit, Save, BookOpen, Star, Upload, Camera, Calendar, MessageCircle, UserPlus, UserCheck, X } from 'lucide-react';
import PostCard from './Post';
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
  const [formData, setFormData] = useState<Partial<ProfileType>>({});
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [skillsStr, setSkillsStr] = useState('');
  const [coursesStr, setCoursesStr] = useState('');
  
  // State for follower system
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  // State for image modal
  const [modalImage, setModalImage] = useState<string | null>(null);

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
      
      // Fetch follower/following counts
      const { count: followers } = await supabase.from('followers').select('*', { count: 'exact' }).eq('following_id', userId);
      const { count: following } = await supabase.from('followers').select('*', { count: 'exact' }).eq('follower_id', userId);
      setFollowerCount(followers || 0);
      setFollowingCount(following || 0);

      // Check if current user is following this profile
      if (session?.user && !isOwnProfile) {
        const { data: followData, error: followError } = await supabase.from('followers').select('*').eq('follower_id', session.user.id).eq('following_id', userId).single();
        if (followData) setIsFollowing(true);
        else setIsFollowing(false);
      }
      
      setLoadingProfile(false);
      
      setLoadingPosts(true);
      const { data: postsData, error: postsError } = await supabase.from('posts').select(`*, profiles(*), comments(*, profiles(*)), likes(*)`).eq('user_id', userId).order('created_at', { ascending: false });
      if (postsError) throw postsError;
      if (postsData) setPosts(postsData as any);
      setLoadingPosts(false);

    } catch (error: any) {
      console.error('Erreur lors de la récupération du profil:', error.message);
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
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;

    try {
        setAvatarUploading(true);
        const { data, error } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true });
        if (error) throw error;
        
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data.path);
        
        const { error: updateError } = await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', userId);
        if (updateError) throw updateError;
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
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-cover-${Date.now()}.${fileExt}`;

    try {
      setCoverUploading(true);
      const { data, error } = await supabase.storage.from('covers').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('covers').getPublicUrl(data.path);
      const { error: updateError } = await supabase.from('profiles').update({ cover_url: urlData.publicUrl }).eq('id', userId);
      if (updateError) throw updateError;
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
  
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.checked });
  }

  const handleFollow = async () => {
    if (!session?.user || isOwnProfile || followLoading) return;
    setFollowLoading(true);
    const { error } = await supabase.from('followers').insert({ follower_id: session.user.id, following_id: userId });
    if (!error) {
        setIsFollowing(true);
        setFollowerCount(c => c + 1);
    }
    setFollowLoading(false);
  };

  const handleUnfollow = async () => {
    if (!session?.user || isOwnProfile || followLoading) return;
    setFollowLoading(true);
    const { error } = await supabase.from('followers').delete().match({ follower_id: session.user.id, following_id: userId });
     if (!error) {
        setIsFollowing(false);
        setFollowerCount(c => c - 1);
    }
    setFollowLoading(false);
  };

  const handleSendMessage = async () => {
    if (!session?.user || !userId || isOwnProfile) return;

    try {
      // Call the RPC function on the database
      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        other_user_id: userId,
      });

      if (error) {
        // Log the detailed error for debugging purposes but show a user-friendly message.
        console.error("Error from get_or_create_conversation RPC:", error);
        throw new Error("Impossible de démarrer la conversation. Il se peut qu'il y ait un problème de configuration de la base de données.");
      }

      if (data) {
        const conversationId = data;
        navigate(`/chat/${conversationId}`);
      } else {
        throw new Error("La fonction RPC n'a retourné aucun ID de conversation.");
      }
    } catch (error) {
      console.error("Error getting or creating conversation:", error);
      alert(`Une erreur est survenue : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  };


  if (loadingProfile && !profile) {
    return <div className="flex justify-center mt-8"><Spinner /></div>;
  }

  if (!profile) {
    return <p>Profil introuvable.</p>;
  }
  
  const formattedBirthDate = profile.birth_date 
      ? format(parseISO(profile.birth_date), profile.show_birth_year ? 'd MMMM yyyy' : 'd MMMM', { locale: fr })
      : null;

  return (
    <>
    <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <button
                className={`w-full h-48 sm:h-56 md:h-64 bg-gradient-to-r from-isig-blue to-blue-400 relative bg-cover bg-center ${profile.cover_url ? 'cursor-pointer' : ''}`}
                style={{ backgroundImage: profile.cover_url ? `url(${profile.cover_url})` : undefined }}
                onClick={() => profile.cover_url && setModalImage(profile.cover_url)}
                disabled={!profile.cover_url}
            >
                {isEditing && (
                    <label htmlFor="cover-upload" onClick={(e) => e.stopPropagation()} className="absolute bottom-4 right-4 bg-black/50 text-white px-3 py-2 rounded-lg flex items-center space-x-2 cursor-pointer hover:bg-black/70">
                        {coverUploading ? <Spinner /> : <Camera size={18} />}
                        <span className="text-sm hidden sm:inline">Couverture</span>
                        <input id="cover-upload" type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={coverUploading}/>
                    </label>
                )}
            </button>
            
            <div className="px-4 sm:px-6 lg:px-8">
                <div className="relative flex flex-col sm:flex-row items-center sm:items-end -mt-16 sm:-mt-20">
                    <div className="relative flex-shrink-0">
                        <button onClick={() => profile.avatar_url && setModalImage(profile.avatar_url)} disabled={!profile.avatar_url} className={profile.avatar_url ? 'cursor-pointer' : ''}>
                           <Avatar avatarUrl={profile.avatar_url} name={profile.full_name} size="3xl" className="ring-4 ring-white" />
                        </button>
                        {isOwnProfile && (
                            <label htmlFor="avatar-upload" className="absolute bottom-1 right-1 bg-isig-orange text-white p-2 rounded-full cursor-pointer hover:bg-orange-600">
                                {avatarUploading ? <Spinner/> : <Upload size={16} />}
                                <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={avatarUploading}/>
                            </label>
                        )}
                    </div>

                    <div className="sm:ml-6 mt-4 sm:mt-0 flex-grow text-center sm:text-left">
                       {isEditing ? (
                            <input type="text" name="full_name" value={formData.full_name || ''} onChange={handleInputChange} className="text-3xl font-bold text-slate-800 w-full p-2 border rounded"/>
                        ) : (
                            <h1 className="text-3xl font-bold text-slate-800">{profile.full_name}</h1>
                        )}
                        {isEditing ? (
                            <div className="flex flex-col sm:flex-row gap-2 mt-1">
                                <input type="text" name="major" value={formData.major || ''} onChange={handleInputChange} placeholder="Filière" className="text-lg text-slate-600 w-full p-2 border rounded"/>
                                <input type="text" name="promotion" value={formData.promotion || ''} onChange={handleInputChange} placeholder="Promotion, ex: L1" className="text-lg text-slate-600 w-full p-2 border rounded"/>
                            </div>
                        ) : (
                            <p className="text-lg text-isig-blue font-semibold">
                                {profile.major || 'Filière non spécifiée'}
                                {profile.promotion && <span className="font-normal text-slate-500"> • {profile.promotion}</span>}
                            </p>
                        )}
                    </div>
                    
                    <div className="flex-shrink-0 flex items-center space-x-2 mt-4 sm:mt-0 w-full sm:w-auto justify-center">
                         {isOwnProfile ? (
                             <button onClick={() => isEditing ? handleUpdateProfile() : setIsEditing(true)} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-slate-200 font-semibold w-full justify-center sm:w-auto">
                                {isEditing ? <Save size={20} /> : <Edit size={20} />}
                                <span>{isEditing ? 'Enregistrer' : 'Modifier'}</span>
                            </button>
                        ) : (
                            <>
                                <button onClick={handleSendMessage} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-slate-200 font-semibold flex-1 justify-center">
                                    <MessageCircle size={20} />
                                    <span>Message</span>
                                </button>
                                {isFollowing ? (
                                    <button onClick={handleUnfollow} disabled={followLoading} className="bg-isig-blue text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-blue-700 font-semibold flex-1 justify-center">
                                        <UserCheck size={20} />
                                        <span>Abonné</span>
                                    </button>
                                ) : (
                                    <button onClick={handleFollow} disabled={followLoading} className="bg-isig-orange text-white px-4 py-2 rounded-lg flex items-center space-x-2 hover:bg-orange-600 font-semibold flex-1 justify-center">
                                        <UserPlus size={20} />
                                        <span>Suivre</span>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-center sm:justify-start space-x-6 mt-4 pb-6 sm:ml-[152px]">
                    <span className="font-semibold">{followerCount} <span className="font-normal">abonnés</span></span>
                    <span className="font-semibold">{followingCount} <span className="font-normal">abonnements</span></span>
                </div>

                <div className="border-t border-slate-200 pt-6 pb-6">
                    <h3 className="font-semibold text-slate-800 text-lg">À propos</h3>
                     <p className="mt-2 text-md text-slate-600">{isEditing ? (
                            <textarea name="bio" value={formData.bio || ''} onChange={handleInputChange} placeholder="Votre biographie" className="text-md text-slate-600 w-full p-2 border rounded"/>
                        ) : (
                            profile.bio || 'Aucune biographie fournie.'
                        )}
                    </p>
                    <div className="mt-4 space-y-2">
                        {isEditing ? (
                          <>
                            <input type="text" name="student_id" value={formData.student_id || ''} onChange={handleInputChange} placeholder="Matricule" className="text-sm text-slate-500 w-full p-2 border rounded"/>
                            <input type="date" name="birth_date" value={formData.birth_date || ''} onChange={handleInputChange} className="text-sm text-slate-500 w-full p-2 border rounded"/>
                            <div className="flex items-center"><input id="show_birth_year" name="show_birth_year" type="checkbox" checked={formData.show_birth_year} onChange={handleCheckboxChange} className="w-4 h-4 mr-2" /><label htmlFor="show_birth_year">Afficher l'année de naissance</label></div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-slate-500">Matricule: {profile.student_id || 'N/A'}</p>
                            {formattedBirthDate && <p className="text-sm text-slate-500 flex items-center"><Calendar size={14} className="mr-2"/>Né le {formattedBirthDate}</p>}
                          </>
                        )}
                    </div>
                </div>
            </div>
        </div>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-xl font-semibold mb-3 flex items-center text-slate-700"><Star className="text-isig-orange mr-2"/> Compétences</h3>
                {isEditing ? (
                    <input type="text" value={skillsStr} onChange={(e) => setSkillsStr(e.target.value)} placeholder="Ex: React, Python, UI/UX (séparés par des virgules)" className="w-full p-2 border rounded"/>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {(profile.skills && profile.skills.length > 0) ? profile.skills.map(skill => <span key={skill} className="bg-isig-blue text-white px-3 py-1 text-sm rounded-full">{skill}</span>) : <p className="text-slate-500">Aucune compétence listée.</p>}
                    </div>
                )}
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-xl font-semibold mb-3 flex items-center text-slate-700"><BookOpen className="text-isig-orange mr-2"/> Points forts</h3>
                {isEditing ? (
                    <input type="text" value={coursesStr} onChange={(e) => setCoursesStr(e.target.value)} placeholder="Ex: Bases de Données (séparés par des virgules)" className="w-full p-2 border rounded"/>
                ) : (
                     <div className="flex flex-wrap gap-2">
                         {(profile.courses && profile.courses.length > 0) ? profile.courses.map(course => <span key={course} className="bg-slate-200 text-slate-800 px-3 py-1 text-sm rounded-full">{course}</span>) : <p className="text-slate-500">Aucun point fort listé.</p>}
                    </div>
                )}
            </div>
        </div>

        <div className="mt-8">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Publications de {profile.full_name}</h2>
            {loadingPosts ? (
                <div className="flex justify-center"><Spinner /></div>
            ) : posts.length > 0 ? (
                <div className="space-y-6">
                    {posts.map(post => <PostCard key={post.id} post={post} />)}
                </div>
            ) : (
                <div className="text-center bg-white p-8 rounded-lg shadow-sm border border-slate-200">
                    <p className="text-slate-500">Cet utilisateur n'a encore rien publié.</p>
                </div>
            )}
        </div>
    </div>

    {modalImage && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setModalImage(null)}>
            <img src={modalImage} alt="Vue agrandie" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"/>
            <button className="absolute top-4 right-4 text-white hover:text-gray-300">
                <X size={32} />
            </button>
        </div>
    )}
    </>
  );
};

export default Profile;