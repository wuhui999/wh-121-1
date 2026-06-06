import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { authenticateToken, requireRole } from '../middleware/auth.js'

interface Repair {
  id: number
  equipment_id: number
  return_id: number | null
  description: string
  repair_cost: number | null
  status: string
  sent_date: string | null
  completed_date: string | null
  handler_id: number | null
  remark: string | null
  created_at: string
}

interface RepairDetail extends Repair {
  equipment_no: string
  equipment_type: string
  equipment_brand: string
  equipment_model: string
  handler_name: string | null
}

const router = Router()

router.get('/', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { status, equipment_id, page = 1, pageSize = 10 } = req.query
    const offset = (Number(page) - 1) * Number(pageSize)

    let whereClause = ''
    const params: any[] = []

    if (status) {
      whereClause += 'r.status = ?'
      params.push(status)
    }

    if (equipment_id) {
      if (whereClause) whereClause += ' AND '
      whereClause += 'r.equipment_id = ?'
      params.push(equipment_id)
    }

    const countQuery = `
      SELECT COUNT(*) as total FROM repairs r
      ${whereClause ? 'WHERE ' + whereClause : ''}
    `
    const { total } = db.prepare(countQuery).get(...params) as { total: number }

    const listQuery = `
      SELECT r.*,
             e.equipment_no,
             e.type as equipment_type,
             e.brand as equipment_brand,
             e.model as equipment_model,
             u.name as handler_name
      FROM repairs r
      LEFT JOIN equipments e ON r.equipment_id = e.id
      LEFT JOIN users u ON r.handler_id = u.id
      ${whereClause ? 'WHERE ' + whereClause : ''}
      ORDER BY r.created_at DESC
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
    res.status(500).json({ success: false, error: '获取维修记录列表失败' })
  }
})

router.get('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const query = `
      SELECT r.*,
             e.equipment_no,
             e.type as equipment_type,
             e.brand as equipment_brand,
             e.model as equipment_model,
             e.spec as equipment_spec,
             e.status as equipment_status,
             u.name as handler_name
      FROM repairs r
      LEFT JOIN equipments e ON r.equipment_id = e.id
      LEFT JOIN users u ON r.handler_id = u.id
      WHERE r.id = ?
    `
    const repair = db.prepare(query).get(id) as RepairDetail | undefined

    if (!repair) {
      res.status(404).json({ success: false, error: '维修记录不存在' })
      return
    }

    res.json({
      success: true,
      data: repair
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取维修详情失败' })
  }
})

router.post('/', authenticateToken, requireRole('clerk', 'admin'), (req: Request, res: Response): void => {
  try {
    const { equipment_id, return_id, description, repair_cost, sent_date, remark } = req.body

    if (!equipment_id || !description) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }

    const equipment = db.prepare('SELECT * FROM equipments WHERE id = ?').get(equipment_id)
    if (!equipment) {
      res.status(404).json({ success: false, error: '器材不存在' })
      return
    }

    const insertRepair = db.prepare(`
      INSERT INTO repairs (
        equipment_id, return_id, description, repair_cost,
        status, sent_date, handler_id, remark
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)
    `)

    const result = insertRepair.run(
      equipment_id,
      return_id || null,
      description,
      repair_cost || null,
      sent_date || null,
      req.user!.id,
      remark || null
    )

    const updateEquipment = db.prepare(`
      UPDATE equipments SET status = 'repairing' WHERE id = ?
    `)
    updateEquipment.run(equipment_id)

    const newRepair = db.prepare('SELECT * FROM repairs WHERE id = ?').get(result.lastInsertRowid) as Repair

    res.status(201).json({
      success: true,
      data: newRepair
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '创建维修记录失败' })
  }
})

router.put('/:id', authenticateToken, (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { status, repair_cost, completed_date, remark } = req.body

    const repair = db.prepare('SELECT * FROM repairs WHERE id = ?').get(id) as Repair | undefined
    if (!repair) {
      res.status(404).json({ success: false, error: '维修记录不存在' })
      return
    }

    const validStatuses = ['pending', 'repairing', 'completed', 'scrapped']
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({ success: false, error: '无效的维修状态' })
      return
    }

    const updates: string[] = []
    const params: any[] = []

    if (status !== undefined) { updates.push('status = ?'); params.push(status) }
    if (repair_cost !== undefined) { updates.push('repair_cost = ?'); params.push(repair_cost) }
    if (completed_date !== undefined) { updates.push('completed_date = ?'); params.push(completed_date) }
    if (remark !== undefined) { updates.push('remark = ?'); params.push(remark) }

    if (updates.length === 0) {
      res.status(400).json({ success: false, error: '没有提供更新字段' })
      return
    }

    params.push(id)
    db.prepare(`UPDATE repairs SET ${updates.join(', ')} WHERE id = ?`).run(...params)

    if (status === 'completed') {
      db.prepare("UPDATE equipments SET status = 'available' WHERE id = ?").run(repair.equipment_id)
    } else if (status === 'scrapped') {
      db.prepare("UPDATE equipments SET status = 'maintenance' WHERE id = ?").run(repair.equipment_id)
    }

    const updatedRepair = db.prepare('SELECT * FROM repairs WHERE id = ?').get(id) as Repair

    res.json({
      success: true,
      data: updatedRepair
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '更新维修记录失败' })
  }
})

router.delete('/:id', authenticateToken, requireRole('admin'), (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const repair = db.prepare('SELECT * FROM repairs WHERE id = ?').get(id) as Repair | undefined
    if (!repair) {
      res.status(404).json({ success: false, error: '维修记录不存在' })
      return
    }

    db.prepare('DELETE FROM repairs WHERE id = ?').run(id)

    res.json({
      success: true,
      data: { message: '删除成功' }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '删除维修记录失败' })
  }
})

export default router
