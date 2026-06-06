import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authenticateToken, requireRole } from '../middleware/auth.js'

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
}

interface SettlementDetail extends Settlement {
  order_no: string
  customer_name: string
  customer_phone: string
  equipment_no: string
  equipment_type: string
  equipment_brand: string
  equipment_model: string
  settled_by_name: string
}

interface Order {
  id: number
  order_no: string
  customer_id: number
  equipment_id: number
  total_rent: number
  deposit: number
  status: string
}

interface Lending {
  id: number
  order_id: number
  deposit_received: number
}

interface ReturnRecord {
  id: number
  order_id: number
  late_fee: number
  damage_fee: number
  missing_fee: number
}

const router = Router()

router.get('/', authenticateToken, requireRole('finance', 'admin'), (req: Request, res: Response): void => {
  try {
    const { page = 1, pageSize = 10 } = req.query
    const offset = (Number(page) - 1) * Number(pageSize)

    const countQuery = 'SELECT COUNT(*) as total FROM settlements'
    const { total } = db.prepare(countQuery).get() as { total: number }

    const listQuery = `
      SELECT s.*,
             o.order_no,
             u.name as customer_name,
             u.phone as customer_phone,
             e.equipment_no,
             e.type as equipment_type,
             e.brand as equipment_brand,
             e.model as equipment_model,
             sb.name as settled_by_name
      FROM settlements s
      LEFT JOIN orders o ON s.order_id = o.id
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN equipments e ON o.equipment_id = e.id
      LEFT JOIN users sb ON s.settled_by = sb.id
      ORDER BY s.settled_at DESC
      LIMIT ? OFFSET ?
    `
    const list = db.prepare(listQuery).all(Number(pageSize), offset)

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
    res.status(500).json({ success: false, error: '获取结算列表失败' })
  }
})

router.get('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const query = `
      SELECT s.*,
             o.order_no,
             o.start_date,
             o.end_date,
             o.days,
             u.name as customer_name,
             u.phone as customer_phone,
             u.email as customer_email,
             e.equipment_no,
             e.type as equipment_type,
             e.brand as equipment_brand,
             e.model as equipment_model,
             e.spec as equipment_spec,
             sb.name as settled_by_name
      FROM settlements s
      LEFT JOIN orders o ON s.order_id = o.id
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN equipments e ON o.equipment_id = e.id
      LEFT JOIN users sb ON s.settled_by = sb.id
      WHERE s.id = ?
    `
    const settlement = db.prepare(query).get(id) as SettlementDetail | undefined

    if (!settlement) {
      res.status(404).json({ success: false, error: '结算记录不存在' })
      return
    }

    const returnQuery = `
      SELECT r.*, u.name as handler_name
      FROM returns r
      LEFT JOIN users u ON r.handler_id = u.id
      WHERE r.order_id = ?
    `
    const returnRecord = db.prepare(returnQuery).get(settlement.order_id)

    res.json({
      success: true,
      data: {
        ...settlement as object,
        return: returnRecord
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取结算详情失败' })
  }
})

router.post('/', authenticateToken, requireRole('finance', 'admin'), (req: Request, res: Response): void => {
  try {
    const { order_id, remark } = req.body

    if (!order_id) {
      res.status(400).json({ success: false, error: '缺少订单ID' })
      return
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id) as Order | undefined
    if (!order) {
      res.status(404).json({ success: false, error: '订单不存在' })
      return
    }

    if (order.status !== 'returned') {
      res.status(400).json({ success: false, error: '只有已归还的订单才能结算' })
      return
    }

    const existingSettlement = db.prepare('SELECT id FROM settlements WHERE order_id = ?').get(order_id)
    if (existingSettlement) {
      res.status(400).json({ success: false, error: '该订单已结算' })
      return
    }

    const lending = db.prepare('SELECT * FROM lendings WHERE order_id = ?').get(order_id) as Lending | undefined
    if (!lending) {
      res.status(400).json({ success: false, error: '未找到出借记录' })
      return
    }

    const returnRecord = db.prepare('SELECT * FROM returns WHERE order_id = ?').get(order_id) as ReturnRecord | undefined
    if (!returnRecord) {
      res.status(400).json({ success: false, error: '未找到归还记录' })
      return
    }

    const total_rent = order.total_rent
    const late_fee = returnRecord.late_fee || 0
    const damage_fee = returnRecord.damage_fee || 0
    const missing_fee = returnRecord.missing_fee || 0
    const total_fee = total_rent + late_fee + damage_fee + missing_fee
    const deposit_received = lending.deposit_received
    const deposit_deducted = Math.min(deposit_received, total_fee)
    const refund_amount = Math.max(0, deposit_received - deposit_deducted)
    const additional_payment = Math.max(0, total_fee - deposit_deducted)

    const insertSettlement = db.prepare(`
      INSERT INTO settlements (
        order_id, total_rent, late_fee, damage_fee, missing_fee,
        total_fee, deposit_received, deposit_deducted, refund_amount,
        additional_payment, settled_by, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const result = insertSettlement.run(
      order_id,
      total_rent,
      late_fee,
      damage_fee,
      missing_fee,
      total_fee,
      deposit_received,
      deposit_deducted,
      refund_amount,
      additional_payment,
      req.user!.id,
      remark || null
    )

    const updateOrder = db.prepare(`
      UPDATE orders SET status = 'settled' WHERE id = ?
    `)
    updateOrder.run(order_id)

    const newSettlement = db.prepare('SELECT * FROM settlements WHERE id = ?').get(result.lastInsertRowid) as Settlement

    res.status(201).json({
      success: true,
      data: newSettlement
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '创建结算记录失败' })
  }
})

export default router
