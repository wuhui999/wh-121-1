import { useState, useRef, useEffect, createContext, useContext, type ReactNode, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Check } from 'lucide-react';

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  placeholder?: string;
  className?: string;
}

interface SelectContextType {
  value: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  onValueChange: (value: string) => void;
}

const SelectContext = createContext<SelectContextType | null>(null);

function useSelect() {
  const context = useContext(SelectContext);
  if (!context) throw new Error('Select components must be used within a Select');
  return context;
}

export function Select({ value, onValueChange, children, className }: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <SelectContext.Provider value={{ value, open, setOpen, onValueChange }}>
      <div ref={ref} className={cn('relative', className)}>
        {children}
      </div>
    </SelectContext.Provider>
  );
}

interface SelectTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  const { open, setOpen } = useSelect();
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
        open && 'ring-2 ring-blue-500 border-transparent',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
    </button>
  );
}

interface SelectValueProps {
  placeholder?: string;
}

export function SelectValue({ placeholder }: SelectValueProps) {
  const { value } = useSelect();
  if (!value && placeholder) {
    return <span className="text-gray-400">{placeholder}</span>;
  }
  return <span>{value}</span>;
}

interface SelectContentProps {
  children: ReactNode;
  className?: string;
}

export function SelectContent({ children, className }: SelectContentProps) {
  const { open } = useSelect();
  if (!open) return null;
  return (
    <div
      className={cn(
        'absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto',
        className
      )}
    >
      {children}
    </div>
  );
}

interface SelectItemProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function SelectItem({ value, children, className }: SelectItemProps) {
  const { value: selectedValue, onValueChange, setOpen } = useSelect();
  const isSelected = value === selectedValue;
  return (
    <button
      type="button"
      onClick={() => {
        onValueChange(value);
        setOpen(false);
      }}
      className={cn(
        'flex w-full items-center px-3 py-2 text-sm hover:bg-gray-100 text-left',
        isSelected && 'bg-blue-50 text-blue-600',
        className
      )}
    >
      <span className="flex-1">{children}</span>
      {isSelected && <Check className="w-4 h-4" />}
    </button>
  );
}
