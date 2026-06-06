import { EQUIPMENT_STATUS, ORDER_STATUS, REPAIR_STATUS } from '@/lib/api';
import { cn } from '@/lib/utils';

type StatusType = 'equipment' | 'order' | 'repair';

interface StatusBadgeProps {
  type: StatusType;
  status: string;
  className?: string;
}

const equipmentStyles: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  reserved: 'bg-yellow-100 text-yellow-700',
  lent: 'bg-blue-100 text-blue-700',
  repairing: 'bg-orange-100 text-orange-700',
  maintenance: 'bg-purple-100 text-purple-700',
};

const orderStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  lent: 'bg-indigo-100 text-indigo-700',
  returned: 'bg-teal-100 text-teal-700',
  settled: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

const repairStyles: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  repairing: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  scrapped: 'bg-red-100 text-red-700',
};

const statusMap: Record<StatusType, Record<string, string>> = {
  equipment: EQUIPMENT_STATUS,
  order: ORDER_STATUS,
  repair: REPAIR_STATUS,
};

const styleMap: Record<StatusType, Record<string, string>> = {
  equipment: equipmentStyles,
  order: orderStyles,
  repair: repairStyles,
};

export default function StatusBadge({ type, status, className }: StatusBadgeProps) {
  const label = statusMap[type][status] || status;
  const style = styleMap[type][status] || 'bg-gray-100 text-gray-700';

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        style,
        className
      )}
    >
      {label}
    </span>
  );
}
