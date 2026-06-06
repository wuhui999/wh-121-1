import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  CheckCircle,
  Wrench,
  Clock,
  ArrowRight,
  DollarSign,
  Calendar,
  Plus,
  User,
  TrendingUp,
  AlertCircle,
  FileText,
  BarChart3,
} from 'lucide-react';
import { api, EQUIPMENT_STATUS, ORDER_STATUS, EQUIPMENT_TYPES } from '@/lib/api';
import { useAuthStore, useUIStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

interface Equipment {
  id: number;
  status: string;
}

interface Order {
  id: number;
  order_no: string;
  equipment: {
    brand: string;
    model: string;
  };
  customer: {
    name: string;
  };
  total_rent: number;
  status: string;
  start_date: string;
  created_at: string;
  settlement?: {
    settlement_date: string;
  };
}

interface Stats {
  totalEquipments: number;
  availableEquipments: number;
  repairingEquipments: number;
  pendingOrders: number;
  lentOrders: number;
  pendingSettlements: number;
  todayIncome: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  const [stats, setStats] = useState<Stats>({
    totalEquipments: 0,
    availableEquipments: 0,
    repairingEquipments: 0,
    pendingOrders: 0,
    lentOrders: 0,
    pendingSettlements: 0,
    todayIncome: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);

  const canManageOrders = user?.role === 'admin' || user?.role === 'clerk';
  const canManageEquipments = user?.role === 'admin' || user?.role === 'clerk';
  const canSettle = user?.role === 'admin' || user?.role === 'finance';

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const [equipmentsRes, ordersRes, settlementsRes] = await Promise.all([
        api.equipments.list(),
        api.orders.list({ pageSize: 100 }),
        api.settlements.list(),
      ]);

      const equipmentData = Array.isArray(equipmentsRes.data)
        ? equipmentsRes.data
        : equipmentsRes.data?.data || [];
      const orderData = Array.isArray(ordersRes.data)
        ? ordersRes.data
        : ordersRes.data?.data || [];
      const settlementData = Array.isArray(settlementsRes.data)
        ? settlementsRes.data
        : settlementsRes.data?.data || [];

      const totalEquipments = equipmentData.length;
      const availableEquipments = equipmentData.filter((e: Equipment) => e.status === 'available').length;
      const repairingEquipments = equipmentData.filter((e: Equipment) => e.status === 'repairing' || e.status === 'maintenance').length;

      const pendingOrders = orderData.filter((o: Order) => o.status === 'pending').length;
      const lentOrders = orderData.filter((o: Order) => o.status === 'lent').length;
      const pendingSettlements = orderData.filter((o: Order) => o.status === 'returned').length;

      const today = new Date().toISOString().split('T')[0];
      const todayIncome = settlementData
        .filter((s: any) => s.settlement_date?.split('T')[0] === today)
        .reduce((sum: number, s: any) => sum + (s.rent || 0), 0);

      setStats({
        totalEquipments,
        availableEquipments,
        repairingEquipments,
        pendingOrders,
        lentOrders,
        pendingSettlements,
        todayIncome,
      });

      setEquipments(equipmentData);
      setRecentOrders(
        orderData
          .sort((a: Order, b: Order) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
      );
    } catch {
      showToast('获取仪表盘数据失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const equipmentStatusData = useMemo(() => {
    const statusCounts: Record<string, number> = {
      available: 0,
      reserved: 0,
      lent: 0,
      repairing: 0,
      maintenance: 0,
    };

    equipments.forEach((e) => {
      if (statusCounts[e.status] !== undefined) {
        statusCounts[e.status]++;
      }
    });

    const total = equipments.length || 1;
    return Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: (count / total) * 100,
    }));
  }, [equipments]);

  const statusBarColors: Record<string, string> = {
    available: 'bg-green-500',
    reserved: 'bg-yellow-500',
    lent: 'bg-blue-500',
    repairing: 'bg-orange-500',
    maintenance: 'bg-purple-500',
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const statCards = [
    {
      title: '器材总数',
      value: stats.totalEquipments,
      icon: Package,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      onClick: () => navigate('/equipments'),
      show: true,
    },
    {
      title: '可用数',
      value: stats.availableEquipments,
      icon: CheckCircle,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      onClick: () => navigate('/equipments'),
      show: true,
    },
    {
      title: '维修中',
      value: stats.repairingEquipments,
      icon: Wrench,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      onClick: () => navigate('/repairs'),
      show: true,
    },
    {
      title: '待确认订单',
      value: stats.pendingOrders,
      icon: Clock,
      color: 'bg-yellow-500',
      bgColor: 'bg-yellow-50',
      onClick: () => navigate('/orders'),
      show: canManageOrders,
    },
    {
      title: '已出借',
      value: stats.lentOrders,
      icon: ArrowRight,
      color: 'bg-indigo-500',
      bgColor: 'bg-indigo-50',
      onClick: () => navigate('/orders'),
      show: canManageOrders,
    },
    {
      title: '待结算',
      value: stats.pendingSettlements,
      icon: FileText,
      color: 'bg-teal-500',
      bgColor: 'bg-teal-50',
      onClick: () => navigate('/settlements'),
      show: canSettle,
    },
    {
      title: '今日收入',
      value: `¥${stats.todayIncome.toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-emerald-500',
      bgColor: 'bg-emerald-50',
      onClick: () => navigate('/settlements'),
      show: canSettle,
    },
  ].filter((card) => card.show);

  const quickActions = [
    {
      label: '新增器材',
      icon: Plus,
      onClick: () => navigate('/equipments'),
      show: canManageEquipments,
      color: 'bg-blue-600 hover:bg-blue-700',
    },
    {
      label: '创建预约',
      icon: Calendar,
      onClick: () => navigate('/orders'),
      show: canManageOrders,
      color: 'bg-green-600 hover:bg-green-700',
    },
    {
      label: '新增维修',
      icon: Wrench,
      onClick: () => navigate('/repairs'),
      show: canManageEquipments,
      color: 'bg-orange-600 hover:bg-orange-700',
    },
    {
      label: '待结算',
      icon: FileText,
      onClick: () => navigate('/settlements'),
      show: canSettle && stats.pendingSettlements > 0,
      color: 'bg-teal-600 hover:bg-teal-700',
      badge: stats.pendingSettlements > 0 ? stats.pendingSettlements : undefined,
    },
  ].filter((action) => action.show);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            欢迎回来，{user?.name}
          </h1>
          <p className="text-gray-500 mt-1">
            {new Date().toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <button
              key={index}
              onClick={card.onClick}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={cn('p-2 rounded-lg', card.bgColor)}>
                  <Icon className={cn('w-5 h-5', card.color.replace('bg-', 'text-'))} />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {quickActions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">快速操作</h2>
          <div className="flex flex-wrap gap-3">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={cn(
                    'inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors relative',
                    action.color
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {action.label}
                  {action.badge && (
                    <span className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {action.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              器材状态分布
            </h2>
          </div>
          <div className="p-4 space-y-4">
            {equipmentStatusData.map((item) => (
              <div key={item.status} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    {EQUIPMENT_STATUS[item.status as keyof typeof EQUIPMENT_STATUS] || item.status}
                  </span>
                  <span className="font-medium text-gray-900">
                    {item.count} ({item.percentage.toFixed(0)}%)
                  </span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', statusBarColors[item.status])}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
            {equipments.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>暂无器材数据</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              最近订单
            </h2>
            <button
              onClick={() => navigate('/orders')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              查看全部 <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => navigate('/orders')}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{order.order_no}</span>
                        <StatusBadge type="order" status={order.status} />
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {order.equipment?.brand} {order.equipment?.model}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {order.customer?.name} · {formatDate(order.start_date)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-gray-900">¥{order.total_rent.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>暂无订单数据</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {stats.pendingOrders > 0 && canManageOrders && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-yellow-900">
              有待确认的订单
            </p>
            <p className="text-sm text-yellow-700 mt-0.5">
              当前有 {stats.pendingOrders} 个订单等待确认，请及时处理。
            </p>
          </div>
          <button
            onClick={() => navigate('/orders')}
            className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors"
          >
            去处理
          </button>
        </div>
      )}

      {stats.pendingSettlements > 0 && canSettle && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
          <DollarSign className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-teal-900">
              有待结算的订单
            </p>
            <p className="text-sm text-teal-700 mt-0.5">
              当前有 {stats.pendingSettlements} 个订单等待结算，请及时处理。
            </p>
          </div>
          <button
            onClick={() => navigate('/settlements')}
            className="px-3 py-1.5 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors"
          >
            去结算
          </button>
        </div>
      )}
    </div>
  );
}
