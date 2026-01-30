
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

export default Skeleton;
