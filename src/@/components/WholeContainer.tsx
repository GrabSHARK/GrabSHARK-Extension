import { FC } from 'react';
import { cn } from '../lib/utils.ts';

interface WholeContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

const WholeContainer: FC<WholeContainerProps> = ({ children, className, ...props }) => {
  return (
    <div className={cn('w-full min-h-0 flex justify-center bg-void-bg p-3 relative overflow-hidden', className)} {...props}>
      {children}
    </div>
  );
};

export default WholeContainer;
