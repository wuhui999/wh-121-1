import { Router, type Request, type Response } from 'express';
import db from '../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

interface Order {
  id: number;
  order_no: string;
  customer_id: number;
  equipment_id: number;
  start_date: string;
  end_date: string;
  expected_return_time: string;
  days: number;
  total_rent: number;
  deposit: number;
  status: string;
  remark: string | null;
  created_by: number;
  confirmed_by: number | null;
  created_at: string;
  confirmed_at: string | null;
}

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

interface ReturnRecord {
  id: number;
  order_id: number;
  equipment_id: number;
  actual_return_time: string;
  is_late: number;
  late_hours: number;
  late_fee: number;
  is_damaged: number;
  damage_level: string | null;
  damage_description: string | null;
  damage_fee: number;
  is_missing: number;
  missing_items: string | null;
  missing_fee: number;
  repair_suggestion: string | null;
  photo_url: string | null;
  handler_id: number;
  remark: string | null;
  handler_name?: string;
  equipment_no?: string;
  order_no?: string;
}

const router = Router();

router.get('/', authenticateToken, requireRole('clerk', 'admin'), (req: Request, res: Response): void => {
  try {
    const { page = 1, pageSize = 10, is_late, is_damaged } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    let whereClause = '';
    const params: (string | number)[] = [];

    if (is_late !== undefined) {
      whereClause += 'r.is_late = ?';
      params.push(Number(is_late));
    }

    if (is_damaged !== undefined) {
      if (whereClause) whereClause += ' AND ';
      whereClause += 'r.is_damaged = ?';
      params.push(Number(is_damaged));
    }

    const countQuery = `
      SELECT COUNT(*) as total FROM returns r
      ${whereClause ? 'WHERE ' + whereClause : ''}
    `;
    const { total } = db.prepare(countQuery).get(...params) as { total: number };

    const listQuery = `
      SELECT r.*, 
             o.order_no,
             e.equipment_no, e.type, e.brand, e.model,
             u.name as handler_name
      FROM returns r
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN equipments e ON r.equipment_id = e.id
      LEFT JOIN users u ON r.handler_id = u.id
      ${whereClause ? 'WHERE ' + whereClause : ''}
      ORDER BY r.actual_return_time DESC
      LIMIT ? OFFSET ?
    `;
    const list = db.prepare(listQuery).all(...params, Number(pageSize), offset);

    res.json({
      success: true,
      data: {
        list,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }
    });
  } catch (_error) {
    res.status(500).json({ success: false, error: '获取归还记录列表失败' });
  }
});

router.get('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const query = `
      SELECT r.*,
             o.order_no, o.expected_return_time,
             e.equipment_no, e.type, e.brand, e.model, e.daily_rent, e.deposit,
             u.name as handler_name
      FROM returns r
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN equipments e ON r.equipment_id = e.id
      LEFT JOIN users u ON r.handler_id = u.id
      WHERE r.id = ?
    `;
    const returnRecord = db.prepare(query).get(id) as ReturnRecord | undefined;

    if (!returnRecord) {
      res.status(404).json({ success: false, error: '归还记录不存在' });
      return;
    }

    res.json({
      success: true,
      data: returnRecord
    });
  } catch (_error) {
    res.status(500).json({ success: false, error: '获取归还记录详情失败' });
  }
});

router.post('/', authenticateToken, requireRole('clerk', 'admin'), (req: Request, res: Response): void => {
  try {
    const {
      order_id,
      actual_return_time,
      is_damaged,
      damage_level,
      damage_description,
      is_missing,
      missing_items,
      missing_fee,
      repair_suggestion,
      photo_url,
      remark
    } = req.body;

    if (!order_id) {
      res.status(400).json({ success: false, error: '缺少订单ID' });
      return;
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id) as Order | undefined;
    if (!order) {
      res.status(404).json({ success: false, error: '订单不存在' });
      return;
    }

    if (order.status !== 'lent') {
      res.status(400).json({ success: false, error: '只有租借中状态的订单可以归还' });
      return;
    }

    const existingReturn = db.prepare('SELECT id FROM returns WHERE order_id = ?').get(order_id);
    if (existingReturn) {
      res.status(400).json({ success: false, error: '该订单已存在归还记录' });
      return;
    }

    const equipment = db.prepare('SELECT * FROM equipments WHERE id = ?').get(order.equipment_id) as Equipment | undefined;
    if (!equipment) {
      res.status(404).json({ success: false, error: '器材不存在' });
      return;
    }

    const actualReturnTime = actual_return_time ? new Date(actual_return_time) : new Date();
    if (isNaN(actualReturnTime.getTime())) {
      res.status(400).json({ success: false, error: '实际归还时间格式无效' });
      return;
    }

    const expectedReturnTime = new Date(order.expected_return_time);
    const diffMs = actualReturnTime.getTime() - expectedReturnTime.getTime();
    const late_hours = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
    const is_late = late_hours > 0 ? 1 : 0;

    const hourly_rate = equipment.daily_rent / 24;
    const late_fee = is_late ? Number((late_hours * hourly_rate * 1.5).toFixed(2)) : 0;

    const validDamageLevels = ['none', 'minor', 'moderate', 'severe'];
    const finalDamageLevel = is_damaged ? (damage_level || 'minor') : 'none';
    if (is_damaged && !validDamageLevels.includes(finalDamageLevel)) {
      res.status(400).json({ success: false, error: '无效的损坏等级' });
      return;
    }

    let damage_fee = 0;
    if (is_damaged) {
      switch (finalDamageLevel) {
        case 'minor':
          damage_fee = Number((equipment.daily_rent * 1).toFixed(2));
          break;
        case 'moderate':
          damage_fee = Number((equipment.daily_rent * 3).toFixed(2));
          break;
        case 'severe':
          damage_fee = Number((equipment.deposit * 0.5).toFixed(2));
          break;
      }
    }

    const handler_id = req.user!.id;
    const actualReturnTimeStr = actualReturnTime.toISOString().slice(0, 19).replace('T', ' ');

    const insertReturn = db.prepare(`
      INSERT INTO returns (
        order_id, equipment_id, actual_return_time, is_late, late_hours, late_fee,
        is_damaged, damage_level, damage_description, damage_fee,
        is_missing, missing_items, missing_fee, repair_suggestion, photo_url,
        handler_id, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertReturn.run(
      order_id,
      order.equipment_id,
      actualReturnTimeStr,
      is_late,
      late_hours,
      late_fee,
      is_damaged ? 1 : 0,
      finalDamageLevel,
      damage_description || null,
      damage_fee,
      is_missing ? 1 : 0,
      missing_items || null,
      missing_fee || 0,
      repair_suggestion || null,
      photo_url || null,
      handler_id,
      remark || null
    );

    db.prepare("UPDATE orders SET status = 'returned' WHERE id = ?").run(order_id);

    let equipmentStatus = 'available';
    if (is_damaged && repair_suggestion && repair_suggestion.trim() !== '') {
      equipmentStatus = 'repairing';
    }

    db.prepare('UPDATE equipments SET status = ? WHERE id = ?').run(equipmentStatus, order.equipment_id);

    if (equipmentStatus === 'repairing') {
      db.prepare(`
        INSERT INTO repairs (equipment_id, return_id, description, repair_cost, status, handler_id, remark)
        VALUES (?, ?, ?, ?, 'pending', ?, ?)
      `).run(
        order.equipment_id,
        result.lastInsertRowid,
        damage_description || repair_suggestion,
        null,
        handler_id,
        repair_suggestion
      );
    }

    const query = `
      SELECT r.*,
             o.order_no, o.expected_return_time,
             e.equipment_no, e.type, e.brand, e.model, e.daily_rent, e.deposit,
             u.name as handler_name
      FROM returns r
      LEFT JOIN orders o ON r.order_id = o.id
      LEFT JOIN equipments e ON r.equipment_id = e.id
      LEFT JOIN users u ON r.handler_id = u.id
      WHERE r.id = ?
    `;
    const newReturn = db.prepare(query).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      data: newReturn
    });
  } catch (_error) {
    res.status(500).json({ success: false, error: '创建归还记录失败' });
  }
});

export default router;
