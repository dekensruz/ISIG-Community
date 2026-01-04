
import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import Spinner from './Spinner';
import { X, Upload, Lock, Globe } from 'lucide-react';

interface CreateGroupModalProps {
  onClose: () => void;
}

const CreateGroupModal: React.FC<CreateGroupModalProps> = ({ onClose }) => {
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
            onClose();
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !session?.user) {
        setError("Le nom du groupe est obligatoire.");
        return;
    }
    setLoading(true);
    setError(null);

    try {
        let avatarUrl: string | undefined = undefined;
        if (avatarFile) {
            const fileExt = avatarFile.name.split('.').pop();
            const fileName = `group-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, avatarFile);
            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
            avatarUrl = data.publicUrl;
        }

        // 1. Insertion du groupe
        const { data: groupData, error: groupError } = await supabase
            .from('groups')
            .insert({
                name,
                description,
                created_by: session.user.id,
                avatar_url: avatarUrl,
                is_private: isPrivate,
            })
            .select()
            .single();
        
        if (groupError) throw groupError;

        // 2. Le déclencheur (trigger) côté base de données est censé ajouter le créateur automatiquement,
        // mais pour être sûr, nous vérifions si l'entrée existe ou nous la mettons à jour.
        if (groupData) {
            // Note: Si une erreur de permission survient ici, c'est que l'utilisateur n'a pas le droit d'écrire 'admin'.
            // Cependant, en tant que créateur, l'utilisateur a généralement les droits via RLS.
            const { error: memberError } = await supabase.from('group_members').upsert({
                group_id: groupData.id,
                user_id: session.user.id,
                role: 'admin'
            }, { onConflict: 'group_id,user_id' });

            if (memberError) {
                console.error("Member assignment error:", memberError);
                // Si l'upsert échoue, on tente un simple insert
                const { error: secondAttemptError } = await supabase.from('group_members').insert({
                    group_id: groupData.id,
                    user_id: session.user.id,
                    role: 'admin'
                });
                if (secondAttemptError) {
                   await supabase.from('groups').delete().eq('id', groupData.id);
                   throw new Error("Impossible d'assigner les droits d'administration. Veuillez réessayer.");
                }
            }
        }
        
        onClose();

    } catch (err: any) {
        setError(err.message || "Une erreur est survenue.");
        console.error(err);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div ref={modalRef} className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-lg w-full transform transition-all animate-fade-in-up">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Créer un groupe</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"><X size={24} /></button>
        </div>
        
        {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm font-bold border border-red-100">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-5">
            <div>
                <label className="block text-slate-700 text-xs font-black uppercase tracking-widest mb-2 ml-1" htmlFor="groupName">Nom du groupe</label>
                <input
                    id="groupName"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-slate-50 border border-slate-100 text-slate-900 text-sm rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none block w-full p-4 transition-all"
                    placeholder="Ex: Club de robotique"
                    required
                />
            </div>
            <div>
                <label className="block text-slate-700 text-xs font-black uppercase tracking-widest mb-2 ml-1" htmlFor="groupDescription">Description</label>
                <textarea
                    id="groupDescription"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="bg-slate-50 border border-slate-100 text-slate-900 text-sm rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none block w-full p-4 resize-none transition-all"
                    placeholder="De quoi parle ce groupe ?"
                />
            </div>
            <div>
                <label className="block text-slate-700 text-xs font-black uppercase tracking-widest mb-2 ml-1">Visibilité</label>
                <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-2xl">
                    <button type="button" onClick={() => setIsPrivate(false)} className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${!isPrivate ? 'bg-white text-isig-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Globe size={18} />
                        <span>Public</span>
                    </button>
                    <button type="button" onClick={() => setIsPrivate(true)} className={`flex items-center justify-center space-x-2 py-3 px-4 rounded-xl text-sm font-bold transition-all ${isPrivate ? 'bg-white text-isig-blue shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                         <Lock size={18} />
                         <span>Privé</span>
                    </button>
                </div>
            </div>
             <div>
                <label className="block text-slate-700 text-xs font-black uppercase tracking-widest mb-2 ml-1">Photo du groupe</label>
                <div className="mt-2 flex items-center space-x-6">
                    <div className="relative group">
                      <div className="h-24 w-24 rounded-[1.5rem] overflow-hidden bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center">
                          {previewUrl ? 
                              <img src={previewUrl} alt="Aperçu" className="h-full w-full object-cover" /> :
                              <Upload className="text-slate-300" size={32} />
                          }
                      </div>
                    </div>
                    <label htmlFor="file-upload" className="cursor-pointer bg-isig-blue/10 text-isig-blue px-6 py-3 rounded-2xl text-sm font-black hover:bg-isig-blue hover:text-white transition-all">
                        <span>Choisir une image</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
                    </label>
                </div>
            </div>
            <div className="flex space-x-3 mt-8">
                <button type="button" onClick={onClose} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-all">Annuler</button>
                <button type="submit" disabled={loading} className="flex-[2] bg-isig-blue text-white font-black py-4 rounded-2xl shadow-lg shadow-isig-blue/20 hover:bg-blue-600 transition-all disabled:opacity-50 active:scale-95">
                    {loading ? <Spinner /> : 'Créer maintenant'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;
