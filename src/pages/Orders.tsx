import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Plus,
  Eye,
  Check,
  X,
  Calendar,
  User,
  Package,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  ArrowRight,
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
    spec: string;
    daily_rent: number;
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
    lent_at: string;
    handler_name: string;
  };
  return?: {
    id: number;
    actual_return_time: string;
    is_late: number;
    late_hours: number;
    late_fee: number;
    is_damaged: number;
    damage_level?: string;
    damage_fee: number;
    is_missing: number;
    missing_fee: number;
  };
  settlement?: {
    id: number;
    settled_at: string;
    total_fee: number;
    late_fee: number;
    damage_fee: number;
    missing_fee: number;
    deposit_received: number;
    deposit_deducted: number;
    refund_amount: number;
    additional_payment: number;
  };
  created_at: string;
  updated_at: string;
}

interface RawOrder {
  id: number;
  order_no: string;
  equipment_id: number;
  equipment_no: string;
  type: string;
  brand: string;
  model: string;
  spec: string;
  daily_rent: number;
  equipment_deposit: number;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  start_date: string;
  end_date: string;
  days: number;
  total_rent: number;
  deposit: number;
  status: string;
  remark: string | null;
  lending?: any;
  return?: any;
  settlement?: any;
  created_at: string;
  updated_at: string;
}

interface Equipment {
  id: number;
  equipment_no: string;
  type: string;
  brand: string;
  model: string;
  spec: string;
  status: string;
  daily_rent: number;
  deposit: number;
}

function transformOrder(raw: RawOrder): Order {
  return {
    id: raw.id,
    order_no: raw.order_no,
    equipment_id: raw.equipment_id,
    equipment: {
      id: raw.equipment_id,
      equipment_no: raw.equipment_no,
      type: raw.type,
      brand: raw.brand,
      model: raw.model,
      spec: raw.spec,
      daily_rent: raw.daily_rent,
      deposit: raw.equipment_deposit || raw.deposit,
    },
    customer_id: raw.customer_id,
    customer: {
      id: raw.customer_id,
      name: raw.customer_name,
      phone: raw.customer_phone,
      email: raw.customer_email,
    },
    start_date: raw.start_date,
    end_date: raw.end_date,
    days: raw.days,
    total_rent: raw.total_rent,
    deposit: raw.deposit,
    status: raw.status,
    remark: raw.remark || undefined,
    lending: raw.lending ? {
      id: raw.lending.id,
      lent_at: raw.lending.lent_at,
      handler_name: raw.lending.handler_name,
    } : undefined,
    return: raw.return ? {
      id: raw.return.id,
      actual_return_time: raw.return.actual_return_time,
      is_late: raw.return.is_late,
      late_hours: raw.return.late_hours,
      late_fee: raw.return.late_fee,
      is_damaged: raw.return.is_damaged,
      damage_level: raw.return.damage_level || undefined,
      damage_fee: raw.return.damage_fee,
      is_missing: raw.return.is_missing,
      missing_fee: raw.return.missing_fee,
    } : undefined,
    settlement: raw.settlement ? {
      id: raw.settlement.id,
      settled_at: raw.settlement.settled_at,
      total_fee: raw.settlement.total_fee,
      late_fee: raw.settlement.late_fee,
      damage_fee: raw.settlement.damage_fee,
      missing_fee: raw.settlement.missing_fee,
      deposit_received: raw.settlement.deposit_received,
      deposit_deducted: raw.settlement.deposit_deducted,
      refund_amount: raw.settlement.refund_amount,
      additional_payment: raw.settlement.additional_payment,
    } : undefined,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

interface PaginationData {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function Orders() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  const preselectedHandled = useRef(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });

  const [statusFilter, setStatusFilter] = useState('');

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [availableEquipments, setAvailableEquipments] = useState<Equipment[]>([]);
  const [formData, setFormData] = useState({
    equipment_id: 0,
    start_date: '',
    end_date: '',
    remark: '',
  });
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');

  const isClerk = user?.role === 'admin' || user?.role === 'clerk';
  const isCustomer = user?.role === 'customer';

  const preselectedEquipmentId = location.state?.equipmentId;

  const orderSummary = useMemo(() => {
    if (!formData.equipment_id || !formData.start_date || !formData.end_date) {
      return null;
    }

    const equipment = availableEquipments.find((e) => e.id === formData.equipment_id);
    if (!equipment) return null;

    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    if (end <= start) return null;

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const totalRent = days * equipment.daily_rent;
    const expectedReturn = new Date(end);
    expectedReturn.setDate(expectedReturn.getDate());

    return {
      days,
      dailyRate: equipment.daily_rent,
      deposit: equipment.deposit,
      totalRent,
      totalAmount: totalRent + equipment.deposit,
      expectedReturn: expectedReturn.toISOString().split('T')[0],
    };
  }, [formData, availableEquipments]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
      if (statusFilter) params.status = statusFilter;

      const response = await api.orders.list(params);
      if (response.success && response.data) {
        const rawList = Array.isArray(response.data) ? response.data : response.data.list || response.data.data || [];
        let orderData = rawList.map((raw: RawOrder) => transformOrder(raw));

        if (isCustomer && user) {
          orderData = orderData.filter((o: Order) => o.customer_id === user.id);
        }

        setOrders(orderData);

        if (Array.isArray(response.data)) {
          setPagination((prev) => ({
            ...prev,
            total: orderData.length,
            totalPages: Math.ceil(orderData.length / pagination.pageSize) || 1,
          }));
        } else {
          setPagination({
            page: response.data.page || 1,
            pageSize: response.data.pageSize || 10,
            total: response.data.total || orderData.length,
            totalPages: response.data.totalPages || Math.ceil(orderData.length / pagination.pageSize) || 1,
          });
        }
      }
    } catch {
      showToast('获取订单列表失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, statusFilter, isCustomer, user, showToast]);

  const fetchAvailableEquipments = useCallback(async () => {
    try {
      const response = await api.equipments.available();
      if (response.success && response.data) {
        setAvailableEquipments(Array.isArray(response.data) ? response.data : response.data.data || []);
      }
    } catch {
      showToast('获取可用器材失败', 'error');
    }
  }, [showToast]);

  const checkAvailability = useCallback(async () => {
    if (!formData.equipment_id || !formData.start_date || !formData.end_date) return;

    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    if (end <= start) {
      setAvailabilityError('结束日期必须晚于开始日期');
      return;
    }

    setCheckingAvailability(true);
    setAvailabilityError('');

    try {
      const response = await api.equipments.checkAvailability(
        formData.equipment_id,
        formData.start_date,
        formData.end_date
      );
      if (response.success && !response.data?.available) {
        setAvailabilityError(response.data?.message || '该器材在所选时间段内已被预约');
      }
    } catch {
      setAvailabilityError('检查可用状态失败');
    } finally {
      setCheckingAvailability(false);
    }
  }, [formData.equipment_id, formData.start_date, formData.end_date]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (createModalOpen) {
      fetchAvailableEquipments();
    }
  }, [createModalOpen, fetchAvailableEquipments]);

  useEffect(() => {
    if (preselectedEquipmentId && !createModalOpen && !preselectedHandled.current) {
      setFormData((prev) => ({ ...prev, equipment_id: preselectedEquipmentId }));
      setCreateModalOpen(true);
      preselectedHandled.current = true;
    }
  }, [preselectedEquipmentId, createModalOpen]);

  useEffect(() => {
    if (formData.equipment_id && formData.start_date && formData.end_date) {
      checkAvailability();
    } else {
      setAvailabilityError('');
    }
  }, [formData.equipment_id, formData.start_date, formData.end_date, checkAvailability]);

  const openDetail = async (order: Order) => {
    try {
      const response = await api.orders.get(order.id);
      if (response.success && response.data) {
        setSelectedOrder(transformOrder(response.data as RawOrder));
        setDetailModalOpen(true);
      } else {
        setSelectedOrder(order);
        setDetailModalOpen(true);
      }
    } catch {
      setSelectedOrder(order);
      setDetailModalOpen(true);
    }
  };

  const openCreateModal = () => {
    setFormData({
      equipment_id: availableEquipments[0]?.id || 0,
      start_date: '',
      end_date: '',
      remark: '',
    });
    setAvailabilityError('');
    preselectedHandled.current = false;
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
    navigate('.', { replace: true, state: {} });
    preselectedHandled.current = false;
  };

  const handleConfirmOrder = async (orderId: number) => {
    try {
      const response = await api.orders.confirm(orderId);
      if (response.success) {
        showToast('订单已确认', 'success');
        fetchOrders();
      } else {
        showToast(response.error || '确认失败', 'error');
      }
    } catch {
      showToast('确认失败', 'error');
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    try {
      const response = await api.orders.cancel(orderId);
      if (response.success) {
        showToast('订单已取消', 'success');
        fetchOrders();
      } else {
        showToast(response.error || '取消失败', 'error');
      }
    } catch {
      showToast('取消失败', 'error');
    }
  };

  const handleCreateOrder = async () => {
    if (!formData.equipment_id) {
      showToast('请选择器材', 'error');
      return;
    }
    if (!formData.start_date || !formData.end_date) {
      showToast('请选择租借日期', 'error');
      return;
    }
    if (availabilityError) {
      showToast(availabilityError, 'error');
      return;
    }
    if (!orderSummary) {
      showToast('日期选择无效', 'error');
      return;
    }

    try {
      const submitData = {
        equipment_id: formData.equipment_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        days: orderSummary.days,
        total_rent: orderSummary.totalRent,
        deposit: orderSummary.deposit,
        remark: formData.remark,
      };

      const response = await api.orders.create(submitData);
      if (response.success) {
        showToast('预约创建成功', 'success');
        closeCreateModal();
        fetchOrders();
      } else {
        showToast(response.error || '创建失败', 'error');
      }
    } catch {
      showToast('创建失败', 'error');
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

  const selectedEquipment = availableEquipments.find((e) => e.id === formData.equipment_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">预约订单</h1>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增预约
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">订单状态</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">全部状态</option>
              {Object.entries(ORDER_STATUS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">订单号</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">器材</th>
                {!isCustomer && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">客户</th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">租借日期</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">天数</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">总租金</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">押金</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={isCustomer ? 8 : 9} className="px-4 py-12 text-center text-gray-500">加载中...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={isCustomer ? 8 : 9} className="px-4 py-12 text-center text-gray-500">暂无订单数据</td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{order.order_no}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{order.equipment?.brand} {order.equipment?.model}</div>
                      <div className="text-xs text-gray-500">{order.equipment?.equipment_no}</div>
                    </td>
                    {!isCustomer && (
                      <td className="px-4 py-3">
                        <div className="text-gray-900">{order.customer?.name}</div>
                        <div className="text-xs text-gray-500">{order.customer?.phone}</div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-gray-600">
                      <div>{formatDate(order.start_date)}</div>
                      <div className="text-xs flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" />
                        {formatDate(order.end_date)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{order.days} 天</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">¥{order.total_rent.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-600">¥{order.deposit.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge type="order" status={order.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openDetail(order)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {isClerk && order.status === 'pending' && (
                          <>
                            <button
                              onClick={() => handleConfirmOrder(order.id)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                              title="确认订单"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="取消订单"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {isCustomer && order.status === 'pending' && (
                          <button
                            onClick={() => handleCancelOrder(order.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="取消预约"
                          >
                            <XCircle className="w-4 h-4" />
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
                      "px-3 py-1.5 border rounded text-sm transition-colors",
                      pagination.page === pageNum
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-gray-300 hover:bg-gray-50"
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

      {detailModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">订单详情</h2>
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
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-gray-500">订单状态</span>
                  <div className="mt-1">
                    <StatusBadge type="order" status={selectedOrder.status} />
                  </div>
                </div>
                {isClerk && selectedOrder.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        handleConfirmOrder(selectedOrder.id);
                        setDetailModalOpen(false);
                      }}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                    >
                      <Check className="w-4 h-4" />
                      确认订单
                    </button>
                    <button
                      onClick={() => {
                        handleCancelOrder(selectedOrder.id);
                        setDetailModalOpen(false);
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
                    >
                      <X className="w-4 h-4" />
                      取消订单
                    </button>
                  </div>
                )}
                {isCustomer && selectedOrder.status === 'pending' && (
                  <button
                    onClick={() => {
                      handleCancelOrder(selectedOrder.id);
                      setDetailModalOpen(false);
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
                  >
                    <X className="w-4 h-4" />
                    取消预约
                  </button>
                )}
              </div>

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
                    <span className="font-medium">{selectedOrder.equipment?.spec}</span>
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
                  {selectedOrder.customer?.email && (
                    <div className="col-span-2">
                      <span className="text-gray-500">邮箱：</span>
                      <span className="font-medium">{selectedOrder.customer?.email}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h3 className="font-medium text-gray-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  租借信息
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">开始日期：</span>
                    <span className="font-medium">{formatDate(selectedOrder.start_date)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">结束日期：</span>
                    <span className="font-medium">{formatDate(selectedOrder.end_date)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">租借天数：</span>
                    <span className="font-medium">{selectedOrder.days} 天</span>
                  </div>
                  <div>
                    <span className="text-gray-500">日租金：</span>
                    <span className="font-medium">¥{selectedOrder.equipment?.daily_rent.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">总租金：</span>
                    <span className="font-medium text-green-600">¥{selectedOrder.total_rent.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">押金：</span>
                    <span className="font-medium">¥{selectedOrder.deposit.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {selectedOrder.lending && (
                <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-medium text-blue-900 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    出借记录
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-blue-600">出借日期：</span>
                      <span className="font-medium text-blue-900">{formatDateTime(selectedOrder.lending.lent_at)}</span>
                    </div>
                    <div>
                      <span className="text-blue-600">经办店员：</span>
                      <span className="font-medium text-blue-900">{selectedOrder.lending.handler_name}</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedOrder.return && (
                <div className={cn(
                  "rounded-xl p-4 space-y-3",
                  selectedOrder.return.is_damaged ? "bg-red-50" : selectedOrder.return.is_late ? "bg-amber-50" : "bg-purple-50"
                )}>
                  <h3 className={cn(
                    "font-medium flex items-center gap-2",
                    selectedOrder.return.is_damaged ? "text-red-900" : selectedOrder.return.is_late ? "text-amber-900" : "text-purple-900"
                  )}>
                    <Clock className="w-4 h-4" />
                    归还记录
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className={selectedOrder.return.is_damaged ? "text-red-600" : selectedOrder.return.is_late ? "text-amber-600" : "text-purple-600"}>归还日期：</span>
                      <span className={cn("font-medium", selectedOrder.return.is_damaged ? "text-red-900" : selectedOrder.return.is_late ? "text-amber-900" : "text-purple-900")}>
                        {formatDateTime(selectedOrder.return.actual_return_time)}
                      </span>
                    </div>
                    {selectedOrder.return.is_late > 0 && (
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span className="text-amber-900 font-medium">逾期归还</span>
                      </div>
                    )}
                    {selectedOrder.return.is_damaged > 0 && (
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-red-900 font-medium">
                          损坏：{selectedOrder.return.damage_level || '有损坏'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedOrder.settlement && (
                <div className="bg-green-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-medium text-green-900 flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    结算记录
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-green-600">结算日期：</span>
                      <span className="font-medium text-green-900">{formatDateTime(selectedOrder.settlement.settled_at)}</span>
                    </div>
                    <div>
                      <span className="text-green-600">总租金：</span>
                      <span className="font-medium text-green-900">¥{selectedOrder.total_rent.toFixed(2)}</span>
                    </div>
                    {selectedOrder.settlement.late_fee > 0 && (
                      <div>
                        <span className="text-amber-600">逾期费：</span>
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
                      <span className="text-green-600">应收总额：</span>
                      <span className="font-medium text-green-900">¥{selectedOrder.settlement.total_fee.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-green-600">押金抵扣：</span>
                      <span className="font-medium text-green-900">-¥{selectedOrder.settlement.deposit_deducted.toFixed(2)}</span>
                    </div>
                    {selectedOrder.settlement.refund_amount > 0 && (
                      <div>
                        <span className="text-green-600">退还押金：</span>
                        <span className="font-medium text-green-900">¥{selectedOrder.settlement.refund_amount.toFixed(2)}</span>
                      </div>
                    )}
                    {selectedOrder.settlement.additional_payment > 0 && (
                      <div>
                        <span className="text-red-600">需补付：</span>
                        <span className="font-medium text-red-600">¥{selectedOrder.settlement.additional_payment.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedOrder.remark && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-medium text-gray-900 mb-2">备注</h3>
                  <p className="text-gray-600 text-sm">{selectedOrder.remark}</p>
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

      {createModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">创建预约</h2>
              <button
                onClick={() => closeCreateModal()}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">选择器材 *</label>
                <select
                  value={formData.equipment_id}
                  onChange={(e) => setFormData({ ...formData, equipment_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  <option value={0}>请选择器材</option>
                  {availableEquipments.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.equipment_no} - {eq.brand} {eq.model} (¥{eq.daily_rent}/天)
                    </option>
                  ))}
                </select>
              </div>

              {selectedEquipment && (
                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                  <div className="flex items-center gap-2 text-blue-900 mb-1">
                    <Package className="w-4 h-4" />
                    <span className="font-medium">{selectedEquipment.brand} {selectedEquipment.model}</span>
                  </div>
                  <div className="text-blue-600 text-xs">
                    {EQUIPMENT_TYPES[selectedEquipment.type as keyof typeof EQUIPMENT_TYPES] || selectedEquipment.type}
                    {' · '}{selectedEquipment.spec}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">开始日期 *</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">结束日期 *</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    min={formData.start_date || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {checkingAvailability && (
                <div className="flex items-center gap-2 text-amber-600 text-sm">
                  <Clock className="w-4 h-4 animate-spin" />
                  正在检查器材可用性...
                </div>
              )}

              {availabilityError && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {availabilityError}
                </div>
              )}

              {orderSummary && !availabilityError && (
                <div className="bg-green-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                    <CheckCircle className="w-4 h-4" />
                    该器材在此时间段可用
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-green-600">租借天数：</span>
                      <span className="font-medium text-green-900">{orderSummary.days} 天</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600">日租金：</span>
                      <span className="font-medium text-green-900">¥{orderSummary.dailyRate.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600">总租金：</span>
                      <span className="font-medium text-green-900">¥{orderSummary.totalRent.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-600">押金：</span>
                      <span className="font-medium text-green-900">¥{orderSummary.deposit.toFixed(2)}</span>
                    </div>
                    <div className="col-span-2 flex justify-between border-t border-green-200 pt-2 mt-1">
                      <span className="text-green-700 font-medium">预计支付：</span>
                      <span className="font-bold text-green-900">¥{orderSummary.totalAmount.toFixed(2)}</span>
                    </div>
                    <div className="col-span-2 flex justify-between text-xs">
                      <span className="text-green-600">预计归还时间：</span>
                      <span className="font-medium text-green-700">{orderSummary.expectedReturn}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">备注</label>
                <textarea
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  rows={2}
                  placeholder="特殊需求或备注信息"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={handleCreateOrder}
                disabled={!orderSummary || !!availabilityError || checkingAvailability}
                className={cn(
                  "flex-1 py-2 rounded-lg font-medium transition-colors",
                  orderSummary && !availabilityError && !checkingAvailability
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                )}
              >
                确认预约
              </button>
              <button
                onClick={() => closeCreateModal()}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
