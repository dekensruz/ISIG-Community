
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Paperclip, X, FileText, Sparkles, Wand2 } from 'lucide-react';
import { improveAcademicPost } from '../services/gemini';
import Spinner from './Spinner';

interface CreatePostProps {
  onPostCreated: () => void;
}

const CreatePost: React.FC<CreatePostProps> = ({ onPostCreated }) => {
  const { session } = useAuth();
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [improving, setImproving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
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
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleImprove = async () => {
    if (!content.trim()) return;
    setImproving(true);
    try {
        const improved = await improveAcademicPost(content);
        setContent(improved);
    } catch (err) {
        console.error(err);
    } finally {
        setImproving(false);
    }
  };

  const handlePost = async () => {
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
    setUploading(false);
  };
  
  return (
    <div className="bg-white p-6 rounded-[2rem] shadow-soft border border-slate-100 animate-fade-in-up">
      <div className="relative">
        <textarea
            className="w-full p-5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-isig-blue outline-none resize-none font-medium text-slate-700 min-h-[120px] transition-all"
            placeholder="Partagez une astuce, une question ou un projet..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
        />
        {content.length > 10 && (
            <button 
                onClick={handleImprove}
                disabled={improving}
                className="absolute bottom-4 right-4 flex items-center space-x-2 px-4 py-2 bg-white/80 backdrop-blur shadow-sm rounded-xl text-isig-blue font-bold text-xs hover:bg-isig-blue hover:text-white transition-all border border-isig-blue/10 disabled:opacity-50"
                title="Améliorer avec l'IA"
            >
                {improving ? <Spinner /> : <Sparkles size={14} />}
                <span>{improving ? 'Optimisation...' : 'Améliorer'}</span>
            </button>
        )}
      </div>
      
      {file && (
        <div className="mt-4 relative inline-block group">
            {previewUrl ? (
                <img src={previewUrl} alt="Aperçu" className="rounded-2xl max-h-48 w-auto shadow-md" />
            ) : (
                <div className="flex items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <FileText className="text-isig-blue mr-3" />
                    <p className="text-sm font-bold text-slate-600 truncate max-w-[200px]">{file.name}</p>
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
          disabled={uploading || (!content.trim() && !file)}
          className="bg-isig-orange text-white font-black py-3 px-8 rounded-2xl shadow-lg shadow-isig-orange/20 hover:bg-orange-600 transition-all active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs"
        >
          {uploading ? 'Envoi...' : 'Publier'}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs font-bold mt-3 ml-2">{error}</p>}
    </div>
  );
};

export default CreatePost;
