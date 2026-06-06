import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt,
  Calculator,
  CheckCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Package,
  User,
  Calendar,
  Clock,
  DollarSign,
  ArrowDown,
  ArrowUp,
  AlertTriangle,
} from 'lucide-react';
import { api, ORDER_STATUS } from '@/lib/api';
import { useAuthStore, useUIStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

interface Order {
  id: number;
  order_no: string;
  equipment_id: number;
  equipment: {
    id: number;
    equipment_no: string;
    type: string;
    brand: string;
    model: string;
    daily_rate: number;
    deposit: number;
  };
  customer_id: number;
  customer: {
    id: number;
    name: string;
    phone: string;
  };
  start_date: string;
  end_date: string;
  days: number;
  total_rent: number;
  deposit: number;
  status: string;
  remark?: string;
  return?: {
    id: number;
    return_date: string;
    is_late: number;
    is_damaged: number;
    is_missing: number;
    damage_level?: string;
    late_fee: number;
    damage_fee: number;
    missing_fee: number;
  };
  settlement?: {
    id: number;
    settlement_date: string;
    total_amount: number;
    late_fee: number;
    damage_fee: number;
    missing_fee: number;
    deposit_amount: number;
    deposit_deduction: number;
    refund_amount: number;
    additional_payment: number;
  };
  created_at: string;
}

interface PaginationData {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type TabType = 'pending' | 'completed';

export default function Settlements() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });

  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [settling, setSettling] = useState(false);

  const [lateFee, setLateFee] = useState(0);
  const [damageFee, setDamageFee] = useState(0);
  const [missingFee, setMissingFee] = useState(0);

  const canSettle = user?.role === 'admin' || user?.role === 'finance';

  const settlementCalculation = useMemo(() => {
    if (!selectedOrder) return null;

    const rent = selectedOrder.total_rent;
    const deposit = selectedOrder.deposit;
    const totalCost = rent + lateFee + damageFee + missingFee;
    const deduction = Math.min(deposit, totalCost);
    const refund = deposit > deduction ? deposit - deduction : 0;
    const additional = totalCost > deduction ? totalCost - deduction : 0;

    return {
      rent,
      lateFee,
      damageFee,
      missingFee,
      totalCost,
      deposit,
      deduction,
      refund,
      additional,
    };
  }, [selectedOrder, lateFee, damageFee, missingFee]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const status = activeTab === 'pending' ? 'returned' : 'settled';
      const response = await api.orders.list({ status });
      if (response.success && response.data) {
        const orderData = Array.isArray(response.data) ? response.data : response.data.data || [];
        setOrders(orderData);
        setPagination((prev) => ({
          ...prev,
          total: orderData.length,
          totalPages: Math.ceil(orderData.length / prev.pageSize) || 1,
        }));
      }
    } catch {
      showToast('获取订单列表失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, showToast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const openSettleModal = (order: Order) => {
    setSelectedOrder(order);
    setLateFee(order.return?.late_fee || 0);
    setDamageFee(order.return?.damage_fee || 0);
    setMissingFee(order.return?.missing_fee || 0);
    setSettleModalOpen(true);
  };

  const handleSettle = async () => {
    if (!selectedOrder || !settlementCalculation || !canSettle) return;

    setSettling(true);
    try {
      const settlementData = {
        order_id: selectedOrder.id,
        total_amount: settlementCalculation.totalCost,
        rent: settlementCalculation.rent,
        late_fee: settlementCalculation.lateFee,
        damage_fee: settlementCalculation.damageFee,
        missing_fee: settlementCalculation.missingFee,
        deposit_amount: settlementCalculation.deposit,
        deposit_deduction: settlementCalculation.deduction,
        refund_amount: settlementCalculation.refund,
        additional_payment: settlementCalculation.additional,
      };

      const response = await api.settlements.create(settlementData);
      if (response.success) {
        showToast('结算成功', 'success');
        setSettleModalOpen(false);
        fetchOrders();
      } else {
        showToast(response.error || '结算失败', 'error');
      }
    } catch {
      showToast('结算失败', 'error');
    } finally {
      setSettling(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const paginatedOrders = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return orders.slice(start, end);
  }, [orders, pagination.page, pagination.pageSize]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">结算管理</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => {
                setActiveTab('pending');
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className={cn(
                'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'pending'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              待结算 ({orders.filter((o) => o.status === 'returned').length})
            </button>
            <button
              onClick={() => {
                setActiveTab('completed');
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className={cn(
                'px-6 py-3 text-sm font-medium border-b-2 transition-colors',
                activeTab === 'completed'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              已结算 ({orders.filter((o) => o.status === 'settled').length})
            </button>
          </nav>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">订单号</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">器材</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">客户</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">归还时间</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">租金</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">迟还费</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">损坏费</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">缺件费</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-500">加载中...</td>
                </tr>
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-gray-500">
                    {activeTab === 'pending' ? '暂无待结算订单' : '暂无已结算记录'}
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{order.order_no}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{order.equipment?.brand} {order.equipment?.model}</div>
                      <div className="text-xs text-gray-500">{order.equipment?.equipment_no}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{order.customer?.name}</div>
                      <div className="text-xs text-gray-500">{order.customer?.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {order.return?.return_date ? formatDateTime(order.return.return_date) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-900 font-medium">¥{order.total_rent.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {activeTab === 'pending' ? (
                        <span className={cn(order.return?.late_fee ? 'text-amber-600' : 'text-gray-400')}>
                          {order.return?.late_fee ? `¥${order.return.late_fee.toFixed(2)}` : '-'}
                        </span>
                      ) : (
                        <span className={cn(order.settlement?.late_fee ? 'text-amber-600' : 'text-gray-400')}>
                          {order.settlement?.late_fee ? `¥${order.settlement.late_fee.toFixed(2)}` : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {activeTab === 'pending' ? (
                        <span className={cn(order.return?.damage_fee ? 'text-red-600' : 'text-gray-400')}>
                          {order.return?.damage_fee ? `¥${order.return.damage_fee.toFixed(2)}` : '-'}
                        </span>
                      ) : (
                        <span className={cn(order.settlement?.damage_fee ? 'text-red-600' : 'text-gray-400')}>
                          {order.settlement?.damage_fee ? `¥${order.settlement.damage_fee.toFixed(2)}` : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {activeTab === 'pending' ? (
                        <span className={cn(order.return?.missing_fee ? 'text-orange-600' : 'text-gray-400')}>
                          {order.return?.missing_fee ? `¥${order.return.missing_fee.toFixed(2)}` : '-'}
                        </span>
                      ) : (
                        <span className={cn(order.settlement?.missing_fee ? 'text-orange-600' : 'text-gray-400')}>
                          {order.settlement?.missing_fee ? `¥${order.settlement.missing_fee.toFixed(2)}` : '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge type="order" status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      {activeTab === 'pending' && canSettle && (
                        <button
                          onClick={() => openSettleModal(order)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Calculator className="w-4 h-4" />
                          结算
                        </button>
                      )}
                      {activeTab === 'completed' && order.settlement && (
                        <button
                          onClick={() => openSettleModal(order)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          <Receipt className="w-4 h-4" />
                          详情
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              共 {pagination.total} 条，第 {pagination.page} / {pagination.totalPages} 页
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.page <= 3) {
                  pageNum = i + 1;
                } else if (pagination.page >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = pagination.page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={cn(
                      'px-3 py-1.5 border rounded text-sm transition-colors',
                      pagination.page === pageNum
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1.5 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {settleModalOpen && selectedOrder && settlementCalculation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {activeTab === 'pending' ? '订单结算' : '结算详情'}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">订单号：{selectedOrder.order_no}</p>
              </div>
              <button
                onClick={() => setSettleModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  基本信息
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">器材：</span>
                    <span className="font-medium">{selectedOrder.equipment?.brand} {selectedOrder.equipment?.model}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">客户：</span>
                    <span className="font-medium">{selectedOrder.customer?.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">租期：</span>
                    <span className="font-medium">{formatDate(selectedOrder.start_date)} ~ {formatDate(selectedOrder.end_date)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">天数：</span>
                    <span className="font-medium">{selectedOrder.days} 天</span>
                  </div>
                  {selectedOrder.return?.return_date && (
                    <div className="col-span-2">
                      <span className="text-gray-500">实际归还：</span>
                      <span className="font-medium">{formatDateTime(selectedOrder.return.return_date)}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 space-y-4">
                <h3 className="font-medium text-blue-900 flex items-center gap-2">
                  <Calculator className="w-4 h-4" />
                  费用明细
                </h3>

                {activeTab === 'pending' ? (
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">租金</label>
                      <div className="text-lg font-semibold text-gray-900">¥{settlementCalculation.rent.toFixed(2)}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">迟还费</label>
                        <input
                          type="number"
                          value={lateFee}
                          onChange={(e) => setLateFee(Number(e.target.value))}
                          min="0"
                          step="0.01"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">损坏费</label>
                        <input
                          type="number"
                          value={damageFee}
                          onChange={(e) => setDamageFee(Number(e.target.value))}
                          min="0"
                          step="0.01"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">缺件费</label>
                        <input
                          type="number"
                          value={missingFee}
                          onChange={(e) => setMissingFee(Number(e.target.value))}
                          min="0"
                          step="0.01"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">租金</span>
                      <span className="font-medium">¥{settlementCalculation.rent.toFixed(2)}</span>
                    </div>
                    {settlementCalculation.lateFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-amber-600">迟还费</span>
                        <span className="font-medium text-amber-600">+¥{settlementCalculation.lateFee.toFixed(2)}</span>
                      </div>
                    )}
                    {settlementCalculation.damageFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-red-600">损坏费</span>
                        <span className="font-medium text-red-600">+¥{settlementCalculation.damageFee.toFixed(2)}</span>
                      </div>
                    )}
                    {settlementCalculation.missingFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-orange-600">缺件费</span>
                        <span className="font-medium text-orange-600">+¥{settlementCalculation.missingFee.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="col-span-2 border-t border-blue-200 pt-2 mt-1">
                      <div className="flex justify-between">
                        <span className="text-blue-900 font-medium">总费用</span>
                        <span className="font-bold text-blue-900 text-lg">¥{settlementCalculation.totalCost.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'pending' && (
                  <div className="border-t border-blue-200 pt-4">
                    <div className="flex justify-between text-lg">
                      <span className="text-blue-900 font-medium">总费用</span>
                      <span className="font-bold text-blue-900">¥{settlementCalculation.totalCost.toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-green-50 rounded-xl p-4 space-y-3">
                <h3 className="font-medium text-green-900 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  押金结算
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">押金收取金额</span>
                    <span className="font-medium">¥{settlementCalculation.deposit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">押金抵扣金额</span>
                    <span className="font-medium text-amber-600">-¥{settlementCalculation.deduction.toFixed(2)}</span>
                  </div>
                  {settlementCalculation.refund > 0 && (
                    <div className="col-span-2 flex justify-between bg-white/50 rounded-lg p-2">
                      <span className="text-green-700 font-medium flex items-center gap-1">
                        <ArrowDown className="w-4 h-4" />
                        应退金额
                      </span>
                      <span className="font-bold text-green-700">¥{settlementCalculation.refund.toFixed(2)}</span>
                    </div>
                  )}
                  {settlementCalculation.additional > 0 && (
                    <div className="col-span-2 flex justify-between bg-white/50 rounded-lg p-2">
                      <span className="text-red-700 font-medium flex items-center gap-1">
                        <ArrowUp className="w-4 h-4" />
                        需补付金额
                      </span>
                      <span className="font-bold text-red-700">¥{settlementCalculation.additional.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedOrder.return && (selectedOrder.return.is_late > 0 || selectedOrder.return.is_damaged > 0 || selectedOrder.return.is_missing > 0) && (
                <div className="bg-amber-50 rounded-xl p-4 space-y-2">
                  <h3 className="font-medium text-amber-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    归还检查记录
                  </h3>
                  <div className="text-sm text-amber-800 space-y-1">
                    {selectedOrder.return.is_late > 0 && (
                      <p>• 逾期归还</p>
                    )}
                    {selectedOrder.return.is_damaged > 0 && (
                      <p>• 器材损坏{selectedOrder.return.damage_level ? ` (${selectedOrder.return.damage_level})` : ''}</p>
                    )}
                    {selectedOrder.return.is_missing > 0 && (
                      <p>• 配件缺失</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'completed' && selectedOrder.settlement && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-medium text-gray-900 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    结算信息
                  </h3>
                  <div className="text-sm">
                    <p>
                      <span className="text-gray-500">结算时间：</span>
                      <span className="font-medium">{formatDateTime(selectedOrder.settlement.settlement_date)}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              {activeTab === 'pending' && canSettle && (
                <button
                  onClick={handleSettle}
                  disabled={settling}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {settling ? '结算中...' : '确认结算'}
                </button>
              )}
              <button
                onClick={() => setSettleModalOpen(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
