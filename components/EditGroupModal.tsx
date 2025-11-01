import React, { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabase';
import Spinner from './Spinner';
import { X, Upload, Trash2, Lock, Globe } from 'lucide-react';
import { Group } from '../types';

interface EditGroupModalProps {
  group: Group;
  onClose: () => void;
  onGroupUpdated: () => void;
  onGroupDeleted: () => void;
}

const EditGroupModal: React.FC<EditGroupModalProps> = ({ group, onClose, onGroupUpdated, onGroupDeleted }) => {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description || '');
  const [isPrivate, setIsPrivate] = useState(group.is_private);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(group.avatar_url || null);
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (previewUrl && !previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);

    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setAvatarFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setAvatarFile(null);
      setPreviewUrl(group.avatar_url || null);
    }
  };
  
  const handleDeleteGroup = async () => {
    if (window.confirm(`Voulez-vous vraiment supprimer le groupe "${group.name}" ? Cette action est irréversible et supprimera toutes les publications associées.`)) {
        setLoading(true);
        const { error } = await supabase.from('groups').delete().eq('id', group.id);
        setLoading(false);
        if (error) {
            setError('Erreur lors de la suppression du groupe: ' + error.message);
        } else {
            alert('Groupe supprimé avec succès.');
            onGroupDeleted();
            onClose();
        }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
        setError("Le nom du groupe est obligatoire.");
        return;
    }
    setLoading(true);
    setError(null);

    try {
        let avatarUrl: string | undefined = group.avatar_url;
        if (avatarFile) {
            const fileExt = avatarFile.name.split('.').pop();
            const fileName = `group-avatars/${group.id}-${Date.now()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, avatarFile, { upsert: true });
            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
            avatarUrl = data.publicUrl;
        }

        const { error: updateError } = await supabase
            .from('groups')
            .update({
                name,
                description,
                avatar_url: avatarUrl,
                is_private: isPrivate,
            })
            .eq('id', group.id);
        
        if (updateError) throw updateError;
        
        onGroupUpdated();
        onClose();

    } catch (err: any) {
        setError(err.message || "Une erreur est survenue.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-isig-blue">Modifier le groupe</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
        </div>
        
        {error && <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">{error}</p>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="groupName">Nom du groupe</label>
                <input id="groupName" type="text" value={name} onChange={(e) => setName(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-isig-blue focus:border-isig-blue block w-full p-2.5" required/>
            </div>
            <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="groupDescription">Description</label>
                <textarea id="groupDescription" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-isig-blue focus:border-isig-blue block w-full p-2.5 resize-none"/>
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
            </div>
             <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">Avatar du groupe</label>
                <div className="mt-1 flex items-center space-x-4">
                    <span className="inline-block h-20 w-20 rounded-lg overflow-hidden bg-gray-100">
                        {previewUrl ? 
                            <img src={previewUrl} alt="Aperçu de l'avatar" className="h-full w-full object-cover" /> :
                            <div className="h-full w-full bg-slate-200"></div>
                        }
                    </span>
                    <label htmlFor="file-upload-edit" className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center">
                        <Upload size={16} className="mr-2" />
                        <span>Changer</span>
                        <input id="file-upload-edit" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
                    </label>
                </div>
            </div>
            <div className="flex justify-end items-center mt-6 pt-4 border-t">
                <button type="button" onClick={onClose} className="mr-2 text-gray-700 bg-transparent hover:bg-gray-200 font-medium rounded-lg text-sm px-5 py-2.5 text-center">Annuler</button>
                <button type="submit" disabled={loading} className="text-white bg-isig-blue hover:bg-blue-600 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:bg-blue-300">
                    {loading ? <Spinner /> : 'Enregistrer'}
                </button>
            </div>
        </form>
         <div className="border-t border-red-200 pt-4 mt-4">
            <h3 className="font-bold text-red-600">Zone de danger</h3>
            <p className="text-sm text-slate-500 mt-1 mb-3">La suppression d'un groupe est une action définitive et ne peut pas être annulée.</p>
            <button 
                type="button" 
                onClick={handleDeleteGroup}
                disabled={loading}
                className="w-full sm:w-auto text-white bg-red-600 hover:bg-red-700 font-medium rounded-lg text-sm px-5 py-2.5 text-center flex items-center justify-center disabled:bg-red-400"
            >
                <Trash2 size={16} className="mr-2"/>
                {loading ? 'Suppression...' : 'Supprimer ce groupe'}
            </button>
        </div>
      </div>
    </div>
  );
};

export default EditGroupModal;