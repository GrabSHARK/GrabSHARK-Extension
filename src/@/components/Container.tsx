import { FC } from 'react';

interface ContainerProps {
  children: React.ReactNode;
}

const Container: FC<ContainerProps> = ({ children }) => {
  return <div className="flex flex-col w-[396px] h-full px-6 py-4 bg-void-island backdrop-blur-xl rounded-[24px] border border-void-border/60 shadow-[0_8px_32px_0_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.8)] relative z-10 transition-all duration-300">{children}</div>;
};

export default Container;
