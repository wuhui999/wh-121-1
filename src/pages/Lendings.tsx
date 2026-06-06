import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  User,
  Calendar,
  DollarSign,
  Check,
  X,
  Plus,
  Trash2,
  Eye,
  Clock,
  ListChecks,
  FileText,
  ClipboardList,
} from 'lucide-react';
import { api, ORDER_STATUS, EQUIPMENT_TYPES } from '@/lib/api';
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
  created_at: string;
  updated_at: string;
}

interface AccessoryItem {
  id: number;
  name: string;
  quantity: number;
  status: string;
}

interface LendingFormData {
  condition_note: string;
  accessories: AccessoryItem[];
  actual_deposit: number;
  clerk_name: string;
  remark: string;
}

export default function Lendings() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [lentOrders, setLentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'lent'>('pending');

  const [lendingModalOpen, setLendingModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<LendingFormData>({
    condition_note: '',
    accessories: [],
    actual_deposit: 0,
    clerk_name: '',
    remark: '',
  });

  const fetchPendingOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.orders.list({ status: 'confirmed' });
      if (response.success && response.data) {
        const data = Array.isArray(response.data) ? response.data : response.data.data || [];
        setPendingOrders(data);
      }
    } catch {
      showToast('获取待出借订单失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

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

  useEffect(() => {
    if (activeTab === 'pending') {
      fetchPendingOrders();
    } else {
      fetchLentOrders();
    }
  }, [activeTab, fetchPendingOrders, fetchLentOrders]);

  const openLendingModal = (order: Order) => {
    setSelectedOrder(order);
    setFormData({
      condition_note: '',
      accessories: [{ id: Date.now(), name: '', quantity: 1, status: 'good' }],
      actual_deposit: order.deposit,
      clerk_name: user?.name || '',
      remark: '',
    });
    setLendingModalOpen(true);
  };

  const openDetailModal = (order: Order) => {
    setSelectedOrder(order);
    setDetailModalOpen(true);
  };

  const addAccessory = () => {
    setFormData({
      ...formData,
      accessories: [
        ...formData.accessories,
        { id: Date.now(), name: '', quantity: 1, status: 'good' },
      ],
    });
  };

  const removeAccessory = (id: number) => {
    setFormData({
      ...formData,
      accessories: formData.accessories.filter((a) => a.id !== id),
    });
  };

  const updateAccessory = (id: number, field: keyof AccessoryItem, value: string | number) => {
    setFormData({
      ...formData,
      accessories: formData.accessories.map((a) =>
        a.id === id ? { ...a, [field]: value } : a
      ),
    });
  };

  const handleSubmitLending = async () => {
    if (!selectedOrder) return;

    const validAccessories = formData.accessories.filter((a) => a.name.trim());

    try {
      setSubmitting(true);

      const lendingData = {
        order_id: selectedOrder.id,
        equipment_id: selectedOrder.equipment_id,
        customer_id: selectedOrder.customer_id,
        lending_date: new Date().toISOString(),
        condition_note: formData.condition_note,
        accessories: validAccessories.map(({ id, ...rest }) => rest),
        actual_deposit: formData.actual_deposit,
        clerk_name: formData.clerk_name,
        remark: formData.remark,
      };

      const response = await api.lendings.create(lendingData);

      if (response.success) {
        showToast('出借确认成功', 'success');
        setLendingModalOpen(false);
        fetchPendingOrders();
      } else {
        showToast(response.error || '出借确认失败', 'error');
      }
    } catch {
      showToast('出借确认失败', 'error');
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

  const currentOrders = activeTab === 'pending' ? pendingOrders : lentOrders;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold text-gray-900">出借管理</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('pending')}
              className={cn(
                "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
                activeTab === 'pending'
                  ? "border-blue-600 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                待出借
                {pendingOrders.length > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                    {pendingOrders.length}
                  </span>
                )}
              </div>
            </button>
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
                <ListChecks className="w-4 h-4" />
                已出借
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">预约日期</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">预计归还</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">押金</th>
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
                  {activeTab === 'pending' ? '暂无待出借订单' : '暂无已出借订单'}
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
                    {formatDate(order.start_date)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {formatDate(order.end_date)}
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-medium">¥{order.deposit.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge type="order" status={order.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {activeTab === 'pending' ? (
                      <button
                        onClick={() => openLendingModal(order)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        <Check className="w-4 h-4" />
                        出借
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

      {lendingModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">出借确认</h2>
                <p className="text-sm text-gray-500 mt-0.5">订单号：{selectedOrder.order_no}</p>
              </div>
              <button
                onClick={() => setLendingModalOpen(false)}
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
                    <span className="text-gray-500">类型：</span>
                    <span className="font-medium">
                      {EQUIPMENT_TYPES[selectedOrder.equipment?.type as keyof typeof EQUIPMENT_TYPES] || selectedOrder.equipment?.type}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">品牌型号：</span>
                    <span className="font-medium">{selectedOrder.equipment?.brand} {selectedOrder.equipment?.model}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">规格：</span>
                    <span className="font-medium">{selectedOrder.equipment?.specification}</span>
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
                    <span className="text-gray-500">租借日期：</span>
                    <span className="font-medium">{formatDate(selectedOrder.start_date)} 至 {formatDate(selectedOrder.end_date)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">租借天数：</span>
                    <span className="font-medium">{selectedOrder.days} 天</span>
                  </div>
                  <div>
                    <span className="text-gray-500">日租金：</span>
                    <span className="font-medium">¥{selectedOrder.equipment?.daily_rate.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">订单押金：</span>
                    <span className="font-medium">¥{selectedOrder.deposit.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">外观状况记录</label>
                <textarea
                  value={formData.condition_note}
                  onChange={(e) => setFormData({ ...formData, condition_note: e.target.value })}
                  rows={3}
                  placeholder="请记录器材出借时的外观状况..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">配件清单</label>
                  <button
                    onClick={addAccessory}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    添加配件
                  </button>
                </div>
                <div className="space-y-2">
                  {formData.accessories.map((accessory, index) => (
                    <div key={accessory.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={accessory.name}
                        onChange={(e) => updateAccessory(accessory.id, 'name', e.target.value)}
                        placeholder="配件名称"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      />
                      <input
                        type="number"
                        value={accessory.quantity}
                        onChange={(e) => updateAccessory(accessory.id, 'quantity', parseInt(e.target.value) || 1)}
                        min="1"
                        className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      />
                      <select
                        value={accessory.status}
                        onChange={(e) => updateAccessory(accessory.id, 'status', e.target.value)}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                      >
                        <option value="good">良好</option>
                        <option value="normal">一般</option>
                        <option value="worn">磨损</option>
                      </select>
                      <button
                        onClick={() => removeAccessory(accessory.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    实收押金
                  </label>
                  <input
                    type="number"
                    value={formData.actual_deposit}
                    onChange={(e) => setFormData({ ...formData, actual_deposit: parseFloat(e.target.value) || 0 })}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
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
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  备注
                </label>
                <textarea
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  rows={2}
                  placeholder="其他备注信息..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={handleSubmitLending}
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
                    确认出借
                  </>
                )}
              </button>
              <button
                onClick={() => setLendingModalOpen(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {detailModalOpen && selectedOrder && selectedOrder.lending && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">出借详情</h2>
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
              <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                <h3 className="font-medium text-blue-900 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  出借信息
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-blue-600">出借时间：</span>
                    <span className="font-medium text-blue-900">{formatDateTime(selectedOrder.lending.lending_date)}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">经办店员：</span>
                    <span className="font-medium text-blue-900">{selectedOrder.lending.clerk_name}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">实收押金：</span>
                    <span className="font-medium text-blue-900">¥{selectedOrder.lending.actual_deposit.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedOrder.lending.condition_note && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-medium text-gray-900 mb-2">外观状况记录</h3>
                  <p className="text-gray-600 text-sm">{selectedOrder.lending.condition_note}</p>
                </div>
              )}

              {selectedOrder.lending.accessories && selectedOrder.lending.accessories.length > 0 && (
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-medium text-gray-900">配件清单</h3>
                  <div className="space-y-2">
                    {selectedOrder.lending.accessories.map((acc, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm bg-white p-2 rounded">
                        <span>{acc.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-gray-500">数量: {acc.quantity}</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs",
                            acc.status === 'good' ? "bg-green-100 text-green-700" :
                            acc.status === 'normal' ? "bg-yellow-100 text-yellow-700" :
                            "bg-orange-100 text-orange-700"
                          )}>
                            {acc.status === 'good' ? '良好' : acc.status === 'normal' ? '一般' : '磨损'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedOrder.lending.remark && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-medium text-gray-900 mb-2">备注</h3>
                  <p className="text-gray-600 text-sm">{selectedOrder.lending.remark}</p>
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
