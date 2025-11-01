import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Upload } from 'lucide-react';

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    } else {
      setAvatarFile(null);
      setPreviewUrl(null);
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
          options: {
            data: {
              full_name: fullName,
            },
          },
        });
        if (error) throw error;
        
        if(data.user) {
            let avatarUrl: string | undefined = undefined;
            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop();
                const fileName = `${data.user.id}/${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, avatarFile);
                
                if (uploadError) {
                    console.error("Error uploading avatar:", uploadError.message);
                } else {
                    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
                    avatarUrl = urlData.publicUrl;
                }
            }

            const { error: profileError } = await supabase
                .from('profiles')
                .update({ 
                    student_id: studentId, 
                    full_name: fullName,
                    major: major,
                    promotion: promotion,
                    avatar_url: avatarUrl,
                })
                .eq('id', data.user.id);
            if (profileError) console.error("Could not update profile with extra info:", profileError.message);
        }
        setMessage('Vérifiez votre email pour le lien de confirmation !');
      }
    } catch (err: any) {
      setError(err.error_description || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-8">
            <img src="https://i.ibb.co/d0GY63vw/Logo-transparent.png" alt="Logo ISIG" className="w-24 h-24 mx-auto mb-4"/>
            <h1 className="text-2xl font-bold text-slate-800">ISIG Community</h1>
            <p className="text-slate-500">{isLogin ? 'Content de vous revoir !' : 'Rejoignez la communauté étudiante'}</p>
        </div>
      
        <div className="bg-white p-8 rounded-xl shadow-md border border-slate-200">
            <h2 className="text-xl font-semibold text-center text-slate-700 mb-6">{isLogin ? 'Connexion' : 'Inscription'}</h2>
            
            {error && <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">{error}</p>}
            {message && <p className="bg-green-100 text-green-700 p-3 rounded-md mb-4 text-sm">{message}</p>}

            <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
                <>
                <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1" htmlFor="fullName">Nom complet</label>
                    <input
                    id="fullName"
                    className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-isig-blue focus:border-isig-blue block w-full p-2.5"
                    type="text"
                    placeholder="Ex: Dekens Ruzuba"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    />
                </div>
                <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1" htmlFor="studentId">Matricule</label>
                    <input
                    id="studentId"
                    className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-isig-blue focus:border-isig-blue block w-full p-2.5"
                    type="text"
                    placeholder="Ex: 24LGLLJ1071203"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    required
                    />
                </div>
                 <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1" htmlFor="major">Filière</label>
                    <input
                    id="major"
                    className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-isig-blue focus:border-isig-blue block w-full p-2.5"
                    type="text"
                    placeholder="Ex: Génie Logiciel"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    required
                    />
                </div>
                 <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1" htmlFor="promotion">Promotion</label>
                    <input
                    id="promotion"
                    className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-isig-blue focus:border-isig-blue block w-full p-2.5"
                    type="text"
                    placeholder="Ex: L1, L2..."
                    value={promotion}
                    onChange={(e) => setPromotion(e.target.value)}
                    required
                    />
                </div>
                <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1">
                        Photo de profil (Optionnel)
                    </label>
                    <div className="mt-1 flex items-center">
                        <span className="inline-block h-12 w-12 rounded-full overflow-hidden bg-slate-100">
                           {previewUrl ? 
                                <img src={previewUrl} alt="Aperçu de l'avatar" className="h-full w-full object-cover" /> :
                                <svg className="h-full w-full text-slate-300" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M24 20.993V24H0v-2.993A2 2 0 002 18h20a2 2 0 002 2.007zM12 13a4 4 0 100-8 4 4 0 000 8z" />
                                </svg>
                            }
                        </span>
                        <label htmlFor="file-upload" className="ml-5 cursor-pointer bg-white py-2 px-3 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center">
                           <Upload size={16} className="mr-2" />
                           <span>Choisir</span>
                           <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
                        </label>
                    </div>
                </div>
                </>
            )}
            <div>
                <label className="block text-slate-700 text-sm font-medium mb-1" htmlFor="email">Adresse e-mail</label>
                <input
                id="email"
                className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-isig-blue focus:border-isig-blue block w-full p-2.5"
                type="email"
                placeholder="votre.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                />
            </div>
            <div>
                <label className="block text-slate-700 text-sm font-medium mb-1" htmlFor="password">Mot de passe</label>
                <input
                id="password"
                className="bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-lg focus:ring-isig-blue focus:border-isig-blue block w-full p-2.5"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                />
            </div>
            <div className="pt-2">
                <button
                className="w-full text-white bg-isig-blue hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center transition-colors duration-300 disabled:bg-blue-300"
                type="submit"
                disabled={loading}
                >
                {loading ? 'Traitement...' : (isLogin ? 'Se connecter' : "S'inscrire")}
                </button>
            </div>
            </form>
        </div>
        <p className="text-center text-slate-500 text-sm mt-6">
          {isLogin ? "Vous n'avez pas de compte ?" : 'Vous avez déjà un compte ?'}
          <button onClick={() => {setIsLogin(!isLogin); setError(null);}} className="font-semibold text-isig-blue hover:underline ml-1">
            {isLogin ? "S'inscrire" : 'Se connecter'}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;