import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

class ImageUtils {
  constructor() {
    this.tempPath = path.join(process.cwd(), 'temp/mengka')
    this.resourcePath = path.join(process.cwd(), 'plugins/mengka-world-yunzai/resources/images')
    this.picCounter = 1
    
    // 确保临时目录存在
    if (!fs.existsSync(this.tempPath)) {
      fs.mkdirSync(this.tempPath, { recursive: true })
    }
  }

  /**
   * 获取图片URL或路径
   * @param {string|Buffer} data - 图片数据或路径
   * @param {boolean} isBase64 - 是否为base64数据
   * @param {boolean} returnPath - 是否返回文件路径
   * @returns {string} 图片路径或segment
   */
  getPicUrl(data, isBase64 = false, returnPath = false) {
    this.picCounter++
    const fileName = `${this.picCounter}.jpg`
    const filePath = path.join(this.tempPath, fileName)

    try {
      if (isBase64) {
        fs.writeFileSync(filePath, Buffer.from(data, 'base64'))
      } else if (Buffer.isBuffer(data)) {
        fs.writeFileSync(filePath, data)
      } else {
        // 复制文件
        fs.copyFileSync(data, filePath)
      }

      if (returnPath) {
        return filePath
      } else {
        // 在Yunzai V3中返回文件路径，让调用者创建图片消息
        return filePath
      }
    } catch (error) {
      logger.error('[萌卡世界] 图片处理失败:', error)
      return null
    }
  }

  /**
   * 获取资源图片
   * @param {string} relativePath - 相对于resources/images的路径
   * @returns {object} segment对象
   */
  getResourceImage(relativePath) {
    const imagePath = path.join(this.resourcePath, relativePath)
    if (fs.existsSync(imagePath)) {
      return imagePath
    } else {
      logger.warn(`[萌卡世界] 图片不存在: ${relativePath}`)
      return null
    }
  }

  /**
   * 生成角色备战图片
   * @param {object} character1 - 主角色
   * @param {object} character2 - 副角色（可选）
   * @param {string} userId - 用户ID
   * @param {string} nickname - 用户昵称
   * @param {object} extra - 额外信息
   * @returns {Buffer} 图片buffer
   */
  async generateBattleImage(character1, character2, userId, nickname, extra = null) {
    try {
      // 这里需要根据原插件的图片生成逻辑来实现
      // 由于原逻辑比较复杂，这里提供一个简化版本
      
      const width = 800
      const height = 600
      const canvas = sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      })

      // 添加角色图片等逻辑...
      // 这里需要根据原插件的具体实现来完善

      return await canvas.png().toBuffer()
    } catch (error) {
      logger.error('[萌卡世界] 图片生成失败:', error)
      return null
    }
  }

  /**
   * 创建消息段
   * @param {string} text - 文本内容
   * @param {string|Buffer} image - 图片数据
   * @returns {array} 消息段数组
   */
  createMessage(text, image = null) {
    const msg = []
    
    if (text) {
      msg.push(text)
    }
    
    if (image) {
      if (typeof image === 'string') {
        // 直接返回图片路径，让Yunzai处理
        msg.push(image)
      } else if (Buffer.isBuffer(image)) {
        const imagePath = this.getPicUrl(image, false, false)
        if (imagePath) msg.push(imagePath)
      }
    }
    
    return msg
  }

  /**
   * 清理临时文件
   */
  cleanTempFiles() {
    try {
      if (fs.existsSync(this.tempPath)) {
        const files = fs.readdirSync(this.tempPath)
        files.forEach(file => {
          const filePath = path.join(this.tempPath, file)
          fs.unlinkSync(filePath)
        })
        logger.info('[萌卡世界] 临时文件清理完成')
      }
    } catch (error) {
      logger.error('[萌卡世界] 临时文件清理失败:', error)
    }
  }
}

// 创建单例实例
const imageUtils = new ImageUtils()

export default imageUtils
