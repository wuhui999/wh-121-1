import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer', 'clerk', 'finance', 'admin')),
      phone TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS equipments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_no TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('camera', 'lens', 'light', 'tripod', 'accessory')),
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      spec TEXT,
      status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available', 'reserved', 'lent', 'repairing', 'maintenance')),
      daily_rent DECIMAL(10,2) NOT NULL,
      deposit DECIMAL(10,2) NOT NULL,
      purchase_price DECIMAL(10,2),
      purchase_date DATE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      equipment_id INTEGER NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      expected_return_time DATETIME NOT NULL,
      days INTEGER NOT NULL,
      total_rent DECIMAL(10,2) NOT NULL,
      deposit DECIMAL(10,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'confirmed', 'lent', 'returned', 'settled', 'cancelled')),
      remark TEXT,
      created_by INTEGER,
      confirmed_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      confirmed_at DATETIME,
      FOREIGN KEY (customer_id) REFERENCES users(id),
      FOREIGN KEY (equipment_id) REFERENCES equipments(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (confirmed_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS lendings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL,
      equipment_id INTEGER NOT NULL,
      appearance TEXT,
      accessories TEXT,
      deposit_received DECIMAL(10,2) NOT NULL,
      handler_id INTEGER NOT NULL,
      lent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      remark TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (equipment_id) REFERENCES equipments(id),
      FOREIGN KEY (handler_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL,
      equipment_id INTEGER NOT NULL,
      actual_return_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_late INTEGER DEFAULT 0,
      late_hours INTEGER DEFAULT 0,
      late_fee DECIMAL(10,2) DEFAULT 0,
      is_damaged INTEGER DEFAULT 0,
      damage_level TEXT CHECK(damage_level IN ('none', 'minor', 'moderate', 'severe')),
      damage_description TEXT,
      damage_fee DECIMAL(10,2) DEFAULT 0,
      is_missing INTEGER DEFAULT 0,
      missing_items TEXT,
      missing_fee DECIMAL(10,2) DEFAULT 0,
      repair_suggestion TEXT,
      photo_url TEXT,
      handler_id INTEGER NOT NULL,
      remark TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (equipment_id) REFERENCES equipments(id),
      FOREIGN KEY (handler_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL,
      total_rent DECIMAL(10,2) NOT NULL,
      late_fee DECIMAL(10,2) DEFAULT 0,
      damage_fee DECIMAL(10,2) DEFAULT 0,
      missing_fee DECIMAL(10,2) DEFAULT 0,
      total_fee DECIMAL(10,2) NOT NULL,
      deposit_received DECIMAL(10,2) NOT NULL,
      deposit_deducted DECIMAL(10,2) DEFAULT 0,
      refund_amount DECIMAL(10,2) NOT NULL,
      additional_payment DECIMAL(10,2) DEFAULT 0,
      settled_by INTEGER NOT NULL,
      settled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      remark TEXT,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (settled_by) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS repairs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      equipment_id INTEGER NOT NULL,
      return_id INTEGER,
      description TEXT NOT NULL,
      repair_cost DECIMAL(10,2),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'repairing', 'completed', 'scrapped')),
      sent_date DATE,
      completed_date DATE,
      handler_id INTEGER,
      remark TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (equipment_id) REFERENCES equipments(id),
      FOREIGN KEY (return_id) REFERENCES returns(id),
      FOREIGN KEY (handler_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_equipment ON orders(equipment_id);
    CREATE INDEX IF NOT EXISTS idx_orders_dates ON orders(start_date, end_date);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_equipments_status ON equipments(status);
    CREATE INDEX IF NOT EXISTS idx_equipments_type ON equipments(type);
  `);

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const saltRounds = 10;
    const hashPassword = (pwd: string) => bcrypt.hashSync(pwd, saltRounds);

    const insertUser = db.prepare(`
      INSERT INTO users (username, password, name, role, phone, email)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertUser.run('admin', hashPassword('admin123'), '系统管理员', 'admin', '13800000000', 'admin@studio.com');
    insertUser.run('clerk1', hashPassword('clerk123'), '张店员', 'clerk', '13800000001', 'clerk1@studio.com');
    insertUser.run('finance1', hashPassword('finance123'), '李财务', 'finance', '13800000002', 'finance1@studio.com');
    insertUser.run('customer1', hashPassword('customer123'), '王客户', 'customer', '13800000003', 'customer1@studio.com');
    insertUser.run('customer2', hashPassword('customer123'), '赵客户', 'customer', '13800000004', 'customer2@studio.com');
  }

  const equipCount = db.prepare('SELECT COUNT(*) as count FROM equipments').get() as { count: number };
  if (equipCount.count === 0) {
    const insertEquip = db.prepare(`
      INSERT INTO equipments (equipment_no, type, brand, model, spec, status, daily_rent, deposit, purchase_price, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const equipments = [
      ['CAM-001', 'camera', 'Canon', 'EOS R5', '全画幅微单 4500万像素', 'available', 300, 15000, 25800, '佳能旗舰微单，支持8K视频'],
      ['CAM-002', 'camera', 'Sony', 'A7M4', '全画幅微单 3300万像素', 'available', 200, 10000, 16999, '索尼全画幅标准微单'],
      ['CAM-003', 'camera', 'Nikon', 'Z7 II', '全画幅微单 4500万像素', 'available', 280, 14000, 23999, '尼康高像素全画幅微单'],
      ['LEN-001', 'lens', 'Canon', 'RF 24-70mm F2.8', '标准变焦大三元', 'available', 120, 6000, 15800, '佳能标准变焦镜头'],
      ['LEN-002', 'lens', 'Sony', 'FE 70-200mm F2.8 GM II', '远摄变焦大三元', 'available', 150, 8000, 18999, '索尼远摄变焦镜头'],
      ['LEN-003', 'lens', 'Sigma', '35mm F1.4 DG DN', '定焦大光圈', 'available', 80, 4000, 5999, '适马定焦人像镜头'],
      ['LGT-001', 'light', 'Godox', 'AD600 Pro', '外拍灯 600W', 'available', 80, 3000, 5800, '神牛大功率外拍灯'],
      ['LGT-002', 'light', 'Aputure', '120D II', '影视灯 120W', 'available', 60, 2500, 4500, '爱图仕LED影视灯'],
      ['LGT-003', 'light', 'Godox', 'ML60', '手持LED灯 60W', 'available', 40, 1500, 2800, '神牛便携LED灯'],
      ['TRP-001', 'tripod', 'Manfrotto', '055CXPRO3', '碳纤维三脚架', 'available', 50, 2000, 3200, '曼富图专业碳纤维三脚架'],
      ['TRP-002', 'tripod', 'Gitzo', 'GT1545T', '旅行者三脚架', 'available', 70, 3000, 5999, '捷信便携碳纤维三脚架'],
      ['TRP-003', 'tripod', 'Zhiyun', 'Weebill 3', '稳定器', 'available', 60, 2500, 4999, '智云专业相机稳定器'],
      ['ACC-001', 'accessory', 'SmallRig', '通用兔笼', '相机兔笼套件', 'available', 20, 500, 899, '相机保护兔笼'],
      ['ACC-002', 'accessory', 'Tilta', '跟焦器', '无线跟焦系统', 'available', 30, 800, 1599, '铁头无线跟焦器'],
    ];

    for (const equip of equipments) {
      insertEquip.run(equip[0], equip[1], equip[2], equip[3], equip[4], equip[5], equip[6], equip[7], equip[8], equip[9]);
    }
  }

  console.log('Database initialized successfully');
}

export default db;
