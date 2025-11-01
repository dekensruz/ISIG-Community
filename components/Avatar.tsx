import React from 'react';

interface AvatarProps {
  avatarUrl?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
  shape?: 'circle' | 'square';
}

const Avatar: React.FC<AvatarProps> = ({ avatarUrl, name, size = 'md', className = '', shape = 'circle' }) => {
  const getInitials = (fullName: string) => {
    if (!fullName) return '?';
    const names = fullName.trim().split(' ');
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (names[0].charAt(0) + names[names.length - 1].charAt(0)).toUpperCase();
  };
  
  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-xl',
    '2xl': 'h-24 w-24 text-3xl',
    '3xl': 'h-32 w-32 text-5xl',
  };
  
  const shapeClasses = {
    circle: 'rounded-full',
    square: 'rounded-lg',
  }

  const colorClasses = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500', 
    'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500',
    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500',
    'bg-pink-500', 'bg-rose-500'
  ];

  // Simple hash function to get a consistent color for a name
  const getColor = (str: string) => {
    if (!str) return colorClasses[0];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colorClasses.length);
    return colorClasses[index];
  };

  const finalClassName = `${sizeClasses[size]} ${shapeClasses[shape]} ${className}`;

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${finalClassName} object-cover bg-slate-200`}
      />
    );
  }

  return (
    <div
      className={`${finalClassName} flex items-center justify-center font-bold text-white ${getColor(name)}`}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
};

export default Avatar;
