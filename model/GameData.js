import fs from 'fs'
import path from 'path'
import chokidar from 'chokidar'

const dataPath = path.join(process.cwd(), 'plugins/mengka-world-yunzai/resources/data')

class GameData {
  constructor() {
    this.data = {}
    this.game = { shop: [], restart: {}, 频率: 100000, 绑定: {}, pic: 1, work: {} }
    this.fight = { 开启: [], 打怪: {} }
    
    this.loadFiles()
    this.setupFileWatch()
    this.startBackup()
  }

  loadFiles() {
    try {
      // 确保数据目录存在
      if (!fs.existsSync(dataPath)) {
        fs.mkdirSync(dataPath, { recursive: true })
      }

      // 加载主数据文件
      const dataFile = path.join(dataPath, 'data.json')
      if (fs.existsSync(dataFile)) {
        // 在ES模块中，直接读取JSON文件
        this.data = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
      } else {
        this.data = this.getDefaultData()
        this.saveData()
      }

      // 加载游戏状态文件
      const gameFile = path.join(dataPath, 'game.json')
      if (fs.existsSync(gameFile)) {
        this.game = { ...this.game, ...JSON.parse(fs.readFileSync(gameFile, 'utf8')) }
      }

      // 加载战斗状态文件
      const fightFile = path.join(dataPath, 'fight.json')
      if (fs.existsSync(fightFile)) {
        this.fight = { ...this.fight, ...JSON.parse(fs.readFileSync(fightFile, 'utf8')) }
      }

      // 确保必要的属性存在
      if (!this.game.pic) this.game.pic = 1
      if (!this.game.work) this.game.work = {}
      if (!this.fight.打怪) this.fight.打怪 = {}

      logger.info('[萌卡世界] 游戏数据加载完成')
    } catch (error) {
      logger.error('[萌卡世界] 数据文件加载失败:', error)
    }
  }

  getDefaultData() {
    return {
      角色: {},
      装备: {},
      道具: {},
      抽卡: {
        角色: {
          分类: {
            D: { 概率: 50, 角色: [] },
            C: { 概率: 30, 角色: [] },
            B: { 概率: 15, 角色: [] },
            A: { 概率: 4, 角色: [] },
            S: { 概率: 1, 角色: [] }
          }
        },
        装备: {
          分类: {
            D: { 概率: 50, 装备: [] },
            C: { 概率: 30, 装备: [] },
            B: { 概率: 15, 装备: [] },
            A: { 概率: 4, 装备: [] },
            S: { 概率: 1, 装备: [] }
          }
        }
      },
      管理员: {
        管理员: []
      }
    }
  }

  setupFileWatch() {
    const dataFile = path.join(dataPath, 'data.json')
    if (fs.existsSync(dataFile)) {
      chokidar.watch(dataFile).on('change', () => {
        try {
          // 在ES模块中，直接重新读取文件即可
          this.data = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
          logger.info('[萌卡世界] data.json文件发生变化，已重新读取')
        } catch (error) {
          logger.error('[萌卡世界] data.json文件重新读取失败:', error)
        }
      })
    }
  }

  startBackup() {
    // 每两分钟备份一次游戏数据
    setInterval(() => {
      this.saveGameData()
      this.saveFightData()
      logger.info('[萌卡世界] 已备份游戏数据')
      
      // 清理图片缓存
      if (this.game.pic > 300) {
        this.game.pic = 1
        this.cleanImageCache()
      }
    }, 120000)
  }

  saveData() {
    const dataFile = path.join(dataPath, 'data.json')
    fs.writeFileSync(dataFile, JSON.stringify(this.data, null, 2))
  }

  saveGameData() {
    const gameFile = path.join(dataPath, 'game.json')
    fs.writeFileSync(gameFile, JSON.stringify(this.game))
  }

  saveFightData() {
    const fightFile = path.join(dataPath, 'fight.json')
    fs.writeFileSync(fightFile, JSON.stringify(this.fight))
  }

  cleanImageCache() {
    const tempPath = path.join(process.cwd(), 'temp/mengka')
    if (fs.existsSync(tempPath)) {
      fs.readdir(tempPath, (err, files) => {
        if (!err) {
          files.forEach(file => {
            fs.unlink(path.join(tempPath, file), (unlinkErr) => {
              if (unlinkErr) logger.error('[萌卡世界] 清理图片缓存失败:', unlinkErr)
            })
          })
          logger.info('[萌卡世界] 已清除图片缓存')
        }
      })
    }
  }

  // 获取方法
  getData() { return this.data }
  getGame() { return this.game }
  getFight() { return this.fight }
}

// 创建单例实例
const gameData = new GameData()

export default gameData
