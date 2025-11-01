import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../App';
import { Paperclip, X, FileText } from 'lucide-react';

interface CreatePostProps {
  onPostCreated: () => void;
}

const CreatePost: React.FC<CreatePostProps> = ({ onPostCreated }) => {
  const { session } = useAuth();
  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up the object URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
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
    // Reset file input using ref
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
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
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      <textarea
        className="w-full p-2 bg-slate-50 border-slate-200 border rounded-md focus:outline-none focus:ring-2 focus:ring-isig-blue resize-none"
        rows={3}
        placeholder="À quoi pensez-vous ?"
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
                    <p className="text-sm text-slate-600">{file.name}</p>
                </div>
            )}
            <button
              onClick={handleRemoveFile}
              className="absolute -top-2 -right-2 bg-slate-700 text-white rounded-full p-0.5 hover:bg-slate-900 transition-colors"
              aria-label="Supprimer le fichier"
            >
              <X size={16} />
            </button>
        </div>
      )}

      <div className="flex justify-between items-center mt-2">
        <div className="flex space-x-2">
           <label htmlFor="file-upload" className="cursor-pointer text-slate-500 hover:text-isig-blue p-2 rounded-full hover:bg-slate-100">
            <Paperclip size={24} />
            <input id="file-upload" type="file" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          </label>
        </div>
        <button
          onClick={handlePost}
          disabled={uploading}
          className="bg-isig-orange text-white font-bold py-2 px-6 rounded-lg hover:bg-orange-600 transition-colors disabled:bg-orange-300"
        >
          {uploading ? 'Publication...' : 'Publier'}
        </button>
      </div>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
};

export default CreatePost;