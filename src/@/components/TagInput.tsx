import * as React from 'react';
import { X, CaretDown } from '@phosphor-icons/react';
import { Command, CommandGroup, CommandItem, CommandList } from './ui/Command';
import { cn } from '../lib/utils';
import { Popover, PopoverContent, PopoverTrigger, PopoverAnchor } from './ui/Popover';
import { useTranslation } from 'react-i18next';

interface Tag {
  id?: number;
  name: string;
  _count?: { links: number };
  parent?: { id: number; name: string } | null;
  parentId?: number | null;
}

interface TagInputProps {
  value: { name: string; id?: number }[];
  onChange: (tags: { name: string; id?: number }[]) => void;
  tags: Tag[];
  className?: string;
  placeholder?: string;
  containerRef?: HTMLElement | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

// Helper to build full path for display (e.g., "Parent > Child")
function getTagPath(tag: Tag, allTags: Tag[]): string {
  const path: string[] = [tag.name];
  let currentTag = tag;

  while (currentTag.parentId) {
    const parent = allTags.find((t) => t.id === currentTag.parentId);
    if (parent) {
      path.unshift(parent.name);
      currentTag = parent;
    } else {
      break;
    }
  }

  return path.join(' > ');
}

export function TagInput({ value, onChange, tags, className, placeholder, containerRef, open: controlledOpen, onOpenChange }: TagInputProps) {
  const { t } = useTranslation();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const updateOpen = (newOpen: boolean | ((prevState: boolean) => boolean)) => {
    const nextValue = typeof newOpen === 'function' ? newOpen(open!) : newOpen;
    if (!isControlled) {
      setInternalOpen(nextValue);
    }
    if (onOpenChange) {
      onOpenChange(nextValue);
    }
  };

  const [searchValue, setSearchValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const ignoreNextOpenChange = React.useRef(false);

  const safeTags = Array.isArray(tags) ? tags : [];

  // Filter tags: exclude already selected + match search term
  const filteredTags = safeTags.filter(tag => {
    const isSelected = value.some(v => v.name === tag.name);
    if (isSelected) return false; // Hide already selected tags
    if (!searchValue) return true;
    return tag.name.toLowerCase().includes(searchValue.toLowerCase());
  });

  const handleSelect = (tag: Tag) => {
    onChange([...value, { name: tag.name, id: tag.id }]);
    setSearchValue('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleRemove = (e: React.MouseEvent, tagToRemove: { name: string }) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(value.filter(tag => tag.name !== tagToRemove.name));
  };

  const handleCreateNew = () => {
    if (searchValue && !safeTags.some(t => t.name.toLowerCase() === searchValue.toLowerCase())) {
      onChange([...value, { name: searchValue }]);
      setSearchValue('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue) {
      e.preventDefault();
      const existingTag = safeTags.find(t => t.name.toLowerCase() === searchValue.toLowerCase());
      if (existingTag && !value.some(v => v.name === existingTag.name)) {
        handleSelect(existingTag);
      } else if (!existingTag) {
        handleCreateNew();
      }
    }
    if (e.key === 'Backspace' && !searchValue && value.length > 0) {
      const newValue = [...value];
      newValue.pop();
      onChange(newValue);
    }
    if (e.key === 'Escape') {
      updateOpen(false);
      inputRef.current?.blur();
    }
    // Open dropdown when user starts typing
    if (!open && searchValue.length === 0 && e.key.length === 1) {
      updateOpen(true);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchValue(newValue);
    // Only open dropdown when user types something
    if (newValue.length > 0 && !open) {
      updateOpen(true);
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Set flag to ignore next onOpenChange from Popover
    ignoreNextOpenChange.current = true;
    updateOpen(prev => !prev);
    // Reset flag after a short delay
    setTimeout(() => {
      ignoreNextOpenChange.current = false;
    }, 100);
  };

  const handleOpenChange = (newOpen: boolean) => {
    // If chevron was just clicked, ignore this callback
    if (ignoreNextOpenChange.current) {
      return;
    }
    updateOpen(newOpen);
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    // Only focus input, don't open dropdown
    e.stopPropagation();
    inputRef.current?.focus();
  };

  const searchMatchesExisting = safeTags.some(
    t => t.name.toLowerCase() === searchValue.toLowerCase()
  );

  // Check if the matching tag is already selected
  const searchMatchesSelected = value.some(
    v => v.name.toLowerCase() === searchValue.toLowerCase()
  );

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverAnchor asChild>
        <div
          className={cn(
            "flex items-center gap-1.5 min-h-[44px] w-full px-3 py-2 rounded-xl border cursor-text",
            "bg-white dark:bg-[#1a1a1c] border-zinc-200 dark:border-zinc-800/50",
            "hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors",
            className
          )}
        >
          {/* PopoverTrigger only wraps the interactive input area */}
          <PopoverTrigger asChild>
            <div
              role="combobox"
              aria-expanded={open}
              className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0"
              onClick={handleContainerClick}
            >
              {/* Selected Tag Pills */}
              {value.map((tag) => (
                <span
                  key={tag.name}
                  className="inline-flex items-center gap-1 bg-blue-600 text-white pl-2.5 pr-1 py-1 rounded-full text-xs font-medium"
                >
                  {tag.name}
                  <button
                    type="button"
                    onClick={(e) => handleRemove(e, tag)}
                    className="ml-0.5 p-0.5 rounded-full hover:bg-blue-500 hover:text-white transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}

              {/* Inline Input */}
              <input
                ref={inputRef}
                type="text"
                value={searchValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={value.length === 0 ? (placeholder || t('tagInput.placeholder')) : ""}
                className="flex-1 min-w-[80px] bg-transparent outline-none text-sm text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-500 dark:placeholder:text-zinc-400"
              />
            </div>
          </PopoverTrigger>

          {/* Chevron - OUTSIDE PopoverTrigger */}
          <button
            type="button"
            onPointerDown={handleChevronClick}
            className="shrink-0 p-0.5 rounded hover:bg-transparent transition-colors"
          >
            <CaretDown className={cn("h-5 w-5 text-zinc-400 dark:text-zinc-500 transition-transform duration-200", open && "rotate-180")} />
          </button>
        </div>
      </PopoverAnchor>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 rounded-xl overflow-hidden border-zinc-200 dark:border-zinc-800 shadow-lg bg-white dark:bg-[#1a1a1c]"
        align="start"
        portal={true}
        container={containerRef}
        sideOffset={2}
        onOpenAutoFocus={(e) => {
          // Prevent focus from moving to dropdown - keep it on input
          e.preventDefault();
        }}
      >
        <Command className="dark:bg-[#1a1a1c] h-fit" shouldFilter={false}>
          <CommandList className="max-h-[220px] overflow-y-auto overscroll-contain p-1">
            {filteredTags.length === 0 && !searchValue && (
              <div className="py-2 px-3 text-start text-zinc-500 text-sm">
                {t('tagInput.noMoreTags')}
              </div>
            )}

            {filteredTags.length === 0 && searchValue && searchMatchesSelected && (
              <div className="py-2 px-3 text-start text-zinc-500 text-sm">
                {t('tagInput.tagAlreadySelected')}
              </div>
            )}

            {(filteredTags.length > 0 || (searchValue && !searchMatchesExisting && !searchMatchesSelected)) && (
              <CommandGroup>
                {filteredTags.map((tag) => {
                  const tagPath = getTagPath(tag, safeTags);
                  const linkCount = tag._count?.links || 0;
                  const hasHierarchy = tagPath !== tag.name;

                  return (
                    <CommandItem
                      key={tag.id || tag.name}
                      value={tag.name}
                      onSelect={() => handleSelect(tag)}
                      className="flex flex-col items-start justify-start gap-0.5 px-2 py-2 rounded-xl cursor-pointer my-0.5 data-[selected=true]:bg-zinc-100 data-[selected=true]:text-zinc-900 dark:data-[selected=true]:bg-zinc-800 dark:data-[selected=true]:text-zinc-100"
                    >
                      {/* Top row: Name + Count */}
                      <div className="flex w-full items-center gap-2">
                        <span className="flex-1 text-sm font-medium">{tag.name}</span>
                        {linkCount > 0 && (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400 aria-selected:text-zinc-500">
                            {linkCount}
                          </span>
                        )}
                      </div>

                      {/* Bottom row: Hierarchy path */}
                      {hasHierarchy && (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400 aria-selected:text-zinc-500">
                          {tagPath}
                        </span>
                      )}
                    </CommandItem>
                  );
                })}

                {/* Create New Option - only show when typing new value that doesn't exist */}
                {searchValue && !searchMatchesExisting && !searchMatchesSelected && (
                  <CommandItem
                    value={`create-${searchValue}`}
                    onSelect={handleCreateNew}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer mx-0.5 my-0.5 data-[selected=true]:bg-green-600 data-[selected=true]:text-white"
                  >
                    <span>{t('tagInput.create')} "<span className="font-semibold">{searchValue}</span>"</span>
                  </CommandItem>
                )}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
