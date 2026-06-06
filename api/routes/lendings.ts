import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authenticateToken, requireRole } from '../middleware/auth.js'

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
}

interface LendingDetail extends Lending {
  order_no: string
  equipment_no: string
  type: string
  brand: string
  model: string
  customer_name: string
  customer_phone: string
  handler_name: string
}

interface Order {
  id: number
  order_no: string
  customer_id: number
  equipment_id: number
  status: string
  deposit: number
}

interface Equipment {
  id: number
  equipment_no: string
  status: string
}

const router = Router()

router.get('/', authenticateToken, requireRole('clerk', 'admin'), (req: Request, res: Response): void => {
  try {
    const { page = 1, pageSize = 10 } = req.query
    const offset = (Number(page) - 1) * Number(pageSize)

    const countQuery = `
      SELECT COUNT(*) as total FROM lendings
    `
    const { total } = db.prepare(countQuery).get() as { total: number }

    const listQuery = `
      SELECT l.*,
             o.order_no,
             e.equipment_no, e.type, e.brand, e.model,
             u.name as customer_name, u.phone as customer_phone,
             h.name as handler_name
      FROM lendings l
      LEFT JOIN orders o ON l.order_id = o.id
      LEFT JOIN equipments e ON l.equipment_id = e.id
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN users h ON l.handler_id = h.id
      ORDER BY l.lent_at DESC
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
    res.status(500).json({ success: false, error: '获取出借记录列表失败' })
  }
})

router.get('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const query = `
      SELECT l.*,
             o.order_no, o.start_date, o.end_date, o.expected_return_time, o.days, o.total_rent, o.deposit,
             e.equipment_no, e.type, e.brand, e.model, e.spec, e.daily_rent, e.deposit as equipment_deposit, e.description as equipment_description,
             u.name as customer_name, u.phone as customer_phone, u.email as customer_email,
             h.name as handler_name
      FROM lendings l
      LEFT JOIN orders o ON l.order_id = o.id
      LEFT JOIN equipments e ON l.equipment_id = e.id
      LEFT JOIN users u ON o.customer_id = u.id
      LEFT JOIN users h ON l.handler_id = h.id
      WHERE l.id = ?
    `
    const lending = db.prepare(query).get(id) as LendingDetail | undefined

    if (!lending) {
      res.status(404).json({ success: false, error: '出借记录不存在' })
      return
    }

    res.json({
      success: true,
      data: lending
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取出借记录详情失败' })
  }
})

router.post('/', authenticateToken, requireRole('clerk', 'admin'), (req: Request, res: Response): void => {
  try {
    const { order_id, appearance, accessories, deposit_received, handler_id, remark } = req.body

    if (!order_id || deposit_received === undefined || !handler_id) {
      res.status(400).json({ success: false, error: '缺少必要参数' })
      return
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(order_id) as Order | undefined
    if (!order) {
      res.status(404).json({ success: false, error: '订单不存在' })
      return
    }

    if (order.status !== 'confirmed') {
      res.status(400).json({ success: false, error: '只有已确认状态的订单可以出借' })
      return
    }

    const equipment = db.prepare('SELECT * FROM equipments WHERE id = ?').get(order.equipment_id) as Equipment | undefined
    if (!equipment) {
      res.status(404).json({ success: false, error: '器材不存在' })
      return
    }

    if (equipment.status !== 'reserved') {
      res.status(400).json({ success: false, error: '器材状态必须为已预订才能出借' })
      return
    }

    const existingLending = db.prepare('SELECT id FROM lendings WHERE order_id = ?').get(order_id)
    if (existingLending) {
      res.status(400).json({ success: false, error: '该订单已存在出借记录' })
      return
    }

    let accessoriesJson: string | null = null
    if (accessories !== undefined && accessories !== null) {
      if (typeof accessories === 'string') {
        try {
          JSON.parse(accessories)
          accessoriesJson = accessories
        } catch {
          res.status(400).json({ success: false, error: '配件清单格式无效，必须为JSON格式' })
          return
        }
      } else {
        accessoriesJson = JSON.stringify(accessories)
      }
    }

    const insertLending = db.prepare(`
      INSERT INTO lendings (order_id, equipment_id, appearance, accessories, deposit_received, handler_id, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const result = insertLending.run(
      order_id,
      order.equipment_id,
      appearance || null,
      accessoriesJson,
      deposit_received,
      handler_id,
      remark || null
    )

    const updateOrder = db.prepare(`
      UPDATE orders SET status = 'lent' WHERE id = ?
    `)
    updateOrder.run(order_id)

    const updateEquipment = db.prepare(`
      UPDATE equipments SET status = 'lent' WHERE id = ?
    `)
    updateEquipment.run(order.equipment_id)

    const newLending = db.prepare('SELECT * FROM lendings WHERE id = ?').get(result.lastInsertRowid) as Lending

    res.status(201).json({
      success: true,
      data: newLending
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '创建出借记录失败' })
  }
})

export default router
