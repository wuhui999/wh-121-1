import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Wrench,
  Plus,
  Edit,
  X,
  ChevronLeft,
  ChevronRight,
  Package,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { api, REPAIR_STATUS, EQUIPMENT_STATUS } from '@/lib/api';
import { useAuthStore, useUIStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import { cn } from '@/lib/utils';

interface Repair {
  id: number;
  equipment_id: number;
  equipment: {
    id: number;
    equipment_no: string;
    type: string;
    brand: string;
    model: string;
    status: string;
  };
  description: string;
  status: string;
  repair_cost: number;
  sent_date: string;
  completed_date?: string;
  remark?: string;
  created_at: string;
  updated_at: string;
}

interface RawRepair {
  id: number;
  equipment_id: number;
  equipment_no: string;
  equipment_type: string;
  equipment_brand: string;
  equipment_model: string;
  equipment_status: string;
  description: string;
  status: string;
  repair_cost: number;
  sent_date: string;
  completed_date: string | null;
  remark: string | null;
  created_at: string;
}

function transformRepair(raw: RawRepair): Repair {
  return {
    id: raw.id,
    equipment_id: raw.equipment_id,
    equipment: {
      id: raw.equipment_id,
      equipment_no: raw.equipment_no,
      type: raw.equipment_type,
      brand: raw.equipment_brand,
      model: raw.equipment_model,
      status: raw.equipment_status,
    },
    description: raw.description,
    status: raw.status,
    repair_cost: raw.repair_cost || 0,
    sent_date: raw.sent_date,
    completed_date: raw.completed_date || undefined,
    remark: raw.remark || undefined,
    created_at: raw.created_at,
    updated_at: raw.created_at,
  };
}

interface Equipment {
  id: number;
  equipment_no: string;
  brand: string;
  model: string;
  status: string;
}

interface PaginationData {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export default function Repairs() {
  const { user } = useAuthStore();
  const { showToast } = useUIStore();

  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });

  const [statusFilter, setStatusFilter] = useState('');

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState<Repair | null>(null);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');

  const [formData, setFormData] = useState({
    equipment_id: 0,
    description: '',
    status: 'pending',
    repair_cost: 0,
    sent_date: new Date().toISOString().split('T')[0],
    completed_date: '',
    remark: '',
  });

  const [submitting, setSubmitting] = useState(false);

  const canManage = user?.role === 'admin' || user?.role === 'clerk';

  const fetchRepairs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;

      const response = await api.repairs.list(params);
      if (response.success && response.data) {
        const rawData = Array.isArray(response.data) ? response.data : response.data.list || response.data.data || [];
        const repairData = rawData.map((raw: RawRepair) => transformRepair(raw));
        setRepairs(repairData);
        setPagination((prev) => ({
          ...prev,
          total: repairData.length,
          totalPages: Math.ceil(repairData.length / prev.pageSize) || 1,
        }));
      }
    } catch {
      showToast('获取维修记录失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, showToast]);

  const fetchEquipments = useCallback(async () => {
    try {
      const response = await api.equipments.list();
      if (response.success && response.data) {
        const equipmentData = Array.isArray(response.data) ? response.data : response.data.data || [];
        setEquipments(equipmentData);
      }
    } catch {
      showToast('获取器材列表失败', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    fetchRepairs();
  }, [fetchRepairs]);

  useEffect(() => {
    if (formModalOpen) {
      fetchEquipments();
    }
  }, [formModalOpen, fetchEquipments]);

  const openCreateForm = () => {
    setFormMode('create');
    setFormData({
      equipment_id: 0,
      description: '',
      status: 'pending',
      repair_cost: 0,
      sent_date: new Date().toISOString().split('T')[0],
      completed_date: '',
      remark: '',
    });
    setFormModalOpen(true);
  };

  const openEditForm = (repair: Repair) => {
    setFormMode('edit');
    setSelectedRepair(repair);
    setFormData({
      equipment_id: repair.equipment_id,
      description: repair.description,
      status: repair.status,
      repair_cost: repair.repair_cost,
      sent_date: repair.sent_date.split('T')[0],
      completed_date: repair.completed_date ? repair.completed_date.split('T')[0] : '',
      remark: repair.remark || '',
    });
    setFormModalOpen(true);
  };

  const openDeleteModal = (repair: Repair) => {
    setSelectedRepair(repair);
    setDeleteModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.equipment_id) {
      showToast('请选择器材', 'error');
      return;
    }
    if (!formData.description.trim()) {
      showToast('请填写问题描述', 'error');
      return;
    }
    if ((formData.status === 'completed' || formData.status === 'scrapped') && !formData.completed_date) {
      showToast('请填写完成日期', 'error');
      return;
    }

    setSubmitting(true);
    try {
      let response;
      const submitData = {
        equipment_id: formData.equipment_id,
        description: formData.description,
        status: formData.status,
        repair_cost: formData.repair_cost,
        sent_date: formData.sent_date,
        completed_date: (formData.status === 'completed' || formData.status === 'scrapped')
          ? formData.completed_date || new Date().toISOString().split('T')[0]
          : null,
        remark: formData.remark,
      };

      if (formMode === 'create') {
        response = await api.repairs.create(submitData);
      } else if (selectedRepair) {
        response = await api.repairs.update(selectedRepair.id, submitData);

        if (response.success && (formData.status === 'completed' || formData.status === 'scrapped')) {
          const newEquipmentStatus = formData.status === 'completed' ? 'available' : 'maintenance';
          await api.equipments.update(formData.equipment_id, {
            status: newEquipmentStatus,
          });
        }
      }

      if (response?.success) {
        showToast(formMode === 'create' ? '创建成功' : '更新成功', 'success');
        setFormModalOpen(false);
        fetchRepairs();
      } else {
        showToast(response?.error || '操作失败', 'error');
      }
    } catch {
      showToast('操作失败', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRepair) return;

    try {
      const response = await api.repairs.delete(selectedRepair.id);
      if (response.success) {
        showToast('删除成功', 'success');
        setDeleteModalOpen(false);
        fetchRepairs();
      } else {
        showToast(response.error || '删除失败', 'error');
      }
    } catch {
      showToast('删除失败', 'error');
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

  const paginatedRepairs = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return repairs.slice(start, end);
  }, [repairs, pagination.page, pagination.pageSize]);

  const selectedEquipment = equipments.find((e) => e.id === formData.equipment_id);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">维修管理</h1>
        {canManage && (
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新增维修
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-40">
            <label className="block text-sm font-medium text-gray-700 mb-1">维修状态</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              <option value="">全部状态</option>
              {Object.entries(REPAIR_STATUS).map(([key, label]) => (
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">器材</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">问题描述</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">送修日期</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">完成日期</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">维修费用</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">加载中...</td>
                </tr>
              ) : paginatedRepairs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">暂无维修记录</td>
                </tr>
              ) : (
                paginatedRepairs.map((repair) => (
                  <tr key={repair.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{repair.equipment?.brand} {repair.equipment?.model}</div>
                      <div className="text-xs text-gray-500">{repair.equipment?.equipment_no}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[250px]">
                      <div className="text-gray-600 truncate" title={repair.description}>
                        {repair.description}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge type="repair" status={repair.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(repair.sent_date)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {repair.completed_date ? formatDate(repair.completed_date) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {repair.repair_cost > 0 ? (
                        <span className="text-gray-900 font-medium">¥{repair.repair_cost.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {canManage && (
                          <>
                            <button
                              onClick={() => openEditForm(repair)}
                              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                              title="编辑"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {repair.status === 'pending' && (
                              <button
                                onClick={() => openDeleteModal(repair)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="删除"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
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

      {formModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {formMode === 'create' ? '新增维修记录' : '编辑维修记录'}
              </h2>
              <button
                onClick={() => setFormModalOpen(false)}
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
                  disabled={formMode === 'edit'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value={0}>请选择器材</option>
                  {equipments.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.equipment_no} - {eq.brand} {eq.model} ({EQUIPMENT_STATUS[eq.status as keyof typeof EQUIPMENT_STATUS] || eq.status})
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
                    当前状态：{EQUIPMENT_STATUS[selectedEquipment.status as keyof typeof EQUIPMENT_STATUS] || selectedEquipment.status}
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">问题描述 *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="请描述器材的故障或问题"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">送修日期 *</label>
                  <input
                    type="date"
                    value={formData.sent_date}
                    onChange={(e) => setFormData({ ...formData, sent_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">维修状态</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {Object.entries(REPAIR_STATUS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(formData.status === 'completed' || formData.status === 'scrapped') && (
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">完成日期 *</label>
                  <input
                    type="date"
                    value={formData.completed_date}
                    onChange={(e) => setFormData({ ...formData, completed_date: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">维修费用</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="number"
                    value={formData.repair_cost}
                    onChange={(e) => setFormData({ ...formData, repair_cost: Number(e.target.value) })}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {formMode === 'edit' && formData.status === 'completed' && (
                <div className="bg-green-50 rounded-lg p-3 text-sm flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-green-800">
                    <p className="font-medium">状态变更提醒</p>
                    <p className="text-xs mt-0.5">保存后器材状态将自动更新为「可用」</p>
                  </div>
                </div>
              )}

              {formMode === 'edit' && formData.status === 'scrapped' && (
                <div className="bg-red-50 rounded-lg p-3 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-red-800">
                    <p className="font-medium">报废提醒</p>
                    <p className="text-xs mt-0.5">保存后器材状态将自动更新为「保养中（报废）」，此操作不可撤销</p>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">备注</label>
                <textarea
                  value={formData.remark}
                  onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                  rows={2}
                  placeholder="维修备注或说明"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-gray-200">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {submitting ? '保存中...' : (formMode === 'create' ? '创建' : '保存')}
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

      {deleteModalOpen && selectedRepair && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">确认删除</h2>
              <p className="text-gray-600 mb-6">
                确定要删除 <span className="font-medium text-gray-900">{selectedRepair.equipment?.brand} {selectedRepair.equipment?.model}</span> 的维修记录吗？此操作不可撤销。
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
