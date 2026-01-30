
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, Mail, Lock, User, Hash, GraduationCap, Eye, EyeOff, ShieldCheck, ChevronDown, UserRound, ArrowLeft, CheckCircle } from 'lucide-react';
import Spinner from './Spinner';
import { toast } from 'sonner';

export const PROMOTIONS = [
    "Licence 1", "Licence 2", "Licence 3", "Licence 4", "Master 1", "Master 2"
];

const AuthPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  
  // Wizard Steps: 1=Identifiants, 2=Identité, 3=Académique
  const [step, setStep] = useState(1); 
  const [loading, setLoading] = useState(false);
  
  // Form Data
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [major, setMajor] = useState('');
  const [promotion, setPromotion] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | ''>('');
  
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const initialMode = searchParams.get('mode');
    if (initialMode === 'signup') setMode('signup');
    else if (initialMode === 'forgot') setMode('forgot');
    else setMode('login');
  }, [searchParams]);

  const handleNextStep = () => {
    if (step === 1) {
        if (!email || !password) return toast.error("Veuillez remplir email et mot de passe.");
        if (password.length < 6) return toast.error("Le mot de passe doit faire au moins 6 caractères.");
    }
    if (step === 2) {
        if (!fullName || fullName.trim().split(/\s+/).length < 2) return toast.error("Entrez votre Prénom ET Nom.");
        if (!studentId) return toast.error("Le matricule est obligatoire.");
    }
    setStep(step + 1);
  };

  const handlePrevStep = () => setStep(step - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bon retour parmi nous !");
      } 
      else if (mode === 'signup') {
        if (!major || !promotion || !gender) {
            setLoading(false);
            return toast.error("Veuillez remplir tous les champs académiques.");
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        
        if (error) throw error;
        
        if(data.user) {
            // Mise à jour immédiate du profil
            await supabase.from('profiles').update({ 
                student_id: studentId, 
                full_name: fullName,
                major: major,
                promotion: promotion,
                gender: gender,
            }).eq('id', data.user.id);
        }
        toast.success("Compte créé ! Vérifiez vos emails pour confirmer.", { duration: 5000 });
      } 
      else if (mode === 'forgot') {
        if (!email) throw new Error("Email requis.");
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/settings?view=password`,
        });
        if (error) throw error;
        toast.success("Email de récupération envoyé.");
      }
    } catch (err: any) {
      toast.error(err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  // Renderers
  const renderStepIndicators = () => (
    <div className="flex justify-center space-x-2 mb-8">
        {[1, 2, 3].map((s) => (
            <div key={s} className={`h-2 rounded-full transition-all duration-300 ${step === s ? 'w-8 bg-isig-blue' : step > s ? 'w-2 bg-emerald-400' : 'w-2 bg-slate-200 dark:bg-slate-700'}`} />
        ))}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Branding Section */}
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

      {/* Form Section */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 relative overflow-y-auto">
        <div className="w-full max-w-md space-y-8 animate-fade-in-up py-8">
          <div className="lg:hidden flex justify-center mb-6">
            <img src="https://i.ibb.co/d0GY63vw/Logo-transparent.png" alt="ISIG Logo" className="w-20 h-20 drop-shadow-xl" />
          </div>

          <div className="text-center">
            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight italic uppercase">
              {mode === 'forgot' ? 'Récupération' : mode === 'login' ? 'Connexion' : 'Inscription'}
            </h2>
            <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">
               {mode === 'signup' ? `Étape ${step} sur 3` : "Accédez à votre espace étudiant"}
            </p>
          </div>

          {mode === 'signup' && renderStepIndicators()}

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            
            {/* --- STEP 1: IDENTIFIANTS (Or Login/Forgot Mode) --- */}
            {(step === 1 || mode !== 'signup') && (
                <div className="space-y-4 animate-fade-in">
                    {mode !== 'forgot' && mode === 'signup' && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl mb-4 border border-blue-100 dark:border-blue-900/30">
                            <p className="text-xs text-blue-600 dark:text-blue-400 font-bold">Commencez par sécuriser votre compte.</p>
                        </div>
                    )}
                    
                    <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                            type="email" 
                            placeholder="Adresse email" 
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm dark:text-white" 
                            required 
                        />
                    </div>

                    {mode !== 'forgot' && (
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type={showPassword ? "text" : "password"} 
                                placeholder="Mot de passe" 
                                value={password} 
                                onChange={(e) => setPassword(e.target.value)} 
                                className="w-full pl-11 pr-12 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm dark:text-white" 
                                required 
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-isig-blue transition-colors">
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                    )}

                    {mode === 'login' && (
                        <div className="flex justify-end">
                            <button type="button" onClick={() => setMode('forgot')} className="text-xs font-bold text-slate-400 hover:text-isig-blue transition-colors">Mot de passe oublié ?</button>
                        </div>
                    )}
                </div>
            )}

            {/* --- STEP 2: IDENTITÉ (Signup Only) --- */}
            {mode === 'signup' && step === 2 && (
                <div className="space-y-4 animate-fade-in">
                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" placeholder="Nom complet (Prénom Nom)" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm dark:text-white" autoFocus />
                    </div>
                    <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" placeholder="Matricule étudiant" value={studentId} onChange={(e) => setStudentId(e.target.value)} className="w-full pl-11 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm dark:text-white" />
                    </div>
                </div>
            )}

            {/* --- STEP 3: ACADÉMIQUE (Signup Only) --- */}
            {mode === 'signup' && step === 3 && (
                <div className="space-y-4 animate-fade-in">
                    <div className="relative">
                        <UserRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={18} />
                        <select value={gender} onChange={(e) => setGender(e.target.value as any)} className="w-full pl-11 pr-10 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm appearance-none cursor-pointer dark:text-white">
                            <option value="" disabled>Genre</option>
                            <option value="M">Homme</option>
                            <option value="F">Femme</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                    <input type="text" placeholder="Filière (ex: Génie Logiciel)" value={major} onChange={(e) => setMajor(e.target.value)} className="w-full px-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm dark:text-white" />
                    <div className="relative">
                        <GraduationCap className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 z-10" size={18} />
                        <select value={promotion} onChange={(e) => setPromotion(e.target.value)} className="w-full pl-11 pr-10 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none transition-all font-bold text-sm shadow-sm appearance-none cursor-pointer dark:text-white">
                            <option value="" disabled>Promotion</option>
                            {PROMOTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                </div>
            )}

            {/* --- ACTIONS --- */}
            <div className="flex gap-3 pt-2">
                {mode === 'signup' && step > 1 && (
                    <button type="button" onClick={handlePrevStep} className="px-6 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-2xl transition-all hover:bg-slate-200 dark:hover:bg-slate-700">
                        <ArrowLeft size={20} />
                    </button>
                )}
                
                {mode === 'signup' && step < 3 ? (
                    <button type="button" onClick={handleNextStep} className="flex-1 py-4 bg-slate-800 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl shadow-xl flex items-center justify-center space-x-2 transition-all active:scale-95 uppercase tracking-widest text-sm">
                        <span>Suivant</span> <ArrowRight size={20} />
                    </button>
                ) : (
                    <button type="submit" disabled={loading} className="flex-1 py-4 bg-isig-blue text-white font-black rounded-2xl shadow-xl shadow-isig-blue/20 flex items-center justify-center space-x-2 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-sm hover:bg-blue-600">
                        <span>{loading ? <Spinner /> : mode === 'forgot' ? 'Récupérer' : mode === 'login' ? 'Se connecter' : "Terminer"}</span>
                        {!loading && mode !== 'forgot' && (mode === 'signup' ? <CheckCircle size={20} /> : <ArrowRight size={20} />)}
                    </button>
                )}
            </div>

          </form>

          <p className="text-center text-slate-500 dark:text-slate-400 font-bold text-sm">
            {mode === 'signup' ? "Déjà un compte ?" : "Pas encore de compte ?"}
            <button 
                onClick={() => { 
                    setMode(mode === 'signup' ? 'login' : 'signup'); 
                    setStep(1); 
                }} 
                className="ml-2 text-isig-blue hover:underline"
            >
                {mode === 'signup' ? "Se connecter" : "S'inscrire"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
