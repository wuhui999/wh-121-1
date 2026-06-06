import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Package,
  Tag,
  CircleDollarSign,
} from 'lucide-react';
import { api, EQUIPMENT_TYPES, EQUIPMENT_STATUS } from '@/lib/api';
import { useAuthStore, useUIStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

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
  description?: string;
  purchase_date?: string;
  purchase_price?: number;
  created_at: string;
  updated_at: string;
}

interface PaginationData {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function Equipments() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });

  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');

  const [formData, setFormData] = useState({
    equipment_no: '',
    type: 'camera',
    brand: '',
    model: '',
    spec: '',
    status: 'available',
    daily_rent: 0,
    deposit: 0,
    description: '',
  });

  const canManage = user?.role === 'admin' || user?.role === 'clerk';

  const fetchEquipments = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        page: pagination.page,
        pageSize: pagination.pageSize,
      };
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      if (searchKeyword) params.keyword = searchKeyword;

      const response = await api.equipments.list(params);
      if (response.success && response.data) {
        if (Array.isArray(response.data)) {
          setEquipments(response.data);
          setPagination((prev) => ({
            ...prev,
            total: response.data.length,
            totalPages: Math.ceil(response.data.length / pagination.pageSize) || 1,
          }));
        } else if (response.data.data) {
          setEquipments(response.data.data);
          setPagination({
            page: response.data.page || 1,
            pageSize: response.data.pageSize || 10,
            total: response.data.total || 0,
            totalPages: response.data.totalPages || 1,
          });
        }
      }
    } catch {
      showToast('获取器材列表失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, typeFilter, statusFilter, searchKeyword, showToast]);

  useEffect(() => {
    fetchEquipments();
  }, [fetchEquipments]);

  const handleSearch = () => {
    setSearchKeyword(keyword.trim());
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleReset = () => {
    setTypeFilter('');
    setStatusFilter('');
    setKeyword('');
    setSearchKeyword('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const openDetail = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setDetailModalOpen(true);
  };

  const openCreateForm = () => {
    setFormMode('create');
    setFormData({
      equipment_no: '',
      type: 'camera',
      brand: '',
      model: '',
      spec: '',
      status: 'available',
      daily_rent: 0,
      deposit: 0,
      description: '',
    });
    setFormModalOpen(true);
  };

  const openEditForm = (equipment: Equipment) => {
    setFormMode('edit');
    setSelectedEquipment(equipment);
    setFormData({
      equipment_no: equipment.equipment_no,
      type: equipment.type,
      brand: equipment.brand,
      model: equipment.model,
      spec: equipment.spec,
      status: equipment.status,
      daily_rent: equipment.daily_rent,
      deposit: equipment.deposit,
      description: equipment.description || '',
    });
    setFormModalOpen(true);
  };

  const openDeleteModal = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    setDeleteModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.equipment_no.trim()) {
      showToast('请输入器材编号', 'error');
      return;
    }
    if (!formData.brand.trim()) {
      showToast('请输入品牌', 'error');
      return;
    }

    try {
      let response;
      if (formMode === 'create') {
        response = await api.equipments.create(formData);
      } else if (selectedEquipment) {
        response = await api.equipments.update(selectedEquipment.id, formData);
      }

      if (response?.success) {
        showToast(formMode === 'create' ? '创建成功' : '更新成功', 'success');
        setFormModalOpen(false);
        fetchEquipments();
      } else {
        showToast(response?.error || '操作失败', 'error');
      }
    } catch {
      showToast('操作失败', 'error');
    }
  };

  const handleDelete = async () => {
    if (!selectedEquipment) return;

    try {
      const response = await api.equipments.delete(selectedEquipment.id);
      if (response.success) {
        showToast('删除成功', 'success');
        setDeleteModalOpen(false);
        fetchEquipments();
      } else {
        showToast(response.error || '删除失败', 'error');
      }
    } catch {
      showToast('删除失败', 'error');
    }
  };

  const handleReserve = (equipment: Equipment) => {
    if (equipment.status !== 'available') {
      showToast('该器材当前不可预约', 'error');
      return;
    }
    navigate('/orders', { state: { equipmentId: equipment.id } });
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination((prev) => ({ ...prev, page: newPage }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">器材库</h1>
        {canManage && (
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新增器材
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">关键词搜索</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="搜索器材编号、品牌、型号..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">器材类型</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">全部类型</option>
              {Object.entries(EQUIPMENT_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">全部状态</option>
              {Object.entries(EQUIPMENT_STATUS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <Filter className="w-4 h-4" />
              搜索
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              重置
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">器材编号</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">类型</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">品牌</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">规格</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">日租金</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">押金</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">加载中...</td>
                </tr>
              ) : equipments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">暂无器材数据</td>
                </tr>
              ) : (
                equipments.map((eq) => (
                  <tr key={eq.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{eq.equipment_no}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {EQUIPMENT_TYPES[eq.type as keyof typeof EQUIPMENT_TYPES] || eq.type}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{eq.brand} {eq.model}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-[150px] truncate">{eq.spec}</td>
                    <td className="px-4 py-3">
                      <StatusBadge type="equipment" status={eq.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">¥{eq.daily_rent.toFixed(2)}</td>
                    <td className="px-4 py-3 text-gray-600">¥{eq.deposit.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openDetail(eq)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleReserve(eq)}
                          className={cn(
                            "p-1.5 rounded transition-colors",
                            eq.status === 'available'
                              ? "text-green-600 hover:bg-green-50"
                              : "text-gray-300 cursor-not-allowed"
                          )}
                          title={eq.status === 'available' ? '预约' : '不可预约'}
                        >
                          <Calendar className="w-4 h-4" />
                        </button>
                        {canManage && (
                          <>
                            <button
                              onClick={() => openEditForm(eq)}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                              title="编辑"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openDeleteModal(eq)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
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

      {detailModalOpen && selectedEquipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">器材详情</h2>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-gray-500 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    器材编号
                  </label>
                  <p className="font-medium text-gray-900">{selectedEquipment.equipment_no}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-500">类型</label>
                  <p className="font-medium text-gray-900">
                    {EQUIPMENT_TYPES[selectedEquipment.type as keyof typeof EQUIPMENT_TYPES] || selectedEquipment.type}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-500">品牌</label>
                  <p className="font-medium text-gray-900">{selectedEquipment.brand}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-500">型号</label>
                  <p className="font-medium text-gray-900">{selectedEquipment.model}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-500 flex items-center gap-1">
                    <CircleDollarSign className="w-3 h-3" />
                    日租金
                  </label>
                  <p className="font-medium text-gray-900">¥{selectedEquipment.daily_rent.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-500">押金</label>
                  <p className="font-medium text-gray-900">¥{selectedEquipment.deposit.toFixed(2)}</p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-500">状态</label>
                  <StatusBadge type="equipment" status={selectedEquipment.status} />
                </div>
                {selectedEquipment.purchase_price && (
                  <div className="space-y-1">
                    <label className="text-sm text-gray-500">购置价格</label>
                    <p className="font-medium text-gray-900">¥{selectedEquipment.purchase_price.toFixed(2)}</p>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-sm text-gray-500 flex items-center gap-1">
                  <Package className="w-3 h-3" />
                  规格
                </label>
                <p className="font-medium text-gray-900">{selectedEquipment.spec}</p>
              </div>
              {selectedEquipment.description && (
                <div className="space-y-1">
                  <label className="text-sm text-gray-500">描述</label>
                  <p className="text-gray-600">{selectedEquipment.description}</p>
                </div>
              )}
              {selectedEquipment.purchase_date && (
                <div className="space-y-1">
                  <label className="text-sm text-gray-500">购置日期</label>
                  <p className="font-medium text-gray-900">{selectedEquipment.purchase_date}</p>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={() => handleReserve(selectedEquipment)}
                disabled={selectedEquipment.status !== 'available'}
                className={cn(
                  "flex-1 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-2",
                  selectedEquipment.status === 'available'
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-200 text-gray-400 cursor-not-allowed"
                )}
              >
                <Calendar className="w-4 h-4" />
                {selectedEquipment.status === 'available' ? '立即预约' : '不可预约'}
              </button>
              <button
                onClick={() => setDetailModalOpen(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {formModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {formMode === 'create' ? '新增器材' : '编辑器材'}
              </h2>
              <button
                onClick={() => setFormModalOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">器材编号 *</label>
                  <input
                    type="text"
                    value={formData.equipment_no}
                    onChange={(e) => setFormData({ ...formData, equipment_no: e.target.value })}
                    placeholder="如：CAM-001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">类型 *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {Object.entries(EQUIPMENT_TYPES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">品牌 *</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="如：Canon"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">型号</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="如：EOS R5"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">日租金 *</label>
                  <input
                    type="number"
                    value={formData.daily_rent}
                    onChange={(e) => setFormData({ ...formData, daily_rent: Number(e.target.value) })}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">押金 *</label>
                  <input
                    type="number"
                    value={formData.deposit}
                    onChange={(e) => setFormData({ ...formData, deposit: Number(e.target.value) })}
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                {formMode === 'edit' && (
                  <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">状态</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    >
                      {Object.entries(EQUIPMENT_STATUS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">规格</label>
                <input
                  type="text"
                  value={formData.spec}
                  onChange={(e) => setFormData({ ...formData, spec: e.target.value })}
                  placeholder="器材规格参数"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="器材补充说明"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={handleSubmit}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                {formMode === 'create' ? '创建' : '保存'}
              </button>
              <button
                onClick={() => setFormModalOpen(false)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteModalOpen && selectedEquipment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">确认删除</h2>
              <p className="text-gray-600 mb-6">
                确定要删除器材 <span className="font-medium text-gray-900">{selectedEquipment.equipment_no}</span> 吗？此操作不可撤销。
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  确认删除
                </button>
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
