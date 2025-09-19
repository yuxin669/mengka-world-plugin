import mysql from 'mysql2/promise'
import fs from 'fs'
import path from 'path'
import YAML from 'yaml'

const configPath = path.join(process.cwd(), 'plugins/mengka-world-yunzai/config/config.yaml')
const config = YAML.parse(fs.readFileSync(configPath, 'utf8'))

class Database {
  constructor() {
    this.connection = null
    this.isConnected = false
  }

  async connect() {
    try {
      this.connection = await mysql.createConnection({
        host: config.database.host,
        user: config.database.user,
        password: config.database.password,
        port: config.database.port,
        database: config.database.database,
        multipleStatements: config.database.multipleStatements
      })
      
      this.isConnected = true
      logger.info('[萌卡世界] 数据库连接成功')
      
      // 检查并创建必要的表
      await this.initTables()
      
    } catch (error) {
      logger.error('[萌卡世界] 数据库连接失败:', error)
      throw error
    }
  }

  async initTables() {
    try {
      // 先检查表是否存在
      const [tables] = await this.connection.execute('SHOW TABLES LIKE "萌卡世界"')
      
      if (tables.length > 0) {
        // 表已存在，检查结构是否正确
        try {
          const [userIdColumns] = await this.connection.execute('SHOW COLUMNS FROM 萌卡世界 WHERE Field = "user_id"')
          const [qqColumns] = await this.connection.execute('SHOW COLUMNS FROM 萌卡世界 WHERE Field = "qq"')
          
          if (qqColumns.length > 0 && userIdColumns.length === 0) {
            logger.warn('[萌卡世界] 检测到旧版本表结构（使用qq字段）')
            logger.warn('[萌卡世界] 请执行数据库重置：mysql -u root -p mengka_world < reset_database.sql')
            logger.warn('[萌卡世界] 然后重启Yunzai以创建新的表结构')
          } else if (userIdColumns.length > 0) {
            logger.info('[萌卡世界] 表结构正确，使用user_id字段')
          } else {
            logger.warn('[萌卡世界] 表结构异常，建议重置数据库')
          }
        } catch (error) {
          logger.error('[萌卡世界] 检查表结构失败:', error.message)
        }
      } else {
        // 创建主表
        await this.connection.execute(`
          CREATE TABLE 萌卡世界 (
            user_id VARCHAR(64) PRIMARY KEY,
            注册 BIGINT UNSIGNED,
            萌币 INT DEFAULT 0,
            萌晶 INT DEFAULT 0,
            角色 JSON,
            签到 JSON,
            背包 JSON,
            装备 JSON,
            备战 JSON,
            指令 JSON,
            冒险 JSON,
            银行 JSON,
            单抽 INT DEFAULT 0,
            十连 INT DEFAULT 0
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `)
      }

      // 创建地图表
      await this.connection.execute(`
        CREATE TABLE IF NOT EXISTS 萌卡世界地图 (
          user_id VARCHAR(64) PRIMARY KEY,
          关卡 INT DEFAULT 1,
          boss JSON,
          挑战 JSON
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

      // 创建抽卡排行表
      await this.connection.execute(`
        CREATE TABLE IF NOT EXISTS 萌卡抽卡排行 (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(64),
          星级 INT,
          时间 BIGINT UNSIGNED,
          类型 VARCHAR(50),
          名称 VARCHAR(100),
          INDEX idx_user_id (user_id),
          INDEX idx_time (时间)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

      // 创建传说模式表
      await this.connection.execute(`
        CREATE TABLE IF NOT EXISTS 萌卡传说 (
          user_id VARCHAR(64) PRIMARY KEY,
          注册 BIGINT UNSIGNED,
          关卡 INT DEFAULT 1,
          指令 JSON,
          周目 INT DEFAULT 1,
          技能 JSON,
          加点 JSON
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `)

      logger.info('[萌卡世界] 数据表初始化完成')
    } catch (error) {
      logger.error('[萌卡世界] 数据表初始化失败:', error)
    }
  }

  async query(sql, params = []) {
    if (!this.isConnected) {
      await this.connect()
    }
    
    try {
      const [rows] = await this.connection.execute(sql, params)
      return rows
    } catch (error) {
      logger.error('[萌卡世界] 数据库查询错误:', error)
      throw error
    }
  }

  async close() {
    if (this.connection) {
      await this.connection.end()
      this.isConnected = false
      logger.info('[萌卡世界] 数据库连接已关闭')
    }
  }
}

// 创建单例实例
const database = new Database()

export default database
