
import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    circle?: boolean;
}

const Skeleton: React.FC<SkeletonProps> = ({ className, circle, ...props }) => {
  return (
    <div
      className={cn(
        "animate-pulse bg-slate-200 dark:bg-slate-700",
        circle ? "rounded-full" : "rounded-xl",
        className
      )}
      {...props}
    />
  );
};

export const ChatSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col space-y-4 p-4 w-full h-full justify-end">
      {/* Received Message */}
      <div className="flex items-end gap-2">
        <Skeleton circle className="w-8 h-8" />
        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-none p-3 max-w-[70%]">
           <Skeleton className="h-3 w-32 mb-2" />
           <Skeleton className="h-3 w-20" />
        </div>
      </div>
      
      {/* Sent Message */}
      <div className="flex items-end gap-2 justify-end">
        <div className="bg-slate-200 dark:bg-slate-700 rounded-2xl rounded-br-none p-3 max-w-[70%]">
           <Skeleton className="h-3 w-40 mb-2" />
           <Skeleton className="h-3 w-24" />
        </div>
      </div>

      {/* Received Message with Media */}
      <div className="flex items-end gap-2">
        <Skeleton circle className="w-8 h-8" />
        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-none p-2 max-w-[70%]">
           <Skeleton className="h-32 w-48 rounded-xl" />
        </div>
      </div>
    </div>
  );
};

export default Skeleton;
