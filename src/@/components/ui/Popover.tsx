import * as React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import { cn } from '../../lib/utils.ts';

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & { portal?: boolean; container?: HTMLElement | null | undefined }
>(({ className, align = 'start', sideOffset = 4, ...props }, ref) => {
  // Check if we are in a shadow DOM context (hacky check: if extension context and content script)
  // or just allow passing a prop. Let's look for a prop 'forceMount' or similar?
  // Actually, let's just add a custom prop `disablePortal`.
  // Typescript might complain if I add it to props destructuring directly if not defined in type.
  // But ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> doesn't have it.
  // So I need to intersection type it.

  const { portal = true, container, ...otherProps } = props as any;

  const content = (
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-[9999] min-w-full inset-x-0 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...otherProps}
    />
  );

  if (portal) {
    return <PopoverPrimitive.Portal container={container}>{content}</PopoverPrimitive.Portal>;
  }
  return content;
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

const PopoverAnchor = PopoverPrimitive.Anchor;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
