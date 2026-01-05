
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Post as PostType } from '../types';
import { Paperclip, X, FileText, Send, RotateCcw } from 'lucide-react';
import Spinner from './Spinner';

interface CreatePostProps {
  onPostCreated: () => void;
  editingPost?: PostType | null;
  onCancelEdit?: () => void;
}

const CreatePost: React.FC<CreatePostProps> = ({ onPostCreated, editingPost, onCancelEdit }) => {
  const { session } = useAuth();
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger le post en cours d'édition
  useEffect(() => {
    if (editingPost) {
      setContent(editingPost.content);
      if (editingPost.media_url && editingPost.media_type === 'image') {
        setPreviewUrl(editingPost.media_url);
      } else {
        setPreviewUrl(null);
      }
    } else {
        setContent('');
        setPreviewUrl(null);
        setFile(null);
    }
  }, [editingPost]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
    }

    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(selectedFile));
      }
    } else {
        setFile(null);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handlePost = async () => {
    if (!content.trim() && !file && !previewUrl) {
      setError("La publication ne peut pas être vide.");
      return;
    }
    if (!session?.user) {
      setError("Vous devez être connecté pour publier.");
      return;
    }

    setUploading(true);
    setError(null);

    let mediaUrl: string | undefined = editingPost?.media_url;
    let mediaType: string | undefined = editingPost?.media_type;

    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${session.user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file);

      if (uploadError) {
        setError(uploadError.message);
        setUploading(false);
        return;
      }

      const { data } = supabase.storage.from('media').getPublicUrl(filePath);
      mediaUrl = data.publicUrl;
      mediaType = file.type.startsWith('image/') ? 'image' : 'document';
    }

    if (editingPost) {
        // Mise à jour
        const { error: updateError } = await supabase
            .from('posts')
            .update({
                content,
                media_url: mediaUrl,
                media_type: mediaType
            })
            .eq('id', editingPost.id);

        if (updateError) {
            setError(updateError.message);
        } else {
            onPostCreated();
        }
    } else {
        // Insertion
        const { error: insertError } = await supabase.from('posts').insert({
            user_id: session.user.id,
            content,
            media_url: mediaUrl,
            media_type: mediaType
        });

        if (insertError) {
            setError(insertError.message);
        } else {
            setContent('');
            handleRemoveFile();
            onPostCreated();
        }
    }
    setUploading(false);
  };
  
  return (
    <div className={`bg-white p-6 rounded-[2rem] shadow-soft border transition-all duration-500 animate-fade-in-up ${editingPost ? 'ring-2 ring-isig-blue border-transparent' : 'border-slate-100'}`}>
      <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              {editingPost ? 'Modification en cours' : 'Nouvelle publication'}
          </h3>
          {editingPost && (
              <button onClick={onCancelEdit} className="flex items-center space-x-1 text-red-500 hover:text-red-600 text-[10px] font-black uppercase tracking-widest">
                  <RotateCcw size={12}/>
                  <span>Annuler</span>
              </button>
          )}
      </div>

      <div className="relative">
        <textarea
            className="w-full p-5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none resize-none font-medium text-slate-700 min-h-[120px] transition-all"
            placeholder="Partagez une astuce, une question ou un projet..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
        />
      </div>
      
      {previewUrl && (
        <div className="mt-4 relative inline-block group">
            {editingPost?.media_type === 'image' || (file && file.type.startsWith('image/')) || previewUrl.startsWith('data:') || previewUrl.startsWith('blob:') || previewUrl.includes('storage') ? (
                <img src={previewUrl} alt="Aperçu" className="rounded-2xl max-h-48 w-auto shadow-md" />
            ) : (
                <div className="flex items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <FileText className="text-isig-blue mr-3" />
                    <p className="text-sm font-bold text-slate-600 truncate max-w-[200px]">{file?.name || 'Fichier attaché'}</p>
                </div>
            )}
            <button
              onClick={handleRemoveFile}
              className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1 shadow-lg hover:bg-red-500 transition-colors"
            >
              <X size={16} />
            </button>
        </div>
      )}

      <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-50">
        <div className="flex space-x-2">
           <label htmlFor="file-upload" className="cursor-pointer text-slate-400 hover:text-isig-blue p-3 rounded-2xl hover:bg-slate-50 transition-all">
            <Paperclip size={24} />
            <input id="file-upload" type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          </label>
        </div>
        <button
          onClick={handlePost}
          disabled={uploading || (!content.trim() && !file && !previewUrl)}
          className={`${editingPost ? 'bg-isig-blue' : 'bg-isig-orange'} text-white font-black py-3.5 px-8 rounded-2xl shadow-lg transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-[10px] flex items-center space-x-2`}
        >
          {uploading ? <Spinner /> : (editingPost ? <><Send size={14}/><span>Mettre à jour</span></> : 'Publier')}
        </button>
      </div>
      {error && <p className="text-red-500 text-[10px] font-bold mt-3 ml-2">{error}</p>}
    </div>
  );
};

export default CreatePost;
