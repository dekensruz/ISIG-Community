
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Upload, ArrowRight, Mail, Lock, User, Hash, GraduationCap, Eye, EyeOff } from 'lucide-react';

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [major, setMajor] = useState('');
  const [promotion, setPromotion] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
        
        if(data.user) {
            let avatarUrl: string | undefined = undefined;
            if (avatarFile) {
                const fileName = `avatars/${data.user.id}-${Date.now()}`;
                await supabase.storage.from('avatars').upload(fileName, avatarFile);
                const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
                avatarUrl = urlData.publicUrl;
            }

            await supabase.from('profiles').update({ 
                student_id: studentId, 
                full_name: fullName,
                major: major,
                promotion: promotion,
                avatar_url: avatarUrl,
            }).eq('id', data.user.id);
        }
        setMessage('Vérifiez votre email pour confirmer votre inscription !');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      {/* Côté gauche - Visuel (Desktop uniquement) */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-dark p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-isig-blue/20 blur-[100px] rounded-full -mr-48 -mt-48"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-isig-orange/20 blur-[100px] rounded-full -ml-48 -mb-48"></div>
        
        <div className="relative z-10">
          <img src="https://i.ibb.co/d0GY63vw/Logo-transparent.png" alt="ISIG Logo" className="w-20 h-20 mb-6 drop-shadow-xl" />
          <h1 className="text-5xl font-extrabold text-white leading-tight italic">
            L'intelligence <br/><span className="text-isig-blue text-6xl">collective</span> <br/> de l'ISIG Goma.
          </h1>
          <p className="text-slate-400 mt-6 text-xl max-w-md">
            Collaborez, apprenez et construisez l'avenir de la technologie avec vos pairs.
          </p>
        </div>

        <div className="relative z-10 flex items-center space-x-4 text-slate-300">
           <div className="flex -space-x-3">
              {[1,2,3,4].map(i => <div key={i} className="w-10 h-10 rounded-full bg-slate-700 border-2 border-brand-dark"></div>)}
           </div>
        </div>
      </div>

      {/* Côté droit - Formulaire */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-md space-y-8">
          
          {/* Logo visible sur mobile uniquement */}
          <div className="lg:hidden flex justify-center mb-6">
            <img src="https://i.ibb.co/d0GY63vw/Logo-transparent.png" alt="ISIG Logo" className="w-20 h-20 drop-shadow-xl" />
          </div>

          <div className="text-center">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase">
              {isLogin ? 'Bon retour !' : 'Rejoindre'}
            </h2>
            <p className="mt-2 text-slate-500 font-medium">
              {isLogin ? 'Accédez à votre espace étudiant.' : 'Créez votre profil académique.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="mt-8 space-y-4">
            {error && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100">{error}</div>}
            {message && <div className="p-4 bg-green-50 text-green-600 rounded-2xl text-sm font-bold border border-green-100">{message}</div>}

            {!isLogin && (
              <div className="grid grid-cols-1 gap-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Matricule" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm" required />
                  </div>
                  <div className="relative">
                    <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Promotion" value={promotion} onChange={(e) => setPromotion(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm" required />
                  </div>
                </div>
                <div className="relative">
                   <input type="text" placeholder="Filière (ex: Génie Logiciel)" value={major} onChange={(e) => setMajor(e.target.value)} className="w-full px-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm" required />
                </div>
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="email" placeholder="Adresse email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm" required />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type={showPassword ? "text" : "password"} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-12 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-isig-blue transition-colors">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <button type="submit" disabled={loading} className="w-full py-5 bg-isig-blue text-white font-black rounded-2xl shadow-xl shadow-isig-blue/20 flex items-center justify-center space-x-2 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-sm">
              <span>{loading ? 'Traitement...' : (isLogin ? 'Se connecter' : "Créer mon compte")}</span>
              {!loading && <ArrowRight size={20} />}
            </button>
          </form>

          <p className="text-center text-slate-500 font-bold">
            {isLogin ? "Nouveau ici ?" : "Déjà un compte ?"}
            <button onClick={() => setIsLogin(!isLogin)} className="ml-2 text-isig-blue hover:underline">
              {isLogin ? "S'inscrire" : "Se connecter"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
