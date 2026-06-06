import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

interface Equipment {
  id: number;
  equipment_no: string;
  type: string;
  brand: string;
  model: string;
  spec: string | null;
  status: string;
  daily_rent: number;
  deposit: number;
  purchase_price: number | null;
  purchase_date: string | null;
  description: string | null;
  created_at: string;
}

const router = Router();

router.get('/', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { type, status, keyword } = req.query;

    let sql = 'SELECT * FROM equipments WHERE 1=1';
    const params: any[] = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (keyword) {
      sql += ' AND (equipment_no LIKE ? OR brand LIKE ? OR model LIKE ? OR spec LIKE ? OR description LIKE ?)';
      const search = `%${keyword}%`;
      params.push(search, search, search, search, search);
    }

    sql += ' ORDER BY created_at DESC';

    const equipments = db.prepare(sql).all(...params);
    res.json({ success: true, data: equipments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/available', authenticateToken, (req: Request, res: Response): void => {
  try {
    const equipments = db.prepare(
      "SELECT * FROM equipments WHERE status NOT IN ('lent', 'repairing') ORDER BY created_at DESC"
    ).all();
    res.json({ success: true, data: equipments });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const equipment = db.prepare('SELECT * FROM equipments WHERE id = ?').get(id);

    if (!equipment) {
      res.status(404).json({ success: false, error: '器材不存在' });
      return;
    }

    res.json({ success: true, data: equipment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', authenticateToken, requireRole('clerk', 'admin'), (req: Request, res: Response): void => {
  try {
    const { equipment_no, type, brand, model, spec, status, daily_rent, deposit, purchase_price, purchase_date, description } = req.body;

    if (!equipment_no || !type || !brand || !model || daily_rent === undefined || deposit === undefined) {
      res.status(400).json({ success: false, error: '缺少必填字段' });
      return;
    }

    const validTypes = ['camera', 'lens', 'light', 'tripod', 'accessory'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ success: false, error: '无效的器材类型' });
      return;
    }

    const validStatuses = ['available', 'reserved', 'lent', 'repairing', 'maintenance'];
    const equipStatus = status || 'available';
    if (!validStatuses.includes(equipStatus)) {
      res.status(400).json({ success: false, error: '无效的器材状态' });
      return;
    }

    const existing = db.prepare('SELECT id FROM equipments WHERE equipment_no = ?').get(equipment_no);
    if (existing) {
      res.status(400).json({ success: false, error: '器材编号已存在' });
      return;
    }

    const info = db.prepare(`
      INSERT INTO equipments (equipment_no, type, brand, model, spec, status, daily_rent, deposit, purchase_price, purchase_date, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(equipment_no, type, brand, model, spec || null, equipStatus, daily_rent, deposit, purchase_price || null, purchase_date || null, description || null);

    const equipment = db.prepare('SELECT * FROM equipments WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json({ success: true, data: equipment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:id', authenticateToken, requireRole('clerk', 'admin'), (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { equipment_no, type, brand, model, spec, status, daily_rent, deposit, purchase_price, purchase_date, description } = req.body;

    const existing = db.prepare('SELECT * FROM equipments WHERE id = ?').get(id) as Equipment | undefined;
    if (!existing) {
      res.status(404).json({ success: false, error: '器材不存在' });
      return;
    }

    if (equipment_no && equipment_no !== existing.equipment_no) {
      const duplicate = db.prepare('SELECT id FROM equipments WHERE equipment_no = ? AND id != ?').get(equipment_no, id);
      if (duplicate) {
        res.status(400).json({ success: false, error: '器材编号已存在' });
        return;
      }
    }

    if (type) {
      const validTypes = ['camera', 'lens', 'light', 'tripod', 'accessory'];
      if (!validTypes.includes(type)) {
        res.status(400).json({ success: false, error: '无效的器材类型' });
        return;
      }
    }

    if (status) {
      const validStatuses = ['available', 'reserved', 'lent', 'repairing', 'maintenance'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ success: false, error: '无效的器材状态' });
        return;
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (equipment_no !== undefined) { updates.push('equipment_no = ?'); params.push(equipment_no); }
    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (brand !== undefined) { updates.push('brand = ?'); params.push(brand); }
    if (model !== undefined) { updates.push('model = ?'); params.push(model); }
    if (spec !== undefined) { updates.push('spec = ?'); params.push(spec); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (daily_rent !== undefined) { updates.push('daily_rent = ?'); params.push(daily_rent); }
    if (deposit !== undefined) { updates.push('deposit = ?'); params.push(deposit); }
    if (purchase_price !== undefined) { updates.push('purchase_price = ?'); params.push(purchase_price); }
    if (purchase_date !== undefined) { updates.push('purchase_date = ?'); params.push(purchase_date); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }

    if (updates.length === 0) {
      res.status(400).json({ success: false, error: '没有提供更新字段' });
      return;
    }

    params.push(id);
    db.prepare(`UPDATE equipments SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const equipment = db.prepare('SELECT * FROM equipments WHERE id = ?').get(id);
    res.json({ success: true, data: equipment });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', authenticateToken, requireRole('admin'), (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const equipment = db.prepare('SELECT * FROM equipments WHERE id = ?').get(id);

    if (!equipment) {
      res.status(404).json({ success: false, error: '器材不存在' });
      return;
    }

    const relatedOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE equipment_id = ? AND status IN ('pending', 'confirmed', 'lent')").get(id) as { count: number };
    if (relatedOrders.count > 0) {
      res.status(400).json({ success: false, error: '该器材存在未完成的订单，无法删除' });
      return;
    }

    db.prepare('DELETE FROM equipments WHERE id = ?').run(id);
    res.json({ success: true, data: { message: '删除成功' } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id/availability', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      res.status(400).json({ success: false, error: '请提供开始日期和结束日期' });
      return;
    }

    const equipment = db.prepare('SELECT * FROM equipments WHERE id = ?').get(id) as Equipment | undefined;
    if (!equipment) {
      res.status(404).json({ success: false, error: '器材不存在' });
      return;
    }

    const conflictingOrders = db.prepare(`
      SELECT * FROM orders 
      WHERE equipment_id = ? 
        AND status IN ('pending', 'confirmed', 'lent')
        AND start_date <= ?
        AND end_date >= ?
    `).all(id, end_date, start_date);

    const isAvailable = conflictingOrders.length === 0 && equipment.status !== 'lent' && equipment.status !== 'repairing';

    res.json({
      success: true,
      data: {
        available: isAvailable,
        equipment_status: equipment.status,
        conflicting_orders: conflictingOrders
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
