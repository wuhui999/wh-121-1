import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useUIStore } from '@/store';
import { cn } from '@/lib/utils';

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const styles = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const iconStyles = {
  success: 'text-green-500',
  error: 'text-red-500',
  info: 'text-blue-500',
};

export default function Toast() {
  const { toast, hideToast } = useUIStore();

  if (!toast) {
    return null;
  }

  const Icon = icons[toast.type];
  const style = styles[toast.type];
  const iconStyle = iconStyles[toast.type];

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg',
          style
        )}
      >
        <Icon className={cn('w-5 h-5 flex-shrink-0', iconStyle)} />
        <p className="text-sm font-medium">{toast.message}</p>
        <button
          onClick={hideToast}
          className="ml-2 p-0.5 rounded hover:bg-black/5 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
