
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useSearchParams } from 'react-router-dom';
import { Upload, ArrowRight, Mail, Lock, User, Hash, GraduationCap, Eye, EyeOff, RefreshCw, AlertCircle, ShieldCheck, ChevronDown, UserRound } from 'lucide-react';
import Spinner from './Spinner';

export const PROMOTIONS = [
    "Licence 1",
    "Licence 2",
    "Licence 3",
    "Licence 4",
    "Master 1",
    "Master 2"
];

const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [major, setMajor] = useState('');
  const [promotion, setPromotion] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | ''>('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const initialMode = searchParams.get('mode');
    if (initialMode === 'signup') setMode('signup');
    else if (initialMode === 'forgot') setMode('forgot');
    else setMode('login');
  }, [searchParams]);

  const getFriendlyErrorMessage = (err: any) => {
    const msg = err.message || '';
    if (msg.includes('Invalid login credentials')) return "Email ou mot de passe incorrect.";
    if (msg.includes('already registered')) return "Cet email est déjà utilisé par un autre étudiant.";
    return msg || "Une erreur est survenue. Veuillez réessayer.";
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === 'signup') {
        // Validation du nom complet (au moins deux mots)
        const nameParts = fullName.trim().split(/\s+/);
        if (nameParts.length < 2) {
          throw new Error("Veuillez entrer votre nom complet (Prénom et Nom). Exemple : Dekens Ruzuba");
        }

        if (!gender) throw new Error("Veuillez sélectionner votre genre.");

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
                gender: gender,
                avatar_url: avatarUrl,
            }).eq('id', data.user.id);
        }
        setMessage('Vérifiez votre boîte mail pour confirmer votre inscription.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setMessage('Lien de récupération envoyé !');
      }
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const isLogin = mode === 'login';
  const isForgot = mode === 'forgot';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">
      <div className="hidden lg:flex lg:w-1/2 bg-brand-dark p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-isig-blue/20 blur-[100px] rounded-full -mr-48 -mt-48"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-isig-orange/20 blur-[100px] rounded-full -ml-48 -mb-48"></div>
        <div className="relative z-10">
          <img src="https://i.ibb.co/gLJQF0rn/isig.jpg" alt="ISIG Logo" className="w-20 h-20 mb-6 drop-shadow-xl" />
          <h1 className="text-5xl font-extrabold text-white leading-tight italic">
            L'intelligence <br/><span className="text-isig-blue text-6xl">collective</span> <br/> de l'ISIG Goma.
          </h1>
        </div>
        <div className="relative z-10 flex items-center space-x-3 text-white/50 text-xs font-bold uppercase tracking-widest">
            <ShieldCheck size={16} />
            <span>Données sécurisées </span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative">
        <div className="w-full max-w-md space-y-8 animate-fade-in-up">
          <div className="lg:hidden flex justify-center mb-6">
            <img src="https://i.ibb.co/d0GY63vw/Logo-transparent.png" alt="ISIG Logo" className="w-20 h-20 drop-shadow-xl" />
          </div>

          <div className="text-center">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight italic uppercase">
              {isForgot ? 'Récupération' : isLogin ? 'Bon retour !' : 'Rejoindre'}
            </h2>
          </div>

          <form onSubmit={handleAuth} className="mt-8 space-y-4">
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100 flex items-start animate-fade-in">
                <AlertCircle size={18} className="mr-2 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            {message && (
              <div className="p-4 bg-green-50 text-green-600 rounded-2xl text-sm font-bold border border-green-100 flex items-start">
                <RefreshCw size={18} className="mr-2 shrink-0 mt-0.5" />
                <span>{message}</span>
              </div>
            )}

            {!isLogin && !isForgot && (
              <div className="grid grid-cols-1 gap-4">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type="text" placeholder="Nom complet" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm" required />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="Matricule" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm" required />
                  </div>
                  <div className="relative">
                    <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={18} />
                    <select 
                        value={promotion} 
                        onChange={(e) => setPromotion(e.target.value)} 
                        className="w-full pl-11 pr-10 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm appearance-none cursor-pointer" 
                        required
                    >
                        <option value="" disabled>Promotion</option>
                        {PROMOTIONS.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                   <input type="text" placeholder="Filière (ex: Génie Logiciel)" value={major} onChange={(e) => setMajor(e.target.value)} className="w-full px-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm" required />
                   <div className="relative">
                      <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={18} />
                      <select 
                          value={gender} 
                          onChange={(e) => setGender(e.target.value as any)} 
                          className="w-full pl-11 pr-10 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm appearance-none cursor-pointer" 
                          required
                      >
                          <option value="" disabled>Genre</option>
                          <option value="M">Homme (M)</option>
                          <option value="F">Femme (F)</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                   </div>
                </div>
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input type="email" placeholder="Adresse email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm" required />
            </div>

            {!isForgot && (
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input type={showPassword ? "text" : "password"} placeholder="Mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-11 pr-12 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm" required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-isig-blue transition-colors">
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {isLogin && (
                    <div className="flex justify-end">
                        <button 
                            type="button" 
                            onClick={() => setMode('forgot')} 
                            className="text-xs font-bold text-slate-400 hover:text-isig-blue transition-colors"
                        >
                            Mot de passe oublié ?
                        </button>
                    </div>
                )}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full py-5 bg-isig-blue text-white font-black rounded-2xl shadow-xl shadow-isig-blue/20 flex items-center justify-center space-x-2 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-sm">
              <span>{loading ? <Spinner /> : isForgot ? 'Récupérer' : isLogin ? 'Se connecter' : "S'inscrire"}</span>
              {!loading && <ArrowRight size={20} />}
            </button>
          </form>

          <p className="text-center text-slate-500 font-bold">
            {isForgot ? "Retour à la " : isLogin ? "Nouveau ici ?" : "Déjà un compte ?"}
            <button onClick={() => setMode(isForgot ? 'login' : isLogin ? 'signup' : 'login')} className="ml-2 text-isig-blue hover:underline">
                {isForgot ? "Connexion" : isLogin ? "S'inscrire" : "Se connecter"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
