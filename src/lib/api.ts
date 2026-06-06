const API_BASE = 'http://localhost:3001/api';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络请求失败',
    };
  }
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
    register: (data: any) =>
      request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    me: () => request('/auth/me'),
    users: () => request('/auth/users'),
    updateUser: (id: number, data: any) =>
      request(`/auth/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    deleteUser: (id: number) =>
      request(`/auth/users/${id}`, { method: 'DELETE' }),
  },

  equipments: {
    list: (params?: { type?: string; status?: string; keyword?: string }) => {
      const query = new URLSearchParams(params as any).toString();
      return request(`/equipments${query ? `?${query}` : ''}`);
    },
    available: () => request('/equipments/available'),
    get: (id: number) => request(`/equipments/${id}`),
    checkAvailability: (id: number, start_date: string, end_date: string) =>
      request(
        `/equipments/${id}/availability?start_date=${start_date}&end_date=${end_date}`
      ),
    create: (data: any) =>
      request('/equipments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: any) =>
      request(`/equipments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: number) => request(`/equipments/${id}`, { method: 'DELETE' }),
  },

  orders: {
    list: (params?: { status?: string; page?: number; pageSize?: number }) => {
      const query = new URLSearchParams(params as any).toString();
      return request(`/orders${query ? `?${query}` : ''}`);
    },
    get: (id: number) => request(`/orders/${id}`),
    create: (data: any) =>
      request('/orders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    confirm: (id: number) =>
      request(`/orders/${id}/confirm`, { method: 'PUT' }),
    cancel: (id: number) =>
      request(`/orders/${id}/cancel`, { method: 'PUT' }),
  },

  lendings: {
    list: (params?: { page?: number; pageSize?: number }) => {
      const query = new URLSearchParams(params as any).toString();
      return request(`/lendings${query ? `?${query}` : ''}`);
    },
    get: (id: number) => request(`/lendings/${id}`),
    create: (data: any) =>
      request('/lendings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  returns: {
    list: (params?: {
      is_late?: number;
      is_damaged?: number;
      page?: number;
      pageSize?: number;
    }) => {
      const query = new URLSearchParams(params as any).toString();
      return request(`/returns${query ? `?${query}` : ''}`);
    },
    get: (id: number) => request(`/returns/${id}`),
    create: (data: any) =>
      request('/returns', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  settlements: {
    list: (params?: { page?: number; pageSize?: number }) => {
      const query = new URLSearchParams(params as any).toString();
      return request(`/settlements${query ? `?${query}` : ''}`);
    },
    get: (id: number) => request(`/settlements/${id}`),
    create: (data: any) =>
      request('/settlements', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  repairs: {
    list: (params?: { status?: string; equipment_id?: number }) => {
      const query = new URLSearchParams(params as any).toString();
      return request(`/repairs${query ? `?${query}` : ''}`);
    },
    get: (id: number) => request(`/repairs/${id}`),
    create: (data: any) =>
      request('/repairs', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: any) =>
      request(`/repairs/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: number) => request(`/repairs/${id}`, { method: 'DELETE' }),
  },
};

export const EQUIPMENT_TYPES = {
  camera: '相机',
  lens: '镜头',
  light: '灯具',
  tripod: '脚架',
  accessory: '配件',
};

export const EQUIPMENT_STATUS = {
  available: '可用',
  reserved: '已预约',
  lent: '已出借',
  repairing: '维修中',
  maintenance: '保养中',
};

export const ORDER_STATUS = {
  pending: '待确认',
  confirmed: '已确认',
  lent: '已出借',
  returned: '已归还',
  settled: '已结算',
  cancelled: '已取消',
};

export const REPAIR_STATUS = {
  pending: '待处理',
  repairing: '维修中',
  completed: '已完成',
  scrapped: '已报废',
};

export const DAMAGE_LEVELS = {
  none: '无损坏',
  minor: '轻微',
  moderate: '中等',
  severe: '严重',
};

export const ROLES = {
  customer: '客户',
  clerk: '店员',
  finance: '财务',
  admin: '管理员',
};
