
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Paperclip, X, FileText, Send } from 'lucide-react';
import { GroupPost } from '../types';

interface CreateGroupPostProps {
  groupId: string;
  onPostCreated: (newPost?: GroupPost) => void;
}

const CreateGroupPost: React.FC<CreateGroupPostProps> = ({ groupId, onPostCreated }) => {
  const { session } = useAuth();
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(selectedFile));
      } else {
        setPreviewUrl(null);
      }
    } else {
      setFile(null);
      setPreviewUrl(null);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !file) {
      setError("La publication ne peut pas être vide.");
      return;
    }
    if (!session?.user) {
      setError("Vous devez être connecté pour publier.");
      return;
    }

    setUploading(true);
    setError(null);

    let mediaUrl: string | undefined = undefined;
    let mediaType: string | undefined = undefined;

    try {
        if (file) {
          const fileExt = file.name.split('.').pop();
          const fileName = `group-media/${groupId}/${session.user.id}-${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage.from('media').upload(fileName, file);
          if (uploadError) throw uploadError;
          const { data } = supabase.storage.from('media').getPublicUrl(fileName);
          mediaUrl = data.publicUrl;
          mediaType = file.type;
        }

        const { data, error: insertError } = await supabase.from('group_posts').insert({
          user_id: session.user.id,
          group_id: groupId,
          content,
          media_url: mediaUrl,
          media_type: mediaType
        }).select(`*, profiles(*), group_post_comments(*, profiles(*)), group_post_likes(*)`).single();

        if (insertError) throw insertError;
        
        setContent('');
        handleRemoveFile();
        onPostCreated(data as any);
    } catch (err: any) {
        setError(err.message);
    } finally {
        setUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };
  
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <form onSubmit={handlePost}>
        <textarea
            className="w-full p-3 bg-slate-50 border-slate-200 border rounded-xl focus:outline-none focus:ring-2 focus:ring-isig-blue resize-none font-medium"
            rows={3}
            placeholder="Partagez quelque chose avec le groupe..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
        />
        
        {file && (
            <div className="mt-2 relative inline-block">
                {previewUrl ? (
                    <img src={previewUrl} alt="Aperçu" className="rounded-lg max-h-40 w-auto" />
                ) : (
                    <div className="flex items-center p-2 bg-slate-100 rounded-lg">
                        <FileText className="text-slate-500 mr-2" />
                        <p className="text-sm text-slate-600 max-w-[150px] truncate">{file.name}</p>
                    </div>
                )}
                <button type="button" onClick={handleRemoveFile} className="absolute -top-2 -right-2 bg-slate-700 text-white rounded-full p-0.5 hover:bg-slate-900 transition-colors z-10">
                    <X size={16} />
                </button>
            </div>
        )}

        <div className="flex justify-between items-center mt-2">
            <button 
              type="button" 
              onClick={triggerFileInput} 
              className="text-slate-500 hover:text-isig-blue p-2 rounded-full hover:bg-slate-100 transition-all"
              title="Ajouter un fichier"
            >
                <Paperclip size={24} />
                <input 
                  id="group-file-upload" 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                />
            </button>
            <button type="submit" disabled={uploading || (!content.trim() && !file)} className="bg-isig-orange text-white font-black py-2 px-6 rounded-lg hover:bg-orange-600 transition-all disabled:opacity-50 flex items-center shadow-lg shadow-isig-orange/20 uppercase tracking-widest text-xs">
                {uploading ? 'Envoi...' : <><Send size={14} className="mr-2"/>Publier</>}
            </button>
        </div>
      </form>
      {error && <p className="text-red-500 text-xs font-bold mt-2">{error}</p>}
    </div>
  );
};

export default CreateGroupPost;
