// Fix: Implemented the full component to resolve module errors.
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

        // Insert group
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

        // Add creator as an admin member
        if (groupData) {
            const { error: memberError } = await supabase.from('group_members').insert({
                group_id: groupData.id,
                user_id: session.user.id,
                role: 'admin' // Assign admin role to creator
            });
            if (memberError) {
                console.error("Failed to add creator as admin member:", memberError);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-isig-blue">Créer un nouveau groupe</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
        </div>
        
        {error && <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">{error}</p>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="groupName">
                    Nom du groupe
                </label>
                <input
                    id="groupName"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-isig-blue focus:border-isig-blue block w-full p-2.5"
                    required
                />
            </div>
            <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="groupDescription">
                    Description (facultatif)
                </label>
                <textarea
                    id="groupDescription"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-isig-blue focus:border-isig-blue block w-full p-2.5 resize-none"
                />
            </div>
            <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">Confidentialité</label>
                <div className="flex rounded-md shadow-sm">
                    <button type="button" onClick={() => setIsPrivate(false)} className={`relative inline-flex items-center space-x-2 px-4 py-2 rounded-l-md border text-sm font-medium ${!isPrivate ? 'bg-isig-blue text-white border-isig-blue z-10' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                        <Globe size={16} />
                        <span>Public</span>
                    </button>
                    <button type="button" onClick={() => setIsPrivate(true)} className={`relative -ml-px inline-flex items-center space-x-2 px-4 py-2 rounded-r-md border text-sm font-medium ${isPrivate ? 'bg-isig-blue text-white border-isig-blue z-10' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                         <Lock size={16} />
                         <span>Privé</span>
                    </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">{isPrivate ? "Les membres doivent être approuvés par un admin." : "Tout le monde peut rejoindre ce groupe."}</p>
            </div>
             <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                    Avatar du groupe (facultatif)
                </label>
                <div className="mt-1 flex items-center space-x-4">
                    <span className="inline-block h-20 w-20 rounded-lg overflow-hidden bg-gray-100">
                        {previewUrl ? 
                            <img src={previewUrl} alt="Aperçu de l'avatar" className="h-full w-full object-cover" /> :
                            <svg className="h-full w-full text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M24 20.993V24H0v-2.993A2 2 0 002 18h20a2 2 0 002 2.007zM12 13a4 4 0 100-8 4 4 0 000 8z" />
                            </svg>
                        }
                    </span>
                    <label htmlFor="file-upload" className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-isig-blue flex items-center">
                        <Upload size={16} className="mr-2" />
                        <span>Changer</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
                    </label>
                </div>
            </div>
            <div className="text-right mt-6">
                <button 
                    type="button" 
                    onClick={onClose} 
                    className="mr-2 text-gray-700 bg-transparent hover:bg-gray-200 font-medium rounded-lg text-sm px-5 py-2.5 text-center"
                >
                    Annuler
                </button>
                <button 
                    type="submit"
                    disabled={loading}
                    className="text-white bg-isig-blue hover:bg-blue-600 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-blue-300"
                >
                    {loading ? <Spinner /> : 'Créer le groupe'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroupModal;