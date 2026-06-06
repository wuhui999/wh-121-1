import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package,
  User,
  Calendar,
  DollarSign,
  Check,
  X,
  Eye,
  Clock,
  AlertTriangle,
  Wrench,
  Camera,
  FileText,
  ListChecks,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api, ORDER_STATUS, EQUIPMENT_TYPES, DAMAGE_LEVELS } from '@/lib/api';
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
    specification: string;
    daily_rate: number;
    deposit: number;
  };
  customer_id: number;
  customer: {
    id: number;
    name: string;
    phone: string;
    email?: string;
  };
  start_date: string;
  end_date: string;
  days: number;
  total_rent: number;
  deposit: number;
  status: string;
  remark?: string;
  lending?: {
    id: number;
    lending_date: string;
    clerk_name: string;
    condition_note?: string;
    actual_deposit: number;
    accessories?: Array<{ name: string; quantity: number; status: string }>;
    remark?: string;
  };
  return?: {
    id: number;
    return_date: string;
    is_late: number;
    late_hours: number;
    late_fee: number;
    is_damaged: number;
    damage_level?: string;
    damage_description?: string;
    damage_fee: number;
    is_missing: number;
    missing_accessories?: string;
    missing_fee: number;
    repair_suggestion?: string;
    photo_url?: string;
    clerk_name: string;
  };
  settlement?: {
    id: number;
    settlement_date: string;
    total_amount: number;
    late_fee: number;
    damage_fee: number;
    missing_fee: number;
    refund_amount: number;
  };
  created_at: string;
  updated_at: string;
}

interface ReturnFormData {
  return_date: string;
  is_late: number;
  late_hours: number;
  late_fee: number;
  is_damaged: number;
  damage_level: string;
  damage_description: string;
  damage_fee: number;
  is_missing: number;
  missing_accessories: string;
  missing_fee: number;
  repair_suggestion: string;
  photo_url: string;
  clerk_name: string;
}

export default function Returns() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  const [lentOrders, setLentOrders] = useState<Order[]>([]);
  const [returnedOrders, setReturnedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'lent' | 'returned'>('lent');

  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [showDamageSection, setShowDamageSection] = useState(false);
  const [showMissingSection, setShowMissingSection] = useState(false);

  const [formData, setFormData] = useState<ReturnFormData>({
    return_date: '',
    is_late: 0,
    late_hours: 0,
    late_fee: 0,
    is_damaged: 0,
    damage_level: 'none',
    damage_description: '',
    damage_fee: 0,
    is_missing: 0,
    missing_accessories: '',
    missing_fee: 0,
    repair_suggestion: '',
    photo_url: '',
    clerk_name: '',
  });

  const fetchLentOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.orders.list({ status: 'lent' });
      if (response.success && response.data) {
        const data = Array.isArray(response.data) ? response.data : response.data.data || [];
        setLentOrders(data);
      }
    } catch {
      showToast('获取已出借订单失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchReturnedOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.orders.list({ status: 'returned' });
      if (response.success && response.data) {
        const data = Array.isArray(response.data) ? response.data : response.data.data || [];
        setReturnedOrders(data);
      }
    } catch {
      showToast('获取已归还订单失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (activeTab === 'lent') {
      fetchLentOrders();
    } else {
      fetchReturnedOrders();
    }
  }, [activeTab, fetchLentOrders, fetchReturnedOrders]);

  const calculateLateInfo = useCallback((returnDate: string, expectedEndDate: string, dailyRate: number) => {
    const returnTime = new Date(returnDate).getTime();
    const expectedTime = new Date(expectedEndDate).getTime();

    if (returnTime <= expectedTime) {
      return { is_late: 0, late_hours: 0, late_fee: 0 };
    }

    const diffMs = returnTime - expectedTime;
    const lateHours = Math.ceil(diffMs / (1000 * 60 * 60));
    const lateFee = Math.ceil(lateHours / 24) * dailyRate;

    return { is_late: 1, late_hours: lateHours, late_fee: lateFee };
  }, []);

  const calculateDamageFee = useCallback((damageLevel: string, dailyRate: number, deposit: number) => {
    switch (damageLevel) {
      case 'minor':
        return dailyRate * 1;
      case 'moderate':
        return dailyRate * 3;
      case 'severe':
        return deposit * 0.5;
      default:
        return 0;
    }
  }, []);

  const lateInfo = useMemo(() => {
    if (!selectedOrder) return { is_late: 0, late_hours: 0, late_fee: 0 };
    return calculateLateInfo(
      formData.return_date,
      selectedOrder.end_date,
      selectedOrder.equipment?.daily_rate || 0
    );
  }, [formData.return_date, selectedOrder, calculateLateInfo]);

  const damageFeeCalc = useMemo(() => {
    if (!selectedOrder || formData.is_damaged === 0) return 0;
    return calculateDamageFee(
      formData.damage_level,
      selectedOrder.equipment?.daily_rate || 0,
      selectedOrder.deposit
    );
  }, [formData.is_damaged, formData.damage_level, selectedOrder, calculateDamageFee]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      is_late: lateInfo.is_late,
      late_hours: lateInfo.late_hours,
      late_fee: lateInfo.late_fee,
      damage_fee: damageFeeCalc,
    }));
  }, [lateInfo, damageFeeCalc]);

  const openReturnModal = (order: Order) => {
    const now = new Date();
    const returnDate = now.toISOString().slice(0, 16);

    setSelectedOrder(order);
    setShowDamageSection(false);
    setShowMissingSection(false);

    const initialLateInfo = calculateLateInfo(
      returnDate,
      order.end_date,
      order.equipment?.daily_rate || 0
    );

    setFormData({
      return_date: returnDate,
      is_late: initialLateInfo.is_late,
      late_hours: initialLateInfo.late_hours,
      late_fee: initialLateInfo.late_fee,
      is_damaged: 0,
      damage_level: 'none',
      damage_description: '',
      damage_fee: 0,
      is_missing: 0,
      missing_accessories: '',
      missing_fee: 0,
      repair_suggestion: '',
      photo_url: '',
      clerk_name: user?.name || '',
    });

    setReturnModalOpen(true);
  };

  const openDetailModal = (order: Order) => {
    setSelectedOrder(order);
    setDetailModalOpen(true);
  };

  const handleSubmitReturn = async () => {
    if (!selectedOrder) return;

    try {
      setSubmitting(true);

      const returnData = {
        order_id: selectedOrder.id,
        equipment_id: selectedOrder.equipment_id,
        customer_id: selectedOrder.customer_id,
        return_date: new Date(formData.return_date).toISOString(),
        is_late: formData.is_late,
        late_hours: formData.late_hours,
        late_fee: formData.late_fee,
        is_damaged: formData.is_damaged,
        damage_level: formData.is_damaged ? formData.damage_level : undefined,
        damage_description: formData.is_damaged ? formData.damage_description : undefined,
        damage_fee: formData.damage_fee,
        is_missing: formData.is_missing,
        missing_accessories: formData.is_missing ? formData.missing_accessories : undefined,
        missing_fee: formData.missing_fee,
        repair_suggestion: formData.repair_suggestion || undefined,
        photo_url: formData.photo_url || undefined,
        clerk_name: formData.clerk_name,
      };

      const response = await api.returns.create(returnData);

      if (response.success) {
        if (formData.is_damaged && formData.damage_level === 'severe') {
          const repairData = {
            equipment_id: selectedOrder.equipment_id,
            order_id: selectedOrder.id,
            description: formData.damage_description || '严重损坏，需要维修',
            damage_level: 'severe',
            estimated_cost: formData.damage_fee,
            status: 'pending',
          };
          await api.repairs.create(repairData);
        }

        showToast('归还检查完成', 'success');
        setReturnModalOpen(false);
        fetchLentOrders();
      } else {
        showToast(response.error || '归还检查失败', 'error');
      }
    } catch {
      showToast('归还检查失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('zh-CN');
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN');
  };

  const checkIsOverdue = (endDate: string) => {
    return new Date() > new Date(endDate);
  };

  const currentOrders = activeTab === 'lent' ? lentOrders : returnedOrders;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">归还检查</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('lent')}
              className={cn(
                "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === 'lent'
                  ? "border-blue-600 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                待归还
                {lentOrders.length > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                    {lentOrders.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setActiveTab('returned')}
              className={cn(
                "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === 'returned'
                  ? "border-blue-600 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4" />
                已归还
              </div>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">订单号</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">器材</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">客户</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">出借时间</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">预计归还</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">是否逾期</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">加载中...</td>
                </tr>
              ) : currentOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    {activeTab === 'lent' ? '暂无待归还订单' : '暂无已归还订单'}
                  </td>
                </tr>
              ) : (
                currentOrders.map((order) => (
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
                      {order.lending?.lending_date ? formatDateTime(order.lending.lending_date) : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(order.end_date)}
                    </td>
                    <td className="px-4 py-3">
                      {activeTab === 'lent' && checkIsOverdue(order.end_date) ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          已逾期
                        </span>
                      ) : activeTab === 'lent' ? (
                        <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          正常
                        </span>
                      ) : order.return?.is_late ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          迟还 {order.return.late_hours} 小时
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                          按时归还
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge type="order" status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {activeTab === 'lent' ? (
                          <button
                            onClick={() => openReturnModal(order)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                            归还检查
                          </button>
                        ) : (
                          <button
                            onClick={() => openDetailModal(order)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="查看详情"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {returnModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">归还检查</h2>
                <p className="text-sm text-gray-500 mt-0.5">订单号：{selectedOrder.order_no}</p>
              </div>
              <button
                onClick={() => setReturnModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  器材信息
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">器材编号：</span>
                    <span className="font-medium">{selectedOrder.equipment?.equipment_no}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">品牌型号：</span>
                    <span className="font-medium">{selectedOrder.equipment?.brand} {selectedOrder.equipment?.model}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">日租金：</span>
                    <span className="font-medium">¥{selectedOrder.equipment?.daily_rate.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">押金：</span>
                    <span className="font-medium">¥{selectedOrder.deposit.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  客户信息
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">姓名：</span>
                    <span className="font-medium">{selectedOrder.customer?.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">手机号：</span>
                    <span className="font-medium">{selectedOrder.customer?.phone}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  租借信息
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">出借时间：</span>
                    <span className="font-medium">{selectedOrder.lending?.lending_date ? formatDateTime(selectedOrder.lending.lending_date) : '-'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">预计归还：</span>
                    <span className="font-medium">{formatDate(selectedOrder.end_date)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  实际归还时间
                </label>
                <input
                  type="datetime-local"
                  value={formData.return_date}
                  onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                {formData.is_late ? (
                  <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <div className="text-sm">
                      <span className="text-red-700 font-medium">迟还 {formData.late_hours} 小时</span>
                      <span className="text-red-600 ml-2">迟还费用：¥{formData.late_fee.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-green-700">按时归还</span>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <button
                  onClick={() => setShowDamageSection(!showDamageSection)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className={cn("w-4 h-4", formData.is_damaged ? "text-red-600" : "text-gray-500")} />
                    <span className="font-medium text-gray-900">损坏检查</span>
                    {formData.is_damaged && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">有损坏</span>
                    )}
                  </div>
                  {showDamageSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showDamageSection && (
                  <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={formData.is_damaged === 0}
                          onChange={() => setFormData({ ...formData, is_damaged: 0, damage_level: 'none', damage_description: '', damage_fee: 0 })}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">无损坏</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={formData.is_damaged === 1}
                          onChange={() => setFormData({ ...formData, is_damaged: 1, damage_level: 'minor' })}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">有损坏</span>
                      </label>
                    </div>

                    {formData.is_damaged === 1 && (
                      <>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">损坏等级</label>
                          <div className="grid grid-cols-3 gap-2">
                            {Object.entries(DAMAGE_LEVELS).filter(([key]) => key !== 'none').map(([key, label]) => (
                              <button
                                key={key}
                                onClick={() => setFormData({ ...formData, damage_level: key })}
                                className={cn(
                                  "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                  formData.damage_level === key
                                    ? key === 'minor' ? "bg-yellow-100 text-yellow-700 border-2 border-yellow-500" :
                                      key === 'moderate' ? "bg-orange-100 text-orange-700 border-2 border-orange-500" :
                                      "bg-red-100 text-red-700 border-2 border-red-500"
                                    : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                                )}
                              >
                                {label}
                                <div className="text-xs mt-0.5 opacity-75">
                                  {key === 'minor' && `¥${(selectedOrder.equipment?.daily_rate || 0).toFixed(2)}`}
                                  {key === 'moderate' && `¥${((selectedOrder.equipment?.daily_rate || 0) * 3).toFixed(2)}`}
                                  {key === 'severe' && `¥${(selectedOrder.deposit * 0.5).toFixed(2)}`}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">损坏描述</label>
                          <textarea
                            value={formData.damage_description}
                            onChange={(e) => setFormData({ ...formData, damage_description: e.target.value })}
                            rows={3}
                            placeholder="请描述损坏情况..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                          />
                        </div>

                        <div className="p-3 bg-red-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-red-700">损坏赔偿费用：</span>
                            <span className="font-bold text-red-600">¥{formData.damage_fee.toFixed(2)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 pt-4">
                <button
                  onClick={() => setShowMissingSection(!showMissingSection)}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Package className={cn("w-4 h-4", formData.is_missing ? "text-orange-600" : "text-gray-500")} />
                    <span className="font-medium text-gray-900">缺件检查</span>
                    {formData.is_missing && (
                      <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">有缺件</span>
                    )}
                  </div>
                  {showMissingSection ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showMissingSection && (
                  <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={formData.is_missing === 0}
                          onChange={() => setFormData({ ...formData, is_missing: 0, missing_accessories: '', missing_fee: 0 })}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">无缺件</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={formData.is_missing === 1}
                          onChange={() => setFormData({ ...formData, is_missing: 1 })}
                          className="w-4 h-4 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">有缺件</span>
                      </label>
                    </div>

                    {formData.is_missing === 1 && (
                      <>
                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">缺失配件</label>
                          <textarea
                            value={formData.missing_accessories}
                            onChange={(e) => setFormData({ ...formData, missing_accessories: e.target.value })}
                            rows={2}
                            placeholder="请列出缺失的配件..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-sm font-medium text-gray-700">缺件费用</label>
                          <input
                            type="number"
                            value={formData.missing_fee}
                            onChange={(e) => setFormData({ ...formData, missing_fee: parseFloat(e.target.value) || 0 })}
                            min="0"
                            step="0.01"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Wrench className="w-4 h-4" />
                  维修建议
                </label>
                <textarea
                  value={formData.repair_suggestion}
                  onChange={(e) => setFormData({ ...formData, repair_suggestion: e.target.value })}
                  rows={2}
                  placeholder="如有维修建议请填写..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                  <Camera className="w-4 h-4" />
                  照片地址（可选）
                </label>
                <input
                  type="text"
                  value={formData.photo_url}
                  onChange={(e) => setFormData({ ...formData, photo_url: e.target.value })}
                  placeholder="请输入照片URL"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                  <User className="w-4 h-4" />
                  经办人
                </label>
                <input
                  type="text"
                  value={formData.clerk_name}
                  onChange={(e) => setFormData({ ...formData, clerk_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="bg-amber-50 rounded-xl p-4 space-y-2">
                <h4 className="font-medium text-amber-900">费用汇总</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-amber-700">迟还费用：</span>
                    <span className={cn("font-medium", formData.late_fee > 0 ? "text-red-600" : "text-gray-600")}>
                      ¥{formData.late_fee.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-700">损坏费用：</span>
                    <span className={cn("font-medium", formData.damage_fee > 0 ? "text-red-600" : "text-gray-600")}>
                      ¥{formData.damage_fee.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-700">缺件费用：</span>
                    <span className={cn("font-medium", formData.missing_fee > 0 ? "text-red-600" : "text-gray-600")}>
                      ¥{formData.missing_fee.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-amber-200">
                    <span className="text-amber-900 font-medium">预计扣款合计：</span>
                    <span className="font-bold text-red-600">
                      ¥{(formData.late_fee + formData.damage_fee + formData.missing_fee).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={handleSubmitReturn}
                disabled={submitting}
                className={cn(
                  "flex-1 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2",
                  submitting
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                )}
              >
                {submitting ? (
                  <>
                    <Clock className="w-4 h-4 animate-spin" />
                    提交中...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    确认归还
                  </>
                )}
              </button>
              <button
                onClick={() => setReturnModalOpen(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {detailModalOpen && selectedOrder && selectedOrder.return && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">归还详情</h2>
                <p className="text-sm text-gray-500 mt-0.5">订单号：{selectedOrder.order_no}</p>
              </div>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className={cn(
                "rounded-xl p-4 space-y-3",
                selectedOrder.return.is_late ? "bg-amber-50" : "bg-green-50"
              )}>
                <h3 className={cn(
                  "font-medium flex items-center gap-2",
                  selectedOrder.return.is_late ? "text-amber-900" : "text-green-900"
                )}>
                  <Clock className="w-4 h-4" />
                  归还信息
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className={selectedOrder.return.is_late ? "text-amber-600" : "text-green-600"}>实际归还时间：</span>
                    <span className={cn("font-medium", selectedOrder.return.is_late ? "text-amber-900" : "text-green-900")}>
                      {formatDateTime(selectedOrder.return.return_date)}
                    </span>
                  </div>
                  <div>
                    <span className={selectedOrder.return.is_late ? "text-amber-600" : "text-green-600"}>预计归还时间：</span>
                    <span className={cn("font-medium", selectedOrder.return.is_late ? "text-amber-900" : "text-green-900")}>
                      {formatDate(selectedOrder.end_date)}
                    </span>
                  </div>
                  {selectedOrder.return.is_late > 0 && (
                    <>
                      <div>
                        <span className="text-amber-600">迟还小时数：</span>
                        <span className="font-medium text-amber-900">{selectedOrder.return.late_hours} 小时</span>
                      </div>
                      <div>
                        <span className="text-amber-600">迟还费用：</span>
                        <span className="font-medium text-amber-900">¥{selectedOrder.return.late_fee.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div>
                    <span className={selectedOrder.return.is_late ? "text-amber-600" : "text-green-600"}>经办店员：</span>
                    <span className={cn("font-medium", selectedOrder.return.is_late ? "text-amber-900" : "text-green-900")}>
                      {selectedOrder.return.clerk_name}
                    </span>
                  </div>
                </div>
              </div>

              {selectedOrder.return.is_damaged > 0 && (
                <div className="bg-red-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-medium text-red-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    损坏记录
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-red-600">损坏等级：</span>
                      <span className="font-medium text-red-900">
                        {DAMAGE_LEVELS[selectedOrder.return.damage_level as keyof typeof DAMAGE_LEVELS] || selectedOrder.return.damage_level}
                      </span>
                    </div>
                    <div>
                      <span className="text-red-600">损坏费用：</span>
                      <span className="font-medium text-red-900">¥{selectedOrder.return.damage_fee.toFixed(2)}</span>
                    </div>
                    {selectedOrder.return.damage_description && (
                      <div className="col-span-2">
                        <span className="text-red-600">损坏描述：</span>
                        <span className="font-medium text-red-900">{selectedOrder.return.damage_description}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedOrder.return.is_missing > 0 && (
                <div className="bg-orange-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-medium text-orange-900 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    缺件记录
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-orange-600">缺失配件：</span>
                      <span className="font-medium text-orange-900">{selectedOrder.return.missing_accessories}</span>
                    </div>
                    <div>
                      <span className="text-orange-600">缺件费用：</span>
                      <span className="font-medium text-orange-900">¥{selectedOrder.return.missing_fee.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedOrder.return.repair_suggestion && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    维修建议
                  </h3>
                  <p className="text-gray-600 text-sm">{selectedOrder.return.repair_suggestion}</p>
                </div>
              )}

              {selectedOrder.return.photo_url && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    照片记录
                  </h3>
                  <a
                    href={selectedOrder.return.photo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm break-all"
                  >
                    {selectedOrder.return.photo_url}
                  </a>
                </div>
              )}

              {selectedOrder.settlement && (
                <div className="bg-purple-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-medium text-purple-900 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    结算信息
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-purple-600">结算时间：</span>
                      <span className="font-medium text-purple-900">{formatDateTime(selectedOrder.settlement.settlement_date)}</span>
                    </div>
                    <div>
                      <span className="text-purple-600">总租金：</span>
                      <span className="font-medium text-purple-900">¥{selectedOrder.total_rent.toFixed(2)}</span>
                    </div>
                    {selectedOrder.settlement.late_fee > 0 && (
                      <div>
                        <span className="text-amber-600">迟还费：</span>
                        <span className="font-medium text-amber-600">+¥{selectedOrder.settlement.late_fee.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedOrder.settlement.damage_fee > 0 && (
                      <div>
                        <span className="text-red-600">损坏赔偿：</span>
                        <span className="font-medium text-red-600">+¥{selectedOrder.settlement.damage_fee.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedOrder.settlement.missing_fee > 0 && (
                      <div>
                        <span className="text-orange-600">缺件赔偿：</span>
                        <span className="font-medium text-orange-600">+¥{selectedOrder.settlement.missing_fee.toFixed(2)}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-purple-600">应收总额：</span>
                      <span className="font-medium text-purple-900">¥{selectedOrder.settlement.total_amount.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-purple-600">退还押金：</span>
                      <span className="font-medium text-purple-900">-¥{selectedOrder.settlement.refund_amount.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setDetailModalOpen(false)}
                className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
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
