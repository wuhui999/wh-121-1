import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import db from '../db.js';
import { authenticateToken, requireRole, generateToken, type AuthPayload } from '../middleware/auth.js';

const router = Router();

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, name, role, phone, email } = req.body;

    if (!username || !password || !name || !role) {
      res.status(400).json({ success: false, error: '用户名、密码、姓名和角色为必填项' });
      return;
    }

    if (!['customer', 'clerk', 'finance', 'admin'].includes(role)) {
      res.status(400).json({ success: false, error: '角色不合法' });
      return;
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      res.status(400).json({ success: false, error: '用户名已存在' });
      return;
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const info = db.prepare(`
      INSERT INTO users (username, password, name, role, phone, email)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(username, hashedPassword, name, role, phone || null, email || null);

    const user = db.prepare('SELECT id, username, name, role, phone, email, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: '注册失败' });
  }
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ success: false, error: '用户名和密码为必填项' });
      return;
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;

    if (!user) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }

    const payload: AuthPayload = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
    };

    const token = generateToken(payload);

    const { password: _, ...userWithoutPassword } = user;

    res.json({ success: true, data: { token, user: userWithoutPassword } });
  } catch (error) {
    res.status(500).json({ success: false, error: '登录失败' });
  }
});

router.get('/me', authenticateToken, (req: Request, res: Response): void => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: '未登录' });
      return;
    }

    const user = db.prepare('SELECT id, username, name, role, phone, email, created_at FROM users WHERE id = ?').get(req.user.id);

    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取用户信息失败' });
  }
});

router.get('/users', authenticateToken, requireRole('admin'), (req: Request, res: Response): void => {
  try {
    const users = db.prepare('SELECT id, username, name, role, phone, email, created_at FROM users ORDER BY id ASC').all();

    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: '获取用户列表失败' });
  }
});

router.put('/users/:id', authenticateToken, requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { username, password, name, role, phone, email } = req.body;

    const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!existingUser) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    if (role && !['customer', 'clerk', 'finance', 'admin'].includes(role)) {
      res.status(400).json({ success: false, error: '角色不合法' });
      return;
    }

    if (username) {
      const usernameExists = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, id);
      if (usernameExists) {
        res.status(400).json({ success: false, error: '用户名已存在' });
        return;
      }
    }

    const fields: string[] = [];
    const values: any[] = [];

    if (username) {
      fields.push('username = ?');
      values.push(username);
    }
    if (password) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      fields.push('password = ?');
      values.push(hashedPassword);
    }
    if (name) {
      fields.push('name = ?');
      values.push(name);
    }
    if (role) {
      fields.push('role = ?');
      values.push(role);
    }
    if (phone !== undefined) {
      fields.push('phone = ?');
      values.push(phone || null);
    }
    if (email !== undefined) {
      fields.push('email = ?');
      values.push(email || null);
    }

    if (fields.length === 0) {
      res.status(400).json({ success: false, error: '没有需要更新的字段' });
      return;
    }

    values.push(id);

    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    const updatedUser = db.prepare('SELECT id, username, name, role, phone, email, created_at FROM users WHERE id = ?').get(id);

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, error: '更新用户失败' });
  }
});

router.delete('/users/:id', authenticateToken, requireRole('admin'), (req: Request, res: Response): void => {
  try {
    const { id } = req.params;

    const existingUser = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!existingUser) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    if (req.user && Number(id) === req.user.id) {
      res.status(400).json({ success: false, error: '不能删除当前登录用户' });
      return;
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    res.json({ success: true, data: { message: '删除成功' } });
  } catch (error) {
    res.status(500).json({ success: false, error: '删除用户失败' });
  }
});

export default router;
