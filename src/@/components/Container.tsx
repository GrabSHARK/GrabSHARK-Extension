import { FC } from 'react';

interface ContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

const Container: FC<ContainerProps> = ({ children, className = '', ...props }) => {
  return <div className={`flex flex-col w-[396px] max-w-[396px] min-h-0 px-6 py-4 bg-void-island backdrop-blur-xl rounded-[24px] border border-void-border/60 shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.8)] relative z-10 transition-all duration-300 ${className}`.trim()} {...props}>{children}</div>;
};

export default Container;
