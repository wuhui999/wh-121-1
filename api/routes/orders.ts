import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authenticateToken, requireRole } from '../middleware/auth.js'

interface Order {
  id: number
  order_no: string
  customer_id: number
  equipment_id: number
  start_date: string
  end_date: string
  expected_return_time: string
  days: number
  total_rent: number
  deposit: number
  status: string
  remark: string | null
  created_by: number
  confirmed_by: number | null
  created_at: string
  confirmed_at: string | null
}

interface Equipment {
  id: number
  equipment_no: string
  type: string
  brand: string
  model: string
  spec: string | null
  status: string
  daily_rent: number
  deposit: number
  purchase_price: number | null
  purchase_date: string | null
  description: string | null
  created_at: string
}

interface OrderDetail extends Order {
  equipment_no: string
  type: string
  brand: string
  model: string
  spec: string | null
  daily_rent: number
  equipment_deposit: number
  equipment_description: string | null
  customer_name: string
  customer_phone: string
  customer_email: string
  created_by_name: string
  confirmed_by_name: string
}

interface Lending {
  id: number
  order_id: number
  equipment_id: number
  appearance: string | null
  accessories: string | null
  deposit_received: number
  handler_id: number
  lent_at: string
  remark: string | null
  handler_name: string
}

interface ReturnRecord {
  id: number
  order_id: number
  equipment_id: number
  actual_return_time: string
  is_late: number
  late_hours: number
  late_fee: number
  is_damaged: number
  damage_level: string | null
  damage_description: string | null
  damage_fee: number
  is_missing: number
  missing_items: string | null
  missing_fee: number
  repair_suggestion: string | null
  photo_url: string | null
  handler_id: number
  remark: string | null
  handler_name: string
}

interface Settlement {
  id: number
  order_id: number
  total_rent: number
  late_fee: number
  damage_fee: number
  missing_fee: number
  total_fee: number
  deposit_received: number
  deposit_deducted: number
  refund_amount: number
  additional_payment: number
  settled_by: number
  settled_at: string
  remark: string | null
  settled_by_name: string
}

const router = Router()

router.get('/', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { status, page = 1, pageSize = 10 } = req.query
    const offset = (Number(page) - 1) * Number(pageSize)

    let whereClause = ''
    const params: any[] = []

    if (req.user?.role === 'customer') {
      whereClause += 'o.customer_id = ?'
      params.push(req.user.id)
    }

    if (status) {
      if (whereClause) whereClause += ' AND '
      whereClause += 'o.status = ?'
      params.push(status)
    }

    const countQuery = `
      SELECT COUNT(*) as total FROM orders o
      ${whereClause ? 'WHERE ' + whereClause : ''}
    `
    const { total } = db.prepare(countQuery).get(...params) as { total: number }

    const listQuery = `
      SELECT o.*, 
             e.equipment_no, e.type, e.brand, e.model, e.daily_rent,
             u.name as customer_name, u.phone as customer_phone
      FROM orders o
      LEFT JOIN equipments e ON o.equipment_id = e.id
      LEFT JOIN users u ON o.customer_id = u.id
      ${whereClause ? 'WHERE ' + whereClause : ''}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `
    const list = db.prepare(listQuery).all(...params, Number(pageSize), offset)

    res.json({
      success: true,
      data: {
        list,
        total,
        page: Number(page),
        pageSize: Number(pageSize)
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取订单列表失败' })
  }
})

router.get('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const orderQuery = `
      SELECT o.*,
             e.equipment_no, e.type, e.brand, e.model, e.spec, e.daily_rent, e.deposit as equipment_deposit, e.description as equipment_description,
             u.name as customer_name, u.phone as customer_phone, u.email as customer_email,
             cb.name as created_by_name,
             cf.name as confirmed_by_name
      FROM orders o
      LEFT JOIN equipments e ON o.equipment_id = e.id
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN users cb ON o.created_by = cb.id
      LEFT JOIN users cf ON o.confirmed_by = cf.id
      WHERE o.id = ?
    `
    const order = db.prepare(orderQuery).get(id) as OrderDetail | undefined

    if (!order) {
      res.status(404).json({ success: false, error: '订单不存在' })
      return
    }

    if (req.user?.role === 'customer' && order.customer_id !== req.user.id) {
      res.status(403).json({ success: false, error: '无权查看此订单' })
      return
    }

    const lendingQuery = `
      SELECT l.*, u.name as handler_name
      FROM lendings l
      LEFT JOIN users u ON l.handler_id = u.id
      WHERE l.order_id = ?
    `
    const lending = db.prepare(lendingQuery).get(id) as Lending | undefined

    const returnQuery = `
      SELECT r.*, u.name as handler_name
      FROM returns r
      LEFT JOIN users u ON r.handler_id = u.id
      WHERE r.order_id = ?
    `
    const returnRecord = db.prepare(returnQuery).get(id) as ReturnRecord | undefined

    const settlementQuery = `
      SELECT s.*, u.name as settled_by_name
      FROM settlements s
      LEFT JOIN users u ON s.settled_by = u.id
      WHERE s.order_id = ?
    `
    const settlement = db.prepare(settlementQuery).get(id) as Settlement | undefined

    res.json({
      success: true,
      data: {
        ...order as object,
        lending,
        return: returnRecord,
        settlement
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取订单详情失败' })
  }
})

router.post('/', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { equipment_id, customer_id: req_customer_id, start_date, end_date, expected_return_time, remark } = req.body

    if (!equipment_id || !start_date || !end_date) {
      res.status(400).json({ success: false, error: '缺少必要参数' })
      return
    }

    const start = new Date(start_date)
    const end = new Date(end_date)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ success: false, error: '日期格式无效' })
      return
    }

    if (start >= end) {
      res.status(400).json({ success: false, error: '结束日期必须晚于开始日期' })
      return
    }

    const equipment = db.prepare('SELECT * FROM equipments WHERE id = ?').get(equipment_id) as Equipment | undefined
    if (!equipment) {
      res.status(404).json({ success: false, error: '器材不存在' })
      return
    }

    let customer_id = req.user!.id
    if (req_customer_id && ['clerk', 'admin', 'finance'].includes(req.user!.role)) {
      customer_id = req_customer_id
      const customer = db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(customer_id, 'customer')
      if (!customer) {
        res.status(400).json({ success: false, error: '指定的客户不存在' })
        return
      }
    }

    const conflictQuery = `
      SELECT COUNT(*) as count FROM orders
      WHERE equipment_id = ?
        AND status != 'cancelled'
        AND start_date < ?
        AND end_date > ?
    `
    const { count } = db.prepare(conflictQuery).get(equipment_id, end_date, start_date) as { count: number }

    if (count > 0) {
      res.status(400).json({ success: false, error: '该器材在指定时间段内已被预约' })
      return
    }

    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const total_rent = days * equipment.daily_rent
    const order_no = 'ORD' + Date.now()
    const return_time = expected_return_time || (end_date + ' 23:59:59')

    const insertOrder = db.prepare(`
      INSERT INTO orders (order_no, customer_id, equipment_id, start_date, end_date, expected_return_time, days, total_rent, deposit, status, remark, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `)

    const result = insertOrder.run(
      order_no,
      customer_id,
      equipment_id,
      start_date,
      end_date,
      return_time,
      days,
      total_rent,
      equipment.deposit,
      remark,
      req.user!.id
    )

    const newOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid) as Order

    res.status(201).json({
      success: true,
      data: newOrder
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '创建订单失败' })
  }
})

router.put('/:id/confirm', authenticateToken, requireRole('clerk', 'admin'), (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined
    if (!order) {
      res.status(404).json({ success: false, error: '订单不存在' })
      return
    }

    if (order.status !== 'pending') {
      res.status(400).json({ success: false, error: '只有待确认状态的订单可以确认' })
      return
    }

    const updateOrder = db.prepare(`
      UPDATE orders 
      SET status = 'confirmed', confirmed_by = ?, confirmed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    updateOrder.run(req.user!.id, id)

    const updateEquipment = db.prepare(`
      UPDATE equipments SET status = 'reserved' WHERE id = ?
    `)
    updateEquipment.run(order.equipment_id)

    const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order

    res.json({
      success: true,
      data: updatedOrder
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '确认订单失败' })
  }
})

router.put('/:id/cancel', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order | undefined
    if (!order) {
      res.status(404).json({ success: false, error: '订单不存在' })
      return
    }

    if (req.user?.role === 'customer' && order.customer_id !== req.user.id) {
      res.status(403).json({ success: false, error: '无权取消此订单' })
      return
    }

    if (order.status !== 'pending' && order.status !== 'confirmed') {
      res.status(400).json({ success: false, error: '只有待确认和已确认状态的订单可以取消' })
      return
    }

    const updateOrder = db.prepare(`
      UPDATE orders SET status = 'cancelled' WHERE id = ?
    `)
    updateOrder.run(id)

    const updateEquipment = db.prepare(`
      UPDATE equipments SET status = 'available' WHERE id = ?
    `)
    updateEquipment.run(order.equipment_id)

    const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Order

    res.json({
      success: true,
      data: updatedOrder
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '取消订单失败' })
  }
})

export default router
