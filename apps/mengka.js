import plugin from '../../../lib/plugins/plugin.js'
import database from '../model/database.js'
import gameData from '../model/GameData.js'
import imageUtils from '../model/ImageUtils.js'
// 使用Yunzai的renderer替代puppeteer
import Renderer from '../../../lib/renderer/loader.js'
import { segment } from 'oicq'
import fs from 'fs'
import path from 'path'
import axios from 'axios'
import FormData from 'form-data'
// 移除lodash导入，不再需要_.concat

export class MengkaWorld extends plugin {
  constructor() {
    super({
      name: '萌卡世界',
      dsc: '萌卡世界卡牌游戏',
      event: 'message',
      priority: 1000,
      rule: [
        {
          reg: '^萌卡(菜单|指令|签到|注册|注销|关闭)$',
          fnc: 'basicCommands'
        },
        {
          reg: '^(单抽|十连)$',
          fnc: 'gacha'
        },
        {
          reg: '^我的(备战|属性|信息)$',
          fnc: 'playerInfo'
        },
        {
          reg: '^(游戏|萌卡)商店$',
          fnc: 'shop'
        },
        {
          reg: '^购买(\\d+)$',
          fnc: 'buyItemHandler'
        },
        {
          reg: '^(刷新商店|萌卡爆率)$',
          fnc: 'refreshShop'
        },
        {
          reg: '^(\\d+)?更换(.+)$',
          fnc: 'changeCharacter'
        },
        {
          reg: '^(我的角色|角色列表)$',
          fnc: 'myCharacters'
        },
        {
          reg: '^(我的装备|装备列表|背包装备)$',
          fnc: 'myEquipment'
        },
        {
          reg: '^(\\d+)?装备状态$',
          fnc: 'checkEquipment'
        },
        {
          reg: '^(\\d+)?装备(.+)$',
          fnc: 'equipItem'
        },
        {
          reg: '^卸载.+',
          fnc: 'unequipItem'
        },
        {
          reg: '^合成.+',
          fnc: 'synthesize'
        },
        {
          reg: '^出售.+',
          fnc: 'sellItem'
        },
        {
          reg: '^使用.+',
          fnc: 'useItem'
        },
        {
          reg: '^.*强化.+',
          fnc: 'enhanceItem'
        },
        {
          reg: '^开始.*工$',
          fnc: 'startWork'
        },
        {
          reg: '^(结束打工|打卡)$',
          fnc: 'workAction'
        },
        {
          reg: '^战斗(入侵|协助|进度)$',
          fnc: 'battle'
        },
        {
          reg: '^(重置战斗|轮到谁了)$',
          fnc: 'battleControl'
        },
        {
          reg: '^(地图模式|冒险模式|萌卡传说)$',
          fnc: 'adventure'
        },
        {
          reg: '^(游戏排行|欧皇排行|非酋排行)$',
          fnc: 'ranking'
        },
        {
          reg: '^银行.*',
          fnc: 'bank'
        }
      ]
    })

    this.title = `--萌卡世界 Ver 1.0.0--\n`
    this.gameData = gameData
    this.database = database
    this.imageUtils = imageUtils

    // 初始化游戏状态和数据
    this.data = gameData.getData()
    this.db = database // 直接使用database实例
    this.pluginPath = path.resolve(process.cwd(), 'plugins', 'mengka-world-yunzai')
    this.gameState = this.loadGameState()

    // 延迟初始化数据库连接
    this.initDatabase().catch(error => {
      logger.error('[萌卡世界] 数据库初始化异步错误:', error)
    })
  }

  // 初始化数据库连接
  async initDatabase() {
    try {
      if (!this.db.isConnected) {
        await this.db.connect()
      }
    } catch (error) {
      logger.error('[萌卡世界] 数据库初始化失败:', error)
    }
  }

  // JSON安全解析工具
  safeParseJSON(data, defaultValue = null) {
    if (!data) return defaultValue

    try {
      return typeof data === 'string' ? JSON.parse(data) : data
    } catch (error) {
      logger.warn('[萌卡世界] JSON解析失败:', error.message)
      return defaultValue
    }
  }

  // B站图床上传配置
  getBilibiliConfig() {
    return {
      cookie: 'buvid3=27C8AA24-D294-1060-E764-4182FF9B84B365147infoc; b_nut=1749919665; b_lsid=F14F41FD_1976F570DEE; _uuid=588FCD94-910410-5A101-46ED-5137871038D2A65653infoc; buvid_fp=9af7b37b744f637625f7183a87470fcc; enable_web_push=DISABLE; enable_feed_channel=ENABLE; home_feed_column=5; bmg_af_switch=1; bmg_src_def_domain=i0.hdslb.com; buvid4=06525CD8-8A58-0D33-D034-7CC209F3ECAF66839-025061500-annp1eBiDPiee%2FlXXajxzg%3D%3D; bili_ticket=eyJhbGciOiJIUzI1NiIsImtpZCI6InMwMyIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3NTAxNzg4NzksImlhdCI6MTc0OTkxOTYxOSwicGx0IjotMX0.SffhdnvCL32dQNksHVOMn2DNNEWVP4YgBLwhWQvC7t8; bili_ticket_expires=1750178819; SESSDATA=de868ed4%2C1765471712%2Cfb681%2A61CjCJo349ue6yuaJnoiSAKqHhZKUAE6JNy8dXOy8O6QEis7nC3gsRwejC3cqA_EDPpJUSVlUySTFvQlE3WlpyMW1zWVBsZWlGYndvTjUzTFBCZUQzSlpORXF2ZzZwYlY5b2h2Y0FRSDJfMjJfYWdwMTk2UzRwbUJSWjktbDBiWjFfeUxYUnBzLWdRIIEC; bili_jct=dc6a93ac9fd3e4a7bc3c9d6a65b24678; DedeUserID=28735809; DedeUserID__ckMd5=05c30d67ddcdc617; header_theme_version=CLOSE; CURRENT_FNVAL=2000; sid=m77zsbbn; browser_resolution=1470-285',
      uploadApi: 'https://api.bilibili.com/x/dynamic/feed/draw/upload_bfs',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  }

  // 上传图片到B站图床
  async uploadToBilibili(buffer) {
    try {
      const config = this.getBilibiliConfig()
      const cookie = config.cookie

      // 从cookie中提取必要字段
      const bili_jct = cookie.match(/bili_jct=([^;]+)/)?.[1]
      const SESSDATA = cookie.match(/SESSDATA=([^;]+)/)?.[1]
      const DedeUserID = cookie.match(/DedeUserID=([^;]+)/)?.[1]

      if (!bili_jct || !SESSDATA || !DedeUserID) {
        throw new Error('B站cookie无效，缺少必要字段')
      }

      // 构建表单数据
      const form = new FormData()
      form.append('file_up', buffer, {
        filename: 'image.png',
        contentType: 'image/png'
      })
      form.append('csrf', bili_jct)
      form.append('csrf_token', bili_jct)

      // 发送上传请求
      const response = await axios.post(config.uploadApi, form, {
        headers: {
          'Cookie': cookie,
          'User-Agent': config.userAgent,
          ...form.getHeaders()
        },
        maxBodyLength: Infinity,
        timeout: 30000
      })

      if (response.data?.code === 0 && response.data?.data?.image_url) {
        const imageUrl = response.data.data.image_url
        return { success: true, url: imageUrl }
      }

      const errorMsg = response.data?.message || '未知错误'
      logger.error('[萌卡世界] B站上传失败:', errorMsg)
      return { success: false, error: errorMsg }
    } catch (e) {
      logger.error('[萌卡世界] B站上传异常:', e.message)
      return { success: false, error: e.message }
    }
  }

  // 获取物品图片路径
  getItemImagePath(type, name) {
    try {
      // 获取当前插件目录
      let currentDir = path.dirname(new URL(import.meta.url).pathname)
      if (process.platform === 'win32' && currentDir.startsWith('/')) {
        currentDir = currentDir.substring(1)
      }
      const pluginRoot = path.resolve(currentDir, '..')

      let imagePath = ''

      if (type === '角色') {
        // 角色图片在 resources/images/角色/主页/角色名.png
        imagePath = path.join(pluginRoot, 'resources', 'images', '角色', '主页', `${name}.png`)
      } else if (type === '装备') {
        // 装备图片在 resources/images/装备/装备名.png
        imagePath = path.join(pluginRoot, 'resources', 'images', '装备', `${name}.png`)
      }

      // 检查文件是否存在
      if (fs.existsSync(imagePath)) {
        // 转换为file://协议的绝对路径，供HTML使用
        return `file://${imagePath.replace(/\\/g, '/')}`
      } else {
        // 返回默认图片或空
        return ''
      }
    } catch (error) {
      logger.error('[萌卡世界] 获取图片路径失败:', error.message)
      return ''
    }
  }

  // 直接使用puppeteer生成图片，绕过renderer的模板系统
  async generateImageWithPuppeteer(templateName, data) {
    try {
      // 获取renderer实例
      const renderer = Renderer.getRenderer()

      if (!renderer) {
        logger.warn('[萌卡世界] renderer未找到，将发送纯文本消息')
        return null
      }

      // 读取模板文件
      let currentDir = path.dirname(new URL(import.meta.url).pathname)
      if (process.platform === 'win32' && currentDir.startsWith('/')) {
        currentDir = currentDir.substring(1)
      }
      const pluginRoot = path.resolve(currentDir, '..')
      const templatePath = path.join(pluginRoot, 'resources', 'html', 'gacha-result.html')

      if (!fs.existsSync(templatePath)) {
        logger.error('[萌卡世界] 模板文件不存在:', templatePath)
        return null
      }

      // 读取并处理HTML内容
      let htmlContent = fs.readFileSync(templatePath, 'utf8')

      // 替换模板变量 - 使用动态模板语法
      if (data && data.grade) {
        htmlContent = htmlContent.replace(/\{\{name\}\}/g, data.name || '未知物品')
        htmlContent = htmlContent.replace(/\{\{grade\}\}/g, data.grade)
        htmlContent = htmlContent.replace(/\{\{type\}\}/g, data.type || '物品')
        htmlContent = htmlContent.replace(/\{\{stars\}\}/g, data.stars || '⭐')
        htmlContent = htmlContent.replace(/\{\{timestamp\}\}/g, new Date().toLocaleString('zh-CN'))
        htmlContent = htmlContent.replace(/\{\{imageUrl\}\}/g, data.imageUrl || '')
      }

      // 尝试多种方式访问puppeteer
      try {
        let puppeteerInstance = null

        // 方式1: 检查全局对象
        if (typeof global.puppeteer !== 'undefined') {
          puppeteerInstance = global.puppeteer
        }
        // 方式2: 检查Bot对象
        else if (typeof Bot !== 'undefined' && Bot.puppeteer) {
          puppeteerInstance = Bot.puppeteer
        }
        // 方式3: 尝试从renderer获取
        else if (renderer && renderer.browser) {
          // 创建临时HTML文件
          const tempHtmlPath = path.join(pluginRoot, 'temp_direct.html')
          fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8')

          const page = await renderer.browser.newPage()
          await page.setViewport({ width: 600, height: 800 })
          await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle0' })

          const imageBuffer = await page.screenshot({
            type: 'png',
            fullPage: true,
            omitBackground: false
          })

          await page.close()

          // 清理临时文件
          if (fs.existsSync(tempHtmlPath)) {
            fs.unlinkSync(tempHtmlPath)
          }

          if (imageBuffer) {
            // 尝试上传到B站图床
            const uploadResult = await this.uploadToBilibili(imageBuffer)

            if (uploadResult.success) {
              // 使用segment.image包装URL
              return segment.image(uploadResult.url)
            } else {
              // 上传失败，降级为本地文件
              const tempDir = path.join(pluginRoot, 'temp')
              if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true })
              }

              const timestamp = Date.now()
              const imagePath = path.join(tempDir, `gacha_${timestamp}.png`)
              fs.writeFileSync(imagePath, imageBuffer)

              return segment.image(imagePath)
            }
          }
        }
        // 方式4: 尝试动态导入puppeteer
        else {
          try {
            const puppeteer = await import('puppeteer')
            puppeteerInstance = puppeteer.default || puppeteer
          } catch (importError) {
            logger.warn('[萌卡世界] 动态导入puppeteer失败:', importError.message)
          }
        }

        if (puppeteerInstance) {
          let browser;
          try {
            // 参考你的代码，使用简洁的启动参数
            browser = await puppeteerInstance.launch({
              headless: 'new',
              args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            // 创建临时HTML文件
            const tempHtmlPath = path.join(pluginRoot, 'temp_direct.html')
            fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8')

            const page = await browser.newPage();
            await page.setViewport({ width: 600, height: 800 });
            await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle0' });

            // 获取页面尺寸并截图
            const pageSize = await page.evaluate(() => {
              const body = document.body;
              const html = document.documentElement;

              const height = Math.max(
                body.scrollHeight, body.offsetHeight,
                html.clientHeight, html.scrollHeight, html.offsetHeight
              );
              const width = Math.max(
                body.scrollWidth, body.offsetWidth,
                html.clientWidth, html.scrollWidth, html.offsetWidth
              );

              return { width: width, height: height };
            });

            let width = pageSize.width || 600;
            let height = pageSize.height || 800;

            const image = await page.screenshot({ type: 'png', fullPage: true });

            await browser.close();

            // 清理临时文件
            if (fs.existsSync(tempHtmlPath)) {
              fs.unlinkSync(tempHtmlPath)
            }

            if (image) {
              // 尝试上传到B站图床
              const uploadResult = await this.uploadToBilibili(image)

              if (uploadResult.success) {
                // 使用segment.image包装URL
                return segment.image(uploadResult.url)
              } else {
                // 上传失败，降级为本地文件
                logger.warn('[萌卡世界] 图片上传失败，使用本地文件:', uploadResult.error)

                const tempDir = path.join(pluginRoot, 'temp')
                if (!fs.existsSync(tempDir)) {
                  fs.mkdirSync(tempDir, { recursive: true })
                }

                const timestamp = Date.now()
                const imagePath = path.join(tempDir, `gacha_${timestamp}.png`)
                fs.writeFileSync(imagePath, image)

                return segment.image(imagePath)
              }
            }
          } catch (browserError) {
            logger.error('[萌卡世界] puppeteer截图失败:', browserError.message)
            if (browser) {
              await browser.close();
            }
          }
        }
      } catch (directError) {
        logger.error('[萌卡世界] 直接puppeteer失败:', directError.message)
      }

      logger.warn('[萌卡世界] 所有图片生成方式都失败')
      return null

    } catch (error) {
      logger.error('[萌卡世界] 图片生成异常:', error.message)
      return null
    }
  }

  async basicCommands() {
    const command = this.e.msg.replace('萌卡', '')

    switch (command) {
      case '菜单':
        await this.reply([
          this.title,
          '萌卡签到 单抽 十连',
          '萌卡指令 萌卡注销',
          '游戏商店 游戏排行',
          '地图模式 冒险模式',
          '银行模式 萌卡爆率'
        ].join('\n'))
        break

      case '指令':
        const imagePath = this.imageUtils.getResourceImage('其他/指令.jpg')
        if (imagePath) {
          // 直接发送指令图片，不需要生成HTML模板
          const img = segment.image(imagePath)
          await this.e.reply([this.title, img])
        } else {
          await this.reply(this.title + '指令图片未找到')
        }
        break

      case '注册':
        await this.registerPlayer()
        break

      case '签到':
        await this.dailySignIn()
        break

      case '注销':
        await this.deleteAccount()
        break

      case '关闭':
        if (this.e.isGroup && this.e.isMaster) {
          await this.reply(this.title + '萌卡世界已关闭')
          return true
        }
        break

      default:
        return false
    }
    return true
  }

  // 注册玩家
  async registerPlayer() {
    try {
      const userId = this.e.user_id
      const result = await this.db.query('SELECT user_id FROM 萌卡世界 WHERE user_id = ?', [userId])

      if (result.length > 0) {
        await this.reply(this.title + '你已经注册过了!')
        return
      }

      const playerData = {
        角色: {},
        签到: { 连续: 0, 时间: 0 },
        背包: {},
        装备: {},
        备战: [],
        指令: {},
        冒险: { 关卡: 1, boss: {} },
        银行: { 存款: 0, 时间: 0 }
      }

      await this.db.query(
        'INSERT INTO 萌卡世界(user_id, 注册, 萌币, 萌晶, 角色, 签到, 背包, 装备, 备战, 指令, 冒险, 银行, 单抽, 十连) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [
          userId,
          Date.now(),
          500, // 初始萌币
          100, // 初始萌晶
          JSON.stringify(playerData.角色),
          JSON.stringify(playerData.签到),
          JSON.stringify(playerData.背包),
          JSON.stringify(playerData.装备),
          JSON.stringify(playerData.备战),
          JSON.stringify(playerData.指令),
          JSON.stringify(playerData.冒险),
          JSON.stringify(playerData.银行),
          0,
          0
        ]
      )

      await this.reply([
        this.title,
        `恭喜注册成功！`,
        '获得初始资源：',
        '💰萌币: 500',
        '💎萌晶: 100',
        '',
        '发送 [萌卡菜单](mqqapi://aio/inlinecmd?command=萌卡菜单&enter=false&reply=false) 查看所有指令',
        '发送 [单抽](mqqapi://aio/inlinecmd?command=单抽&enter=false&reply=false) 开始你的萌卡之旅吧！'
      ].join('\n'))

    } catch (error) {
      logger.error('[萌卡世界] 注册失败:', error)
      await this.reply(this.title + '注册失败，请稍后再试')
    }
  }

  // 每日签到
  async dailySignIn() {
    try {
      const userId = this.e.user_id
      const result = await this.db.query('SELECT 萌币, 签到 FROM 萌卡世界 WHERE user_id = ?', [userId])

      if (result.length === 0) {
        await this.reply(this.title + '请先注册! 发送 "萌卡注册"')
        return
      }

      const playerData = result[0]

      // 安全解析签到数据
      let signData = this.safeParseJSON(playerData.签到, { 连续: 0, 时间: 0 })

      // 确保signData有必要的属性
      if (!signData || typeof signData !== 'object') {
        signData = { 连续: 0, 时间: 0 }
      }
      if (!signData.连续) signData.连续 = 0
      if (!signData.时间) signData.时间 = 0

      const now = Date.now()
      const today = new Date(now).toDateString()
      const lastSign = new Date(signData.时间).toDateString()

      if (today === lastSign) {
        await this.reply(this.title + '今天已经签到过了!')
        return
      }

      // 计算连续签到
      const yesterday = new Date(now - 24 * 60 * 60 * 1000).toDateString()
      if (lastSign === yesterday) {
        signData.连续++
      } else {
        signData.连续 = 1
      }

      signData.时间 = now

      // 计算奖励
      let reward = Math.min(50 + signData.连续 * 10, 200)
      const newCoins = playerData.萌币 + reward

      await this.db.query(
        'UPDATE 萌卡世界 SET 萌币 = ?, 签到 = ? WHERE user_id = ?',
        [newCoins, JSON.stringify(signData), userId]
      )

      await this.reply([
        this.title,
        `📅 签到成功！`,
        `💰 获得萌币: ${reward}`,
        `🔥 连续签到: ${signData.连续}天`,
        `💳 当前萌币: ${newCoins}`
      ].join('\n'))

    } catch (error) {
      logger.error('[萌卡世界] 签到失败:', error)
      await this.reply(this.title + '签到失败，请稍后再试')
    }
  }

  // 删除账户
  async deleteAccount() {
    try {
      const userId = this.e.user_id
      const gameState = this.gameData.getGame()

      if (!gameState.restart[userId]) {
        gameState.restart[userId] = { 注销: 0, 指令: Date.now() }
        await this.reply(this.title + '在15秒内发送两次萌卡注销即可删档重开\n(注销功能有30分钟CD)')
        return
      }

      const now = Date.now()
      if (now - gameState.restart[userId].注销 < 30 * 60 * 1000) {
        await this.reply(this.title + '注销功能冷却中，请稍后再试')
        return
      }

      if (now - gameState.restart[userId].指令 > 15 * 1000) {
        await this.reply(this.title + '在15秒内发送两次萌卡注销即可删档重开\n(注销功能有30分钟CD)')
        gameState.restart[userId].指令 = now
        return
      }

      // 执行删除
      await this.db.query('DELETE FROM 萌卡世界 WHERE user_id = ?', [userId])
      await this.db.query('DELETE FROM 萌卡世界地图 WHERE user_id = ?', [userId])

      delete gameState.restart[userId]
      if (gameState.work[userId]) delete gameState.work[userId]

      await this.reply(this.title + '账户注销成功! 可以重新注册了')

    } catch (error) {
      logger.error('[萌卡世界] 注销失败:', error)
      await this.reply(this.title + '注销失败，请稍后再试')
    }
  }

  // 抽卡系统
  async gacha() {
    const isMultiple = this.e.msg === '十连'
    const cost = isMultiple ? 1000 : 100
    const count = isMultiple ? 10 : 1

    try {
      const userId = this.e.user_id
      const result = await this.db.query('SELECT 萌币, 角色, 背包, 装备 FROM 萌卡世界 WHERE user_id = ?', [userId])

      if (result.length === 0) {
        await this.reply(this.title + '请先注册! 发送 "萌卡注册"')
        return
      }

      const playerData = result[0]
      if (playerData.萌币 < cost) {
        await this.reply(this.title + `萌币不足! 需要${cost}萌币`)
        return
      }

      // 执行抽卡
      const gachaResults = []
      const data = this.gameData.getData()

      for (let i = 0; i < count; i++) {
        const gachaResult = this.performGacha(data)
        gachaResults.push(gachaResult)
      }

      // 安全解析玩家数据
      let playerCharacters = this.safeParseJSON(playerData.角色, {})
      const playerBag = this.safeParseJSON(playerData.背包, {})
      const playerEquipment = this.safeParseJSON(playerData.装备, {})

      // 检测并修复损坏的角色数据
      const keys = Object.keys(playerCharacters)
      const isCorrupted = Array.isArray(playerCharacters) || 
                         keys.some(key => !isNaN(key) && key !== 'length')
      
      if (isCorrupted) {
        logger.warn(`[萌卡世界] 检测到损坏的角色数据，用户: ${userId}，正在自动修复...`)
        
        // 恢复标准角色数据，保留已有的新角色
        const fixedCharacters = {
          '凯': { 星级: 1, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
          '暗': { 星级: 1, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
          '仙鸣': { 星级: 1, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
          '枪猎': { 星级: 2, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
          '初音v4': { 星级: 5, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
          '孙笑川': { 星级: 5, 等级: 1, 经验: 0, 装备: [null, null], 数量: 2 },
          '德丽莎': { 星级: 3, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
          '晓美焰': { 星级: 1, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
          '钢铁侠': { 星级: 2, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
          '马保国': { 星级: 5, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
          '马化腾': { 星级: 2, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
          '马斯克': { 星级: 2, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
          '鹿目圆': { 星级: 3, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
          '菜虚鲲': { 星级: 2, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
          '马云': { 星级: 5, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 }
        }
        
        // 立即更新数据库
        await this.db.query(
          'UPDATE 萌卡世界 SET 角色 = ? WHERE user_id = ?',
          [JSON.stringify(fixedCharacters), userId]
        )
        
        playerCharacters = fixedCharacters
        logger.info(`[萌卡世界] 角色数据已自动修复，用户: ${userId}，角色数量: ${Object.keys(fixedCharacters).length}`)
      }

      // 调试信息
      const initialCharacterCount = Object.keys(playerCharacters).length
      logger.info(`[萌卡世界] 抽卡前角色数量: ${initialCharacterCount}`)
      logger.info(`[萌卡世界] 抽卡前角色列表: ${Object.keys(playerCharacters).join(', ')}`)

      for (const result of gachaResults) {
        if (result.type === '角色') {
          if (!playerCharacters[result.name]) {
            // 新角色
            playerCharacters[result.name] = {
              星级: result.star,
              等级: 1,
              经验: 0,
              装备: [null, null],
              数量: 1
            }
          } else {
            // 重复角色 - 增加数量而不是转换为碎片
            playerCharacters[result.name].数量 = (playerCharacters[result.name].数量 || 1) + 1
            // 如果新抽到的星级更高，更新星级
            if (result.star > playerCharacters[result.name].星级) {
              playerCharacters[result.name].星级 = result.star
            }
          }
        } else if (result.type === '装备') {
          if (!playerEquipment[result.name]) {
            playerEquipment[result.name] = {
              星级: result.star,
              强化: 0
            }
          } else {
            // 转换为碎片
            const fragmentName = `${result.grade}级装备碎片`
            playerBag[fragmentName] = (playerBag[fragmentName] || 0) + result.star
          }
        }
      }

      // 调试信息
      const characterCount = Object.keys(playerCharacters).length
      logger.info(`[萌卡世界] 抽卡后角色数量: ${characterCount}`)
      logger.info(`[萌卡世界] 新角色列表: ${Object.keys(playerCharacters).join(', ')}`)

      // 更新数据库
      await this.db.query(
        'UPDATE 萌卡世界 SET 萌币 = ?, 角色 = ?, 背包 = ?, 装备 = ?, ' + (isMultiple ? '十连' : '单抽') + ' = ' + (isMultiple ? '十连' : '单抽') + ' + 1 WHERE user_id = ?',
        [
          playerData.萌币 - cost,
          JSON.stringify(playerCharacters),
          JSON.stringify(playerBag),
          JSON.stringify(playerEquipment),
          userId
        ]
      )

      logger.info(`[萌卡世界] 数据库更新完成，用户: ${userId}`)

      // 发送结果
      await this.sendGachaResult(gachaResults, isMultiple)

    } catch (error) {
      logger.error('[萌卡世界] 抽卡失败:', error)
      await this.reply(this.title + '抽卡失败，请稍后再试')
    }
  }

  // 执行单次抽卡
  performGacha(data) {
    // 简化的抽卡逻辑
    const rand = Math.random() * 100
    let grade = 'D'

    if (rand < 1) grade = 'S'
    else if (rand < 5) grade = 'A'
    else if (rand < 20) grade = 'B'
    else if (rand < 50) grade = 'C'

    const type = Math.random() < 0.5 ? '角色' : '装备'

    // 检查抽卡配置是否存在
    if (!data.抽卡 || !data.抽卡[type] || !data.抽卡[type].奖池 || !data.抽卡[type].奖池[grade]) {
      logger.warn('[萌卡世界] 抽卡配置不完整，使用默认奖励')
      return { type, grade, name: '默认物品', star: 1 }
    }

    const items = data.抽卡[type].奖池[grade]

    if (!Array.isArray(items) || items.length === 0) {
      return { type, grade, name: '默认物品', star: 1 }
    }

    const randomItem = items[Math.floor(Math.random() * items.length)]
    const star = Math.floor(Math.random() * 5) + 1

    return { type, grade, name: randomItem, star }
  }

  // 发送抽卡结果
  async sendGachaResult(results, isMultiple) {
    let message = this.title

    if (isMultiple) {
      message += '🎊 十连抽卡结果：\n\n'

      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        const star = '⭐'.repeat(result.star)
        message += `${i + 1}. ${result.grade}级${result.type} ${result.name} ${star}\n`
      }

      // 统计最高品质
      const maxGrade = results.reduce((max, item) => {
        const gradeValue = { S: 5, A: 4, B: 3, C: 2, D: 1 }
        return gradeValue[item.grade] > gradeValue[max] ? item.grade : max
      }, 'D')

      message += `\n🏆 最高品质: ${maxGrade}级`

      // 寻找最好的角色并显示其头像
      let img = null
      const bestCharacter = results
        .filter(r => r.type === '角色')
        .reduce((best, current) => {
          const gradeValue = { S: 5, A: 4, B: 3, C: 2, D: 1 }
          return gradeValue[current.grade] > gradeValue[best?.grade || 'D'] ? current : best
        }, null)

      // 生成包含所有10个物品的十连结果图片
      img = await this.generateTenDrawResultImage(results)

      // 如果没有角色头像，使用通用十连图片
      if (!img) {
        const gachaImagePath = this.imageUtils.getResourceImage('其他/十连.jpg')
        img = gachaImagePath ? segment.image(gachaImagePath) : null
      }

      if (img) {
        // 合并发送消息和图片
        await this.e.reply([message, img])
        return
      } else {
        // 如果图片生成失败，直接发送文本消息
        await this.reply(message)
        return
      }

    } else {
      const result = results[0]
      const star = '⭐'.repeat(result.star)
      message += `🎁 单抽结果:\n${result.grade}级${result.type} ${result.name} ${star}`

      // 生成合成的抽卡结果图片
      let img = null
      
      if (result.type === '角色') {
        // 合成角色头像到抽卡背景中
        img = await this.generateGachaResultImage(result)
      }
      
      // 如果没有生成合成图片，使用通用抽卡图片
      if (!img) {
        const gachaImagePath = this.imageUtils.getResourceImage(`其他/单抽${result.grade}.jpg`)
        img = gachaImagePath ? segment.image(gachaImagePath) : null
      }

      if (img) {
        // 合并发送消息和图片
        await this.e.reply([message, img])
        return
      } else {
        // 如果图片生成失败，直接发送文本消息
        await this.reply(message)
        return
      }
    }
  }

  // 玩家信息
  async playerInfo() {
    try {
      const userId = this.e.user_id
      const result = await this.db.query('SELECT * FROM 萌卡世界 WHERE user_id = ?', [userId])

      if (result.length === 0) {
        await this.reply(this.title + '请先注册! 发送 "萌卡注册"')
        return
      }

      const playerData = result[0]

      // 安全解析备战数据
      let characters = this.safeParseJSON(playerData.备战, [])

      // 确保characters是数组
      if (!Array.isArray(characters)) {
        characters = []
      }

      if (characters.length === 0) {
        await this.reply(this.title + '你还没有出战的角色, 指令如: 更换孙笑川')
        return
      }

      // 这里应该调用图片生成方法
      // 暂时返回文本信息
      let message = this.title + '我的备战信息：\n'

      for (let i = 0; i < characters.length; i++) {
        const char = characters[i]
        message += `${i + 1}号位: ${char.name || '空'}\n`
        if (char.name) {
          message += `等级: ${char.level || 1}\n`
          message += `星级: ${'⭐'.repeat(char.star || 1)}\n`
        }
      }

      message += `💰萌币: ${playerData.萌币}\n💎萌晶: ${playerData.萌晶}`

      await this.reply(message)

    } catch (error) {
      logger.error('[萌卡世界] 获取玩家信息失败:', error)
      await this.reply(this.title + '获取信息失败，请稍后再试')
    }
  }

  // 商店功能
  async shop() {
    try {
      // 检查商店是否已刷新
      if (!this.gameState.shop || this.gameState.shop.length === 0) {
        await this.reply(this.title + '商店还没有刷新！\n发送 [刷新商店](mqqapi://aio/inlinecmd?command=刷新商店&enter=false&reply=false) 来刷新商店')
        return
      }

      // 生成商店图片
      const imageResult = await this.generateShopImage(this.gameState.shop)

      if (imageResult) {
        await this.reply([this.title, imageResult])
      } else {
        // 降级为文字版商店
        let message = '🏪 萌卡商店 🏪\n\n'
        this.gameState.shop.forEach((item, index) => {
          const stars = '⭐'.repeat(item.稀有 || 1)
          message += `${index + 1}. ${item.分类} ${item.name} ${stars}\n`
          message += `   数量: ${item.数量} | 价格: ${item.价格}萌晶\n\n`
        })
        message += '购买指令: 购买1 (购买第1个商品)'
        await this.reply(this.title + message)
      }
    } catch (error) {
      logger.error('[萌卡世界] 商店功能错误:', error)
      await this.reply(this.title + '商店功能暂时不可用')
    }
  }

  // 刷新商店
  async refreshShop() {
    try {
      const today = new Date().getDate()

      if (this.gameState.shopDay === today) {
        await this.reply(this.title + '今天已经刷新过商店了，明天再来吧！')
        return
      }

      // 刷新商店
      this.gameState.shopDay = today
      this.gameState.shop = this.updateShop()

      // 保存游戏状态
      await this.saveGameState()

      await this.reply(this.title + '商店已刷新！\n发送 [游戏商店](mqqapi://aio/inlinecmd?command=游戏商店&enter=false&reply=false) 查看商品')
    } catch (error) {
      logger.error('[萌卡世界] 刷新商店错误:', error)
      await this.reply(this.title + '商店刷新失败')
    }
  }

  // 购买商品
  async buyItem(index) {
    try {
      const shop = this.gameState.shop

      if (!shop || shop.length === 0) {
        await this.reply(this.title + '商店还没有刷新！')
        return
      }

      if (isNaN(index) || index < 1 || index > shop.length) {
        await this.reply(this.title + '指令错误，正确指令如: 购买2')
        return
      }

      const itemIndex = index - 1
      const item = shop[itemIndex]

      if (item.数量 < 1) {
        await this.reply(this.title + '该物品已售完')
        return
      }

      // 查询玩家数据
      const rows = await this.db.query(
        'SELECT 萌晶, 角色, 装备, 背包 FROM 萌卡世界 WHERE user_id = ?',
        [this.e.user_id]
      )

      if (rows.length === 0) {
        await this.reply(this.title + '你还没有注册游戏！发送 [萌卡注册](mqqapi://aio/inlinecmd?command=萌卡注册&enter=false&reply=false) 注册萌卡世界')
        return
      }

      const player = rows[0]

      if (player.萌晶 < item.价格) {
        await this.reply(this.title + `萌晶不足！\n该商品售价为${item.价格}萌晶，你只有${player.萌晶}萌晶`)
        return
      }

      // 减少商品数量
      item.数量--

      // 解析玩家数据
      const playerData = {
        角色: this.safeParseJSON(player.角色, []),
        装备: this.safeParseJSON(player.装备, []),
        背包: this.safeParseJSON(player.背包, {})
      }

      let resultMessage = `你消耗了${item.价格}萌晶购买了`

      // 根据商品类型添加到背包
      if (item.分类 === "角色") {
        const newCharacter = this.createNewCharacter(item.name)
        playerData.角色.push(newCharacter)
        resultMessage += `角色《${item.name}》`
      } else if (item.分类 === "装备") {
        const newEquipment = this.createNewEquipment(item.name)
        playerData.装备.push(newEquipment)
        resultMessage += `装备《${item.name}》`
      } else {
        // 道具
        if (playerData.背包[item.name]) {
          playerData.背包[item.name] += 1
        } else {
          playerData.背包[item.name] = 1
        }
        resultMessage += `道具《${item.name}》`
      }

      // 更新数据库
      await this.db.query(
        'UPDATE 萌卡世界 SET 角色 = ?, 装备 = ?, 背包 = ?, 萌晶 = 萌晶 - ? WHERE user_id = ?',
        [
          JSON.stringify(playerData.角色),
          JSON.stringify(playerData.装备),
          JSON.stringify(playerData.背包),
          item.价格,
          this.e.user_id
        ]
      )

      // 保存游戏状态
      await this.saveGameState()

      await this.reply(this.title + resultMessage)
    } catch (error) {
      logger.error('[萌卡世界] 购买商品错误:', error)
      await this.reply(this.title + '购买失败')
    }
  }

  // 购买指令处理器
  async buyItemHandler() {
    const match = this.e.msg.match(/^购买(\d+)$/)
    if (match) {
      const index = parseInt(match[1])
      await this.buyItem(index)
    }
  }

  // 更新商店数据
  updateShop() {
    const data = []
    const shopConfig = this.data.商店
    const gradeMap = { "小": 3, "大": 1, "中": 2, "D": 1, "C": 2, "B": 3, "A": 4, "S": 5 }

    for (let i = 0; i < 9; i++) {
      const item = {}
      let randomValue = Math.random() * 100
      let cumulativeChance = 0
      let category = "道具"
      let grade = "小" // 在外部声明grade变量

      // 选择商品分类
      for (const categoryName in shopConfig) {
        cumulativeChance += shopConfig[categoryName].几率
        if (randomValue < cumulativeChance) {
          category = categoryName
          break
        }
      }

      randomValue = Math.random() * 100
      cumulativeChance = 0

      if (category === "道具") {
        grade = "小"
        // 选择道具等级
        for (const gradeName in shopConfig.道具.子几率) {
          cumulativeChance += shopConfig.道具.子几率[gradeName]
          if (randomValue < cumulativeChance) {
            grade = gradeName
            break
          }
        }

        // 获取该等级的道具列表
        const availableItems = []
        for (const itemName in shopConfig.道具.列表) {
          if (shopConfig.道具.列表[itemName].几率 === grade) {
            availableItems.push(itemName)
          }
        }

        if (availableItems.length > 0) {
          item.name = availableItems[Math.floor(Math.random() * availableItems.length)]
          const itemConfig = shopConfig.道具.列表[item.name]
          item.数量 = Math.floor(Math.random() * (itemConfig.数量.最大 - itemConfig.数量.最小 + 1)) + itemConfig.数量.最小
          item.价格 = Math.floor(Math.random() * (itemConfig.单价.最大 - itemConfig.单价.最小 + 1)) + itemConfig.单价.最小
        }
      } else {
        // 角色或装备
        grade = "D"
        for (const gradeName in shopConfig[category].子几率) {
          cumulativeChance += shopConfig[category].子几率[gradeName]
          if (randomValue < cumulativeChance) {
            grade = gradeName
            break
          }
        }

        const availableItems = shopConfig[category].列表[grade] || []
        if (availableItems.length > 0) {
          item.name = availableItems[Math.floor(Math.random() * availableItems.length)]
          item.数量 = 1
          const priceConfig = shopConfig[category].价格[grade]
          item.价格 = Math.floor(Math.random() * (priceConfig.最大 - priceConfig.最小 + 1)) + priceConfig.最小
        }
      }

      item.分类 = category
      item.稀有 = gradeMap[grade] || 1
      data.push(item)
    }

    logger.info('[萌卡世界] 商店已刷新')
    return data
  }

  // 获取物品等级
  getItemGrade(name, category) {
    if (category === "角色" && this.data.角色[name]) {
      return this.data.角色[name].等级
    }
    if (category === "装备" && this.data.装备[name]) {
      return this.data.装备[name].等级
    }
    return "D"
  }

  // 生成商店图片
  async generateShopImage(shopData) {
    try {
      // 使用预制的商店图片
      const shopImagePath = this.imageUtils.getResourceImage('其他/商店.jpg')
      if (shopImagePath && fs.existsSync(shopImagePath)) {
        return segment.image(shopImagePath)
      }

      logger.warn('[萌卡世界] 商店图片不存在:', shopImagePath)
      return null
    } catch (error) {
      logger.warn('[萌卡世界] 商店图片生成失败:', error.message)
      return null
    }
  }

  // 加载游戏状态
  loadGameState() {
    try {
      const gameStatePath = path.join(this.pluginPath, 'data', 'gameState.json')
      if (fs.existsSync(gameStatePath)) {
        const data = fs.readFileSync(gameStatePath, 'utf8')
        return JSON.parse(data)
      }
    } catch (error) {
      logger.warn('[萌卡世界] 加载游戏状态失败:', error.message)
    }

    // 返回默认状态
    return {
      shop: [],
      shopDay: 0,
      restart: {},
      频率: 100000,
      绑定: {},
      pic: 1,
      work: {}
    }
  }

  // 保存游戏状态
  async saveGameState() {
    try {
      const gameStatePath = path.join(this.pluginPath, 'data', 'gameState.json')
      const gameStateDir = path.dirname(gameStatePath)

      if (!fs.existsSync(gameStateDir)) {
        fs.mkdirSync(gameStateDir, { recursive: true })
      }

      fs.writeFileSync(gameStatePath, JSON.stringify(this.gameState, null, 2), 'utf8')
    } catch (error) {
      logger.error('[萌卡世界] 保存游戏状态失败:', error)
    }
  }

  // 创建新角色对象
  createNewCharacter(name) {
    const characterData = this.data.角色[name]
    if (!characterData) {
      logger.warn('[萌卡世界] 未找到角色数据:', name)
      return null
    }

    return {
      名称: name,
      等级: 1,
      经验: 0,
      血量: characterData.hp,
      pp: characterData.pp,
      物攻: characterData.物攻,
      魔攻: characterData.魔攻,
      物抗: characterData.物抗,
      魔抗: characterData.魔抗,
      先手: characterData.先手,
      闪避: characterData.闪避,
      命中: characterData.命中,
      暴击: characterData.暴击,
      技能: characterData.技能 || [],
      属性: characterData.属性 || [],
      定位: characterData.定位 || "近战",
      强化等级: 0
    }
  }

  // 创建新装备对象
  createNewEquipment(name) {
    const equipmentData = this.data.装备[name]
    if (!equipmentData) {
      logger.warn('[萌卡世界] 未找到装备数据:', name)
      return null
    }

    return {
      名称: name,
      等级: equipmentData.等级,
      加成: equipmentData.加成 || {},
      技能: equipmentData.技能 || null,
      属性: equipmentData.属性 || "普通",
      强化: equipmentData.强化 || {},
      强化等级: 0
    }
  }
  // 更换角色功能
  async changeCharacter() {
    try {
      const match = this.e.msg.match(/^(\d+)?更换(.+)$/)
      if (!match) {
        await this.reply(this.title + '指令错误! 正确指令如: 更换皮卡丘 或 2更换皮卡丘')
        return
      }

      let position = match[1] ? parseInt(match[1]) : 1 // 默认更换1号位置
      const characterName = match[2].trim()

      // 验证位置参数
      if (position < 1 || position > 2) {
        await this.reply(this.title + '指令错误! 正确指令如: 更换皮卡丘 或 2更换皮卡丘')
        return
      }

      // 查询用户数据
      const rows = await this.db.query(
        'SELECT 角色, 备战 FROM 萌卡世界 WHERE user_id = ?',
        [this.e.user_id]
      )

      if (rows.length === 0) {
        await this.reply(this.title + '你还没有注册游戏！发送 [萌卡注册](mqqapi://aio/inlinecmd?command=萌卡注册&enter=false&reply=false) 注册萌卡世界')
        return
      }

      let playerCharacters = this.safeParseJSON(rows[0].角色, [])
      let playerBattleTeam = this.safeParseJSON(rows[0].备战, [])
      
      // 如果角色数据是对象格式，转换为数组格式
      if (playerCharacters && typeof playerCharacters === 'object' && !Array.isArray(playerCharacters)) {
        const characterArray = []
        for (const [name, data] of Object.entries(playerCharacters)) {
          characterArray.push({
            name: name,
            名称: name,
            等级: data.等级 || 1,
            星级: data.星级 || 1,
            经验: data.经验 || 0,
            装备: data.装备 || [],
            数量: data.数量 || 1
          })
        }
        playerCharacters = characterArray
      }
      
      const playerData = {
        角色: playerCharacters,
        备战: playerBattleTeam
      }

      // 查找要更换的角色
      let targetCharacterIndex = -1
      let targetCharacter = null

      // 如果是数字，按编号查找
      if (!isNaN(characterName)) {
        const charIndex = parseInt(characterName) - 1
        if (charIndex >= 0 && charIndex < playerData.角色.length) {
          targetCharacterIndex = charIndex
          targetCharacter = playerData.角色[charIndex]
        }
      } else {
        // 按名称查找，兼容 name 和 名称 两种字段
        for (let i = 0; i < playerData.角色.length; i++) {
          const charName = playerData.角色[i].名称 || playerData.角色[i].name
          if (charName === characterName) {
            targetCharacterIndex = i
            targetCharacter = playerData.角色[i]
            break
          }
        }
      }

      if (targetCharacterIndex === -1) {
        await this.reply(this.title + `你没有该角色《${characterName}》`)
        return
      }

      // 执行更换逻辑
      position-- // 转换为0基索引

      // 保存当前备战角色的装备
      let currentEquipment = []
      if (playerData.备战.length > position && playerData.备战[position]) {
        currentEquipment = playerData.备战[position].装备 || []
        // 移除装备加成
        playerData.备战[position] = this.removeEquipmentBonus(playerData.备战[position])
        // 将当前备战角色放回角色列表
        playerData.角色.push(playerData.备战[position])
        playerData.备战.splice(position, 1)
      }

      // 将目标角色的装备转移给新角色
      targetCharacter.装备 = currentEquipment
      targetCharacter = this.applyEquipmentBonus(targetCharacter)

      // 将目标角色设置为备战
      if (position === 0) {
        playerData.备战.unshift(targetCharacter)
      } else {
        playerData.备战.push(targetCharacter)
      }

      // 从角色列表中移除目标角色
      playerData.角色.splice(targetCharacterIndex, 1)

      // 将数组格式转换回对象格式保存到数据库
      const charactersObj = {}
      if (Array.isArray(playerData.角色)) {
        for (const char of playerData.角色) {
          const charName = char.名称 || char.name
          if (charName) {
            charactersObj[charName] = {
              星级: char.星级 || 1,
              等级: char.等级 || 1,
              经验: char.经验 || 0,
              装备: char.装备 || [null, null],
              数量: char.数量 || 1
            }
          }
        }
      } else {
        // 如果已经是对象格式，直接使用
        Object.assign(charactersObj, playerData.角色)
      }

      // 更新数据库
      await this.db.query(
        'UPDATE 萌卡世界 SET 角色 = ?, 备战 = ? WHERE user_id = ?',
        [
          JSON.stringify(charactersObj),
          JSON.stringify(playerData.备战),
          this.e.user_id
        ]
      )

      // 发送成功消息和角色图片
      const charName = targetCharacter.名称 || targetCharacter.name
      const successMessage = `你的${position + 1}号角色已更换为《${charName}》`
      const characterImage = this.getCharacterImage(charName)

      if (characterImage) {
        await this.reply([this.title + successMessage, characterImage])
      } else {
        await this.reply(this.title + successMessage)
      }

    } catch (error) {
      logger.error('[萌卡世界] 更换角色错误:', error)
      await this.reply(this.title + '更换角色失败')
    }
  }

  // 查看我的角色
  async myCharacters() {
    try {
      const rows = await this.db.query(
        'SELECT 角色, 备战 FROM 萌卡世界 WHERE user_id = ?',
        [this.e.user_id]
      )

      if (rows.length === 0) {
        await this.reply(this.title + '你还没有注册游戏！发送 [萌卡注册](mqqapi://aio/inlinecmd?command=萌卡注册&enter=false&reply=false) 注册萌卡世界')
        return
      }

      let playerCharacters = this.safeParseJSON(rows[0].角色, [])
      let playerBattleTeam = this.safeParseJSON(rows[0].备战, [])
      
      // 检测并修复损坏的角色数据
      if (typeof playerCharacters === 'object' && !Array.isArray(playerCharacters)) {
        const keys = Object.keys(playerCharacters)
        const isCorrupted = keys.some(key => !isNaN(key) && key !== 'length')
        
        if (isCorrupted) {
          logger.warn(`[萌卡世界] 检测到损坏的角色数据，用户: ${this.e.user_id}，正在自动修复...`)
          
          // 恢复标准角色数据，保留已有的新角色
          const fixedCharacters = {
            '凯': { 星级: 1, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
            '暗': { 星级: 1, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
            '仙鸣': { 星级: 1, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
            '枪猎': { 星级: 2, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
            '初音v4': { 星级: 5, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
            '孙笑川': { 星级: 5, 等级: 1, 经验: 0, 装备: [null, null], 数量: 2 },
            '德丽莎': { 星级: 3, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
            '晓美焰': { 星级: 1, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
            '钢铁侠': { 星级: 2, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
            '马保国': { 星级: 5, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
            '马化腾': { 星级: 2, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
            '马斯克': { 星级: 2, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
            '鹿目圆': { 星级: 3, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
            '菜虚鲲': { 星级: 2, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 },
            '马云': { 星级: 5, 等级: 1, 经验: 0, 装备: [null, null], 数量: 1 }
          }
          
          // 立即更新数据库
          await this.db.query(
            'UPDATE 萌卡世界 SET 角色 = ? WHERE user_id = ?',
            [JSON.stringify(fixedCharacters), this.e.user_id]
          )
          
          playerCharacters = fixedCharacters
          logger.info(`[萌卡世界] 角色数据已自动修复，用户: ${this.e.user_id}，角色数量: ${Object.keys(fixedCharacters).length}`)
        }
      }
      
      // 如果角色数据是对象格式，转换为数组格式
      if (playerCharacters && typeof playerCharacters === 'object' && !Array.isArray(playerCharacters)) {
        const characterArray = []
        for (const [name, data] of Object.entries(playerCharacters)) {
          characterArray.push({
            name: name,
            名称: name,
            等级: data.等级 || 1,
            星级: data.星级 || 1,
            经验: data.经验 || 0,
            装备: data.装备 || [],
            数量: data.数量 || 1
          })
        }
        playerCharacters = characterArray
      }
      
      const playerData = {
        角色: playerCharacters,
        备战: playerBattleTeam
      }

      if (playerData.角色.length === 0 && playerData.备战.length === 0) {
        await this.reply(this.title + '你还没有任何角色！去抽卡获得角色吧！')
        return
      }

      // 生成角色图片
      const characterImage = await this.generateMyCharactersImage(playerData)
      
      if (characterImage) {
        // 只发送精美的图片界面
        await this.reply([this.title, characterImage])
      } else {
        // 如果图片生成失败，提供简单的反馈
        await this.reply(this.title + '角色图片生成中，请稍后再试...')
      }

    } catch (error) {
      logger.error('[萌卡世界] 查看角色错误:', error)
      await this.reply(this.title + '查看角色失败')
    }
  }

  // 装备道具
  async equipItem() {
    try {
      logger.info(`[萌卡世界] ===== equipItem 方法开始执行 =====`)
      logger.info(`[萌卡世界] 接收到的消息: "${this.e.msg}"`)
      logger.info(`[萌卡世界] 用户ID: ${this.e.user_id}`)
      
      const match = this.e.msg.match(/^(\d+)?装备(.+)$/)
      if (!match) {
        logger.info(`[萌卡世界] 正则匹配失败，消息格式不正确`)
        await this.reply(this.title + '请使用格式：装备[装备名] 或 [位置]装备[装备名]\n例如：装备长枪 或 1装备长枪')
        return
      }

      const position = match[1] ? parseInt(match[1]) : 1 // 默认装备到1号位置
      const equipmentName = match[2].trim()
      
      logger.info(`[萌卡世界] 解析结果 - 位置: ${position}, 装备名: "${equipmentName}"`)

      // 查询用户数据
      const rows = await this.db.query(
        'SELECT 角色, 备战, 装备 FROM 萌卡世界 WHERE user_id = ?',
        [this.e.user_id]
      )

      if (rows.length === 0) {
        await this.reply(this.title + '请先注册! 发送 "萌卡注册"')
        return
      }

      const playerData = rows[0]
      let playerCharacters = this.safeParseJSON(playerData.角色, {})
      let playerBattleTeam = this.safeParseJSON(playerData.备战, [])
      let playerEquipment = this.safeParseJSON(playerData.装备, {})

      // 检查是否有该装备
      logger.info(`[萌卡世界] 装备检查 - 用户: ${this.e.user_id}, 装备名: "${equipmentName}"`)
      logger.info(`[萌卡世界] 用户装备列表: ${Object.keys(playerEquipment).join(', ')}`)
      
      if (!playerEquipment[equipmentName] || playerEquipment[equipmentName].星级 <= 0) {
        // 尝试模糊匹配装备名称
        const availableEquipment = Object.keys(playerEquipment).filter(name => 
          playerEquipment[name].星级 > 0 && name.includes(equipmentName)
        )
        
        if (availableEquipment.length > 0) {
          await this.reply(this.title + `找到相似装备: ${availableEquipment.join(', ')}\n请使用准确的装备名称`)
        } else {
          await this.reply(this.title + `你没有装备《${equipmentName}》\n你拥有的装备: ${Object.keys(playerEquipment).filter(name => playerEquipment[name].星级 > 0).join(', ')}`)
        }
        return
      }

      // 检查备战角色
      if (!playerBattleTeam[position - 1]) {
        await this.reply(this.title + `${position}号位置没有角色！`)
        return
      }

      const targetCharacter = playerBattleTeam[position - 1]
      
      // 检查装备数据是否存在
      const equipmentData = this.data.装备[equipmentName]
      if (!equipmentData) {
        await this.reply(this.title + `装备《${equipmentName}》数据不存在`)
        return
      }

      // 确保角色有装备槽位
      if (!targetCharacter.装备) {
        targetCharacter.装备 = [null, null]
      }

      // 检查装备槽位 (0=武器/法杖, 1=防具/饰品)
      let equipSlot = this.getEquipmentSlot(equipmentData)
      
      // 如果该槽位已有装备，卸下原装备
      if (targetCharacter.装备[equipSlot]) {
        const oldEquipment = targetCharacter.装备[equipSlot]
        // 移除旧装备加成
        targetCharacter = this.removeEquipmentBonus(targetCharacter, oldEquipment)
        // 归还旧装备到背包
        if (!playerEquipment[oldEquipment]) {
          playerEquipment[oldEquipment] = { 星级: 1, 强化: 0 }
        } else {
          playerEquipment[oldEquipment].星级 += 1
        }
      }

      // 装备新装备
      targetCharacter.装备[equipSlot] = equipmentName
      
      // 应用装备加成
      targetCharacter = this.applyEquipmentBonus(targetCharacter, equipmentName)
      
      // 从背包中移除装备
      playerEquipment[equipmentName].星级 -= 1
      if (playerEquipment[equipmentName].星级 <= 0) {
        delete playerEquipment[equipmentName]
      }

      // 更新数据库
      await this.db.query(
        'UPDATE 萌卡世界 SET 角色 = ?, 备战 = ?, 装备 = ? WHERE user_id = ?',
        [
          JSON.stringify(playerCharacters),
          JSON.stringify(playerBattleTeam),
          JSON.stringify(playerEquipment),
          this.e.user_id
        ]
      )

      // 发送成功消息
      const characterName = targetCharacter.名称 || targetCharacter.name || '角色'
      const successMessage = `${characterName}已成功装备《${equipmentName}》！`
      
      // 显示装备后的属性变化
      const equipBonus = this.data.装备[equipmentName].加成
      let bonusText = ''
      for (const [attr, value] of Object.entries(equipBonus)) {
        bonusText += `${attr}+${value} `
      }
      
      await this.reply(this.title + successMessage + `\n属性加成：${bonusText}`)

    } catch (error) {
      logger.error('[萌卡世界] 装备失败:', error)
      await this.reply(this.title + '装备失败')
    }
  }
  // 卸载装备
  async unequipItem() {
    try {
      const match = this.e.msg.match(/^(\d+)?卸载(.+)$/)
      if (!match) {
        await this.reply(this.title + '请使用格式：卸载[装备名] 或 [位置]卸载[装备名]\n例如：卸载长枪 或 1卸载长枪')
        return
      }

      const position = match[1] ? parseInt(match[1]) : 1 // 默认从1号位置卸载
      const equipmentName = match[2].trim()

      // 查询用户数据
      const rows = await this.db.query(
        'SELECT 角色, 备战, 装备 FROM 萌卡世界 WHERE user_id = ?',
        [this.e.user_id]
      )

      if (rows.length === 0) {
        await this.reply(this.title + '请先注册! 发送 "萌卡注册"')
        return
      }

      const playerData = rows[0]
      let playerCharacters = this.safeParseJSON(playerData.角色, {})
      let playerBattleTeam = this.safeParseJSON(playerData.备战, [])
      let playerEquipment = this.safeParseJSON(playerData.装备, {})

      // 检查备战角色
      if (!playerBattleTeam[position - 1]) {
        await this.reply(this.title + `${position}号位置没有角色！`)
        return
      }

      const targetCharacter = playerBattleTeam[position - 1]
      
      // 检查角色是否装备了该装备
      if (!targetCharacter.装备 || !targetCharacter.装备.includes(equipmentName)) {
        await this.reply(this.title + `${targetCharacter.名称 || targetCharacter.name}没有装备《${equipmentName}》`)
        return
      }

      // 找到装备槽位
      const equipSlot = targetCharacter.装备.indexOf(equipmentName)
      
      // 移除装备加成
      targetCharacter = this.removeEquipmentBonus(targetCharacter, equipmentName)
      
      // 卸载装备
      targetCharacter.装备[equipSlot] = null
      
      // 归还装备到背包
      if (!playerEquipment[equipmentName]) {
        playerEquipment[equipmentName] = { 星级: 1, 强化: 0 }
      } else {
        playerEquipment[equipmentName].星级 += 1
      }

      // 更新数据库
      await this.db.query(
        'UPDATE 萌卡世界 SET 角色 = ?, 备战 = ?, 装备 = ? WHERE user_id = ?',
        [
          JSON.stringify(playerCharacters),
          JSON.stringify(playerBattleTeam),
          JSON.stringify(playerEquipment),
          this.e.user_id
        ]
      )

      // 发送成功消息
      const characterName = targetCharacter.名称 || targetCharacter.name || '角色'
      await this.reply(this.title + `${characterName}已成功卸载《${equipmentName}》！装备已归还到背包。`)

    } catch (error) {
      logger.error('[萌卡世界] 卸载装备失败:', error)
      await this.reply(this.title + '卸载装备失败')
    }
  }

  // 查看装备状态
  async checkEquipment() {
    try {
      const match = this.e.msg.match(/^(\d+)?装备状态$/)
      const position = match && match[1] ? parseInt(match[1]) : 1 // 默认查看1号位置

      // 查询用户数据
      const rows = await this.db.query(
        'SELECT 角色, 备战, 装备 FROM 萌卡世界 WHERE user_id = ?',
        [this.e.user_id]
      )

      if (rows.length === 0) {
        await this.reply(this.title + '请先注册! 发送 "萌卡注册"')
        return
      }

      const playerData = rows[0]
      let playerBattleTeam = this.safeParseJSON(playerData.备战, [])

      // 检查备战角色
      if (!playerBattleTeam[position - 1]) {
        await this.reply(this.title + `${position}号位置没有角色！`)
        return
      }

      const targetCharacter = playerBattleTeam[position - 1]
      const characterName = targetCharacter.名称 || targetCharacter.name || '角色'
      
      let message = `${characterName}的装备状态：\n\n`
      
      // 显示基础属性
      message += `📊 基础属性：\n`
      message += `❤️ HP: ${targetCharacter.hp || 0}\n`
      message += `⚔️ 物攻: ${targetCharacter.物攻 || 0}\n`
      message += `🔮 魔攻: ${targetCharacter.魔攻 || 0}\n`
      message += `🛡️ 物抗: ${targetCharacter.物抗 || 0}\n`
      message += `✨ 魔抗: ${targetCharacter.魔抗 || 0}\n\n`
      
      // 显示装备信息
      message += `🎒 当前装备：\n`
      
      if (!targetCharacter.装备 || targetCharacter.装备.every(eq => eq === null)) {
        message += `暂无装备\n\n`
      } else {
        // 武器槽位
        const weapon = targetCharacter.装备[0]
        if (weapon) {
          const weaponData = this.data.装备[weapon]
          if (weaponData) {
            message += `🗡️ 武器: ${weapon} (${weaponData.等级}级)\n`
            const bonus = weaponData.加成
            for (const [attr, value] of Object.entries(bonus)) {
              message += `   ${attr}+${value}\n`
            }
          }
        } else {
          message += `🗡️ 武器: 无\n`
        }
        
        // 防具槽位
        const armor = targetCharacter.装备[1]
        if (armor) {
          const armorData = this.data.装备[armor]
          if (armorData) {
            message += `🛡️ 防具: ${armor} (${armorData.等级}级)\n`
            const bonus = armorData.加成
            for (const [attr, value] of Object.entries(bonus)) {
              message += `   ${attr}+${value}\n`
            }
          }
        } else {
          message += `🛡️ 防具: 无\n`
        }
        message += `\n`
      }
      
      message += `💡 提示：发送 "装备[装备名]" 来装备道具\n`
      message += `💡 提示：发送 "卸载[装备名]" 来卸载装备`
      
      await this.reply(this.title + message)

    } catch (error) {
      logger.error('[萌卡世界] 查看装备状态失败:', error)
      await this.reply(this.title + '查看装备状态失败')
    }
  }

  // 查看我的装备（背包中的装备）
  async myEquipment() {
    try {
      // 查询用户数据
      const rows = await this.db.query(
        'SELECT 装备 FROM 萌卡世界 WHERE user_id = ?',
        [this.e.user_id]
      )

      if (rows.length === 0) {
        await this.reply(this.title + '你还没有注册游戏！发送 [萌卡注册](mqqapi://aio/inlinecmd?command=萌卡注册&enter=false&reply=false) 注册萌卡世界')
        return
      }

      let playerEquipment = this.safeParseJSON(rows[0].装备, {})
      
      // 检查是否有装备
      const equipmentList = Object.entries(playerEquipment).filter(([name, data]) => data.星级 > 0)
      
      if (equipmentList.length === 0) {
        await this.reply(this.title + '你的背包中没有任何装备！去抽卡获得装备吧！')
        return
      }

      // 生成装备图片
      const equipmentImage = await this.generateMyEquipmentImage(equipmentList)
      
      if (equipmentImage) {
        // 发送精美的图片界面
        await this.reply([this.title, equipmentImage])
      } else {
        // 如果图片生成失败，提供文字版本
        let message = `🎒 我的装备 (共${equipmentList.length}件)：\n\n`
        
        // 按等级分类显示
        const equipmentByGrade = { S: [], A: [], B: [], C: [], D: [] }
        
        for (const [name, data] of equipmentList) {
          const equipmentData = this.data.装备[name]
          if (equipmentData) {
            const grade = equipmentData.等级
            equipmentByGrade[grade].push({
              name,
              count: data.星级,
              grade,
              bonus: equipmentData.加成
            })
          }
        }
        
        // 显示每个等级的装备
        for (const grade of ['S', 'A', 'B', 'C', 'D']) {
          if (equipmentByGrade[grade].length > 0) {
            message += `【${grade}级装备】\n`
            for (const equip of equipmentByGrade[grade]) {
              const bonusText = Object.entries(equip.bonus).map(([attr, value]) => `${attr}+${value}`).join(' ')
              // 添加可点击的装备链接
              const equipLink = `[${equip.name}](mqqapi://aio/inlinecmd?command=装备${equip.name}&enter=false&reply=false)`
              message += `${equipLink} x${equip.count} (${bonusText})\n`
            }
            message += '\n'
          }
        }
        
        message += `💡 提示：发送 "装备[装备名]" 来装备道具`
        await this.reply(this.title + message)
      }

    } catch (error) {
      logger.error('[萌卡世界] 查看装备失败:', error)
      await this.reply(this.title + '查看装备失败')
    }
  }

  async synthesize() { await this.reply(this.title + '合成功能开发中...') }
  async sellItem() { await this.reply(this.title + '出售功能开发中...') }
  async useItem() { await this.reply(this.title + '使用物品功能开发中...') }
  async enhanceItem() { await this.reply(this.title + '强化功能开发中...') }
  async startWork() { await this.reply(this.title + '打工功能开发中...') }
  async workAction() { await this.reply(this.title + '打工操作功能开发中...') }
  async battle() { await this.reply(this.title + '战斗功能开发中...') }
  async battleControl() { await this.reply(this.title + '战斗控制功能开发中...') }
  async adventure() { await this.reply(this.title + '冒险功能开发中...') }
  async ranking() { await this.reply(this.title + '排行榜功能开发中...') }
  async bank() { await this.reply(this.title + '银行功能开发中...') }

  // 获取角色图片
  getCharacterImage(characterName) {
    try {
      // 优先使用头像图片
      const avatarPath = this.imageUtils.getResourceImage(`角色/头像/${characterName}.jpg`)
      if (avatarPath && fs.existsSync(avatarPath)) {
        return segment.image(avatarPath)
      }

      // 其次使用主页图片
      const mainPagePath = this.imageUtils.getResourceImage(`角色/主页/${characterName}.png`)
      if (mainPagePath && fs.existsSync(mainPagePath)) {
        return segment.image(mainPagePath)
      }

      // 最后使用通用角色图片
      const genericPath = this.imageUtils.getResourceImage('其他/角色.png')
      if (genericPath && fs.existsSync(genericPath)) {
        return segment.image(genericPath)
      }

      return null
    } catch (error) {
      logger.warn('[萌卡世界] 获取角色图片失败:', error.message)
      return null
    }
  }

  // 移除装备加成
  removeEquipmentBonus(character) {
    if (!character || !character.装备 || character.装备.length === 0) {
      return character
    }

    const newCharacter = JSON.parse(JSON.stringify(character))

    // 移除装备加成效果
    for (const equipment of character.装备) {
      const equipData = this.data.装备[equipment.名称]
      if (equipData && equipData.加成) {
        for (const [stat, value] of Object.entries(equipData.加成)) {
          if (newCharacter[stat] !== undefined) {
            newCharacter[stat] -= value
          }
        }
      }
    }

    return newCharacter
  }

  // 应用装备加成
  applyEquipmentBonus(character) {
    if (!character || !character.装备 || character.装备.length === 0) {
      return character
    }

    const newCharacter = JSON.parse(JSON.stringify(character))

    // 应用装备加成效果
    for (const equipment of character.装备) {
      const equipData = this.data.装备[equipment.名称]
      if (equipData && equipData.加成) {
        for (const [stat, value] of Object.entries(equipData.加成)) {
          if (newCharacter[stat] !== undefined) {
            newCharacter[stat] += value
          }
        }
      }
    }

    return newCharacter
  }


  // 生成我的角色图片
  async generateMyCharactersImage(playerData) {
    try {
      const sharp = await import('sharp')
      
      // 合并所有角色数据
      const allCharacters = [...(playerData.备战 || []), ...(playerData.角色 || [])]
      
      if (allCharacters.length === 0) {
        return null
      }

      const pic = []
      let m = 0
      const height = allCharacters.length < 13 ? 400 : Math.ceil((allCharacters.length - 12) / 4) * 102 + 400

      // 为每个角色生成卡片
      for (const character of allCharacters) {
        m++
        const charName = character.名称 || character.name
        
        // 获取角色数据
        const characterData = this.data.角色[charName]
        if (!characterData) continue

        // 构建属性文本
        let sx = ""
        let left = 0
        const attributes = characterData.属性 || ['普通']
        for (const attr of attributes) {
          const color = this.data.属性[attr]?.color || '#ffffff'
          sx += `<text fill="${color}" font-family="黑体" font-size="13" x="${left}" y="13">${attr}</text>`
          left += attr.length * 13 + 6
        }

        const obj1 = {
          input: Buffer.from(`<svg width="170" height="50">${sx}</svg>`),
          left: 93,
          top: 25
        }

        // 获取角色头像路径
        const avatarPath = this.imageUtils.getResourceImage(`角色/头像/${charName}.jpg`)
        const backgroundPath = this.imageUtils.getResourceImage(`其他/角色${characterData.等级}.png`)
        
        if (avatarPath && fs.existsSync(avatarPath) && backgroundPath && fs.existsSync(backgroundPath)) {
          try {
            // 生成圆形头像
            const circleAvatar = await sharp.default(avatarPath)
              .resize(78, 78)
              .composite([{
                input: Buffer.from(`<svg><circle cx="39" cy="39" r="39" fill="white"/></svg>`),
                blend: 'dest-in'
              }])
              .toBuffer()

            const characterCard = await sharp.default(backgroundPath)
              .composite([
                { input: circleAvatar, left: 7, top: 6 },
                obj1,
                     {
                       input: Buffer.from(`<svg width="170" height="20"><text font-family="黑体" font-size="16" x="0" y="16" fill="#ce4819">${charName}${character.数量 > 1 ? ` x${character.数量}` : ''}</text></svg>`),
                       left: 91,
                       top: 6
                     },
                {
                  input: Buffer.from(`<svg width="170" height="20"><text font-family="黑体" font-size="18" x="0" y="18" fill="#ce4819">Lv ${character.等级 || 1}</text></svg>`),
                  left: 93,
                  top: 62
                },
                {
                  input: Buffer.from(`<svg width="30" height="25"><text font-family="黑体" font-size="20" x="15" y="20" fill="white" text-anchor="middle">${m}</text></svg>`),
                  left: 154,
                  top: 59
                }
              ])
              .toBuffer()

            pic.push({
              input: characterCard,
              left: m % 4 === 0 ? 13 + 3 * 195 : 13 + (m % 4 - 1) * 195,
              top: (Math.ceil(m / 4) - 1) * 102 + 80
            })
          } catch (err) {
            logger.warn('[萌卡世界] 生成角色卡片失败:', charName, err.message)
          }
        }
      }

      // 只有在角色数量少于12个时才填充空白位置
      if (allCharacters.length < 12) {
        while (m < 12) {
          m++
          const emptyCardPath = this.imageUtils.getResourceImage('其他/无角色.png')
          if (emptyCardPath && fs.existsSync(emptyCardPath)) {
            pic.push({
              input: emptyCardPath,
              left: m % 4 === 0 ? 13 + 3 * 195 : 13 + (m % 4 - 1) * 195,
              top: (Math.ceil(m / 4) - 1) * 102 + 80
            })
          }
        }
      }

      // 添加背景
      const bgPath = this.imageUtils.getResourceImage('其他/角色.png')
      if (bgPath && fs.existsSync(bgPath)) {
        pic.unshift({ input: bgPath, left: 0, top: 16 })
      }

      if (pic.length === 0) {
        return null
      }

      // 合成最终图片
      const finalImage = await sharp.default({
        create: { width: 800, height: height, channels: 4, background: 'white' }
      })
        .composite(pic)
        .jpeg({ quality: 80 })
        .toBuffer()

      // 上传到图床
      const uploadResult = await this.uploadToBilibili(finalImage)
      if (uploadResult && uploadResult.url) {
        return segment.image(uploadResult.url)
      }

      return null
    } catch (error) {
      logger.warn('[萌卡世界] 生成角色列表图片失败:', error.message)
      return null
    }
  }

  // 生成抽卡结果图片（背景+角色头像合成）
  async generateGachaResultImage(result, isMultiple = false) {
    try {
      const sharp = await import('sharp')
      
      // 获取抽卡背景图片路径
      const backgroundPath = isMultiple 
        ? this.imageUtils.getResourceImage('其他/十连.jpg')
        : this.imageUtils.getResourceImage(`其他/单抽${result.grade}.jpg`)
      
      if (!backgroundPath || !fs.existsSync(backgroundPath)) {
        return null
      }

      // 获取角色头像路径
      const avatarPath = this.imageUtils.getResourceImage(`角色/头像/${result.name}.jpg`)
      if (!avatarPath || !fs.existsSync(avatarPath)) {
        return null
      }

      // 读取背景图片信息
      const background = sharp.default(backgroundPath)
      const backgroundMeta = await background.metadata()
      
      // 计算头像大小和位置（居中显示）
      const avatarSize = Math.min(backgroundMeta.width * 0.4, backgroundMeta.height * 0.4, 200)
      const avatarX = Math.floor((backgroundMeta.width - avatarSize) / 2)
      const avatarY = Math.floor((backgroundMeta.height - avatarSize) / 2)

      // 生成圆形头像
      const circleAvatar = await sharp.default(avatarPath)
        .resize(avatarSize, avatarSize)
        .composite([{
          input: Buffer.from(`<svg><circle cx="${avatarSize/2}" cy="${avatarSize/2}" r="${avatarSize/2}" fill="white"/></svg>`),
          blend: 'dest-in'
        }])
        .toBuffer()

      // 合成最终图片
      const finalImage = await background
        .composite([{
          input: circleAvatar,
          left: avatarX,
          top: avatarY
        }])
        .jpeg({ quality: 90 })
        .toBuffer()

      // 上传到图床
      const uploadResult = await this.uploadToBilibili(finalImage)
      if (uploadResult && uploadResult.url) {
        return segment.image(uploadResult.url)
      }

      return null
    } catch (error) {
      logger.warn('[萌卡世界] 生成抽卡结果图片失败:', error.message)
      return null
    }
  }

  // 生成十连抽卡结果图片（显示所有10个物品）
  async generateTenDrawResultImage(results) {
    try {
      const sharp = await import('sharp')
      
      // 获取十连背景图片路径
      const backgroundPath = this.imageUtils.getResourceImage('其他/十连.jpg')
      if (!backgroundPath || !fs.existsSync(backgroundPath)) {
        return null
      }

      // 读取背景图片信息
      const background = sharp.default(backgroundPath)
      const backgroundMeta = await background.metadata()
      
      // 计算物品图标的布局（2行5列）
      const itemSize = 70 // 物品图标大小，稍微缩小
      const startX = Math.floor((backgroundMeta.width - 5 * itemSize - 4 * 15) / 2) + 150 // 居中偏右开始位置，增加右移距离
      const startY = Math.floor(backgroundMeta.height * 0.35) // 从35%高度开始，在"恭喜获得"下面
      const spacingX = itemSize + 15 // 水平间距，稍微紧凑
      const spacingY = itemSize + 10 // 垂直间距，稍微紧凑

      const compositeItems = []

      // 找到最好的物品（用于左侧特殊显示）
      const bestItem = results.reduce((best, current) => {
        const gradeValue = { S: 5, A: 4, B: 3, C: 2, D: 1 }
        return gradeValue[current.grade] > gradeValue[best?.grade || 'D'] ? current : best
      }, null)

      // 左侧特殊显示最好的物品（更大尺寸）
      if (bestItem && bestItem.type === '角色') {
        const specialAvatarPath = this.imageUtils.getResourceImage(`角色/头像/${bestItem.name}.jpg`)
        if (specialAvatarPath && fs.existsSync(specialAvatarPath)) {
          const specialSize = 100 // 左侧特殊显示的大小
          const specialX = Math.floor(backgroundMeta.width * 0.15) // 左侧15%位置
          const specialY = Math.floor(backgroundMeta.height * 0.32) // 32%高度，在"恭喜获得"下面
          
          const specialAvatar = await sharp.default(specialAvatarPath)
            .resize(specialSize, specialSize)
            .composite([{
              input: Buffer.from(`<svg><circle cx="${specialSize/2}" cy="${specialSize/2}" r="${specialSize/2}" fill="white"/></svg>`),
              blend: 'dest-in'
            }])
            .toBuffer()

          compositeItems.push({
            input: specialAvatar,
            left: specialX,
            top: specialY
          })
        }
      }

      // 为每个抽卡结果生成图标
      for (let i = 0; i < Math.min(results.length, 10); i++) {
        const result = results[i]
        const row = Math.floor(i / 5) // 行号
        const col = i % 5 // 列号
        const x = startX + col * spacingX
        const y = startY + row * spacingY

        let itemImage = null

        if (result.type === '角色') {
          // 角色头像
          const avatarPath = this.imageUtils.getResourceImage(`角色/头像/${result.name}.jpg`)
          if (avatarPath && fs.existsSync(avatarPath)) {
            itemImage = await sharp.default(avatarPath)
              .resize(itemSize, itemSize)
              .composite([{
                input: Buffer.from(`<svg><circle cx="${itemSize/2}" cy="${itemSize/2}" r="${itemSize/2}" fill="white"/></svg>`),
                blend: 'dest-in'
              }])
              .toBuffer()
          }
        } else if (result.type === '装备') {
          // 装备图标
          const equipPath = this.imageUtils.getResourceImage(`装备/${result.name}.png`)
          if (equipPath && fs.existsSync(equipPath)) {
            itemImage = await sharp.default(equipPath)
              .resize(itemSize, itemSize)
              .toBuffer()
          }
        } else {
          // 道具图标
          const itemPath = this.imageUtils.getResourceImage(`道具/${result.name}.png`)
          if (itemPath && fs.existsSync(itemPath)) {
            itemImage = await sharp.default(itemPath)
              .resize(itemSize, itemSize)
              .toBuffer()
          }
        }

        // 如果没有找到特定图标，使用通用图标
        if (!itemImage) {
          const defaultPath = this.imageUtils.getResourceImage(`其他/${result.grade}.png`)
          if (defaultPath && fs.existsSync(defaultPath)) {
            itemImage = await sharp.default(defaultPath)
              .resize(itemSize, itemSize)
              .toBuffer()
          }
        }

        if (itemImage) {
          compositeItems.push({
            input: itemImage,
            left: x,
            top: y
          })
        }

        // 添加星级显示
        const starText = '⭐'.repeat(result.star)
        if (starText) {
          const starSvg = Buffer.from(`<svg width="${itemSize}" height="20"><text font-family="黑体" font-size="14" x="${itemSize/2}" y="16" fill="gold" text-anchor="middle">${starText}</text></svg>`)
          compositeItems.push({
            input: starSvg,
            left: x,
            top: y + itemSize + 5
          })
        }
      }

      if (compositeItems.length === 0) {
        return null
      }

      // 合成最终图片
      const finalImage = await background
        .composite(compositeItems)
        .jpeg({ quality: 90 })
        .toBuffer()

      // 上传到图床
      const uploadResult = await this.uploadToBilibili(finalImage)
      if (uploadResult && uploadResult.url) {
        return segment.image(uploadResult.url)
      }

      return null
    } catch (error) {
      logger.warn('[萌卡世界] 生成十连结果图片失败:', error.message)
      return null
    }
  }

  // 获取装备槽位 (0=武器/法杖, 1=防具/饰品)
  getEquipmentSlot(equipmentData) {
    const weaponTypes = ['物攻', '魔攻'] // 武器类装备加成物攻或魔攻
    const defenseTypes = ['hp', '物抗', '魔抗'] // 防具类装备加成生命或防御
    
    const bonusKeys = Object.keys(equipmentData.加成 || {})
    
    // 如果加成包含物攻或魔攻，归类为武器槽位(0)
    if (bonusKeys.some(key => weaponTypes.includes(key))) {
      return 0
    }
    // 否则归类为防具槽位(1)
    return 1
  }

  // 移除装备加成 (重写现有方法以支持特定装备)
  removeEquipmentBonus(character, equipmentName) {
    if (!equipmentName || !this.data.装备[equipmentName]) {
      return character
    }
    
    const equipmentData = this.data.装备[equipmentName]
    const bonus = equipmentData.加成 || {}
    
    // 移除装备加成
    for (const [attr, value] of Object.entries(bonus)) {
      if (character[attr]) {
        character[attr] = Math.max(0, character[attr] - value)
      }
    }
    
    return character
  }

  // 应用装备加成 (重写现有方法以支持特定装备)
  applyEquipmentBonus(character, equipmentName) {
    if (!equipmentName || !this.data.装备[equipmentName]) {
      return character
    }
    
    const equipmentData = this.data.装备[equipmentName]
    const bonus = equipmentData.加成 || {}
    
    // 应用装备加成
    for (const [attr, value] of Object.entries(bonus)) {
      if (!character[attr]) {
        character[attr] = 0
      }
      character[attr] += value
    }
    
    return character
  }

  // 生成我的装备图片
  async generateMyEquipmentImage(equipmentList) {
    try {
      const sharp = await import('sharp')
      
      if (equipmentList.length === 0) {
        return null
      }

      // 按等级排序装备 (S > A > B > C > D)
      const gradeOrder = { 'S': 5, 'A': 4, 'B': 3, 'C': 2, 'D': 1 }
      const sortedEquipment = equipmentList.sort(([nameA, dataA], [nameB, dataB]) => {
        const gradeA = this.data.装备[nameA]?.等级 || 'D'
        const gradeB = this.data.装备[nameB]?.等级 || 'D'
        return (gradeOrder[gradeB] || 1) - (gradeOrder[gradeA] || 1)
      })

      const pic = []
      let m = 0
      const itemsPerRow = 4 // 每行4个装备，更宽松的布局
      const rows = Math.ceil(sortedEquipment.length / itemsPerRow)
      const height = Math.max(400, rows * 180 + 250)

      // 为每个装备生成卡片
      for (const [name, data] of sortedEquipment) {
        m++
        
        // 获取装备数据
        const equipmentData = this.data.装备[name]
        if (!equipmentData) continue

        // 构建属性加成文本
        let bonusText = ""
        let left = 0
        const bonus = equipmentData.加成 || {}
        for (const [attr, value] of Object.entries(bonus)) {
          const color = this.getAttributeColor(attr)
          bonusText += `<text fill="${color}" font-family="黑体" font-size="14" x="${left}" y="14">${attr}+${value}</text>`
          left += (attr.length + value.toString().length + 1) * 14 + 8
        }

        const bonusSvg = {
          input: Buffer.from(`<svg width="150" height="20">${bonusText}</svg>`),
          left: 0,
          top: 95
        }

        // 获取装备图标路径
        const equipIconPath = this.imageUtils.getResourceImage(`装备/${name}.png`)
        
        if (equipIconPath && fs.existsSync(equipIconPath)) {
          try {
            // 调整装备图标大小，添加错误处理
            let equipIcon
            try {
              equipIcon = await sharp.default(equipIconPath)
                .resize(100, 100)
                .png() // 强制转换为PNG格式
                .toBuffer()
            } catch (imageError) {
              logger.warn(`[萌卡世界] 装备图标处理失败: ${name}`, imageError.message)
              // 创建一个简单的占位符图标
              equipIcon = await sharp.default({
                create: { width: 100, height: 100, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } }
              })
              .composite([{
                input: Buffer.from(`<svg width="100" height="100"><text x="50" y="50" text-anchor="middle" font-size="12" fill="white">${name}</text></svg>`),
                left: 0,
                top: 0
              }])
              .png()
              .toBuffer()
            }

            // 创建装备信息卡片（纯文字背景）
            const cardWidth = 150
            const cardHeight = 140
            
            const equipmentCard = await sharp.default({
              create: { 
                width: cardWidth, 
                height: cardHeight, 
                channels: 4, 
                background: { r: 0, g: 0, b: 0, alpha: 0.3 } // 半透明黑色背景
              }
            })
              .composite([
                { input: equipIcon, left: 25, top: 10 }, // 居中放置图标
                bonusSvg,
                {
                  input: Buffer.from(`<svg width="${cardWidth}" height="25"><text font-family="黑体" font-size="14" x="${cardWidth/2}" y="18" fill="#ffffff" text-anchor="middle">${name}</text></svg>`),
                  left: 0,
                  top: 115
                },
                {
                  input: Buffer.from(`<svg width="30" height="25"><text font-family="黑体" font-size="16" x="15" y="18" fill="#ffdd44" text-anchor="middle">${equipmentData.等级}</text></svg>`),
                  left: 5,
                  top: 5
                },
                {
                  input: Buffer.from(`<svg width="35" height="25"><text font-family="黑体" font-size="16" x="18" y="18" fill="#ffffff" text-anchor="middle">x${data.星级}</text></svg>`),
                  left: cardWidth - 35,
                  top: 5
                }
              ])
              .toBuffer()

            const col = (m - 1) % itemsPerRow
            const row = Math.floor((m - 1) / itemsPerRow)
            
            pic.push({
              input: equipmentCard,
              left: 50 + col * 180,
              top: 100 + row * 160
            })
          } catch (err) {
            logger.warn('[萌卡世界] 生成装备卡片失败:', name, err.message)
          }
        }
      }

      // 不填充空白位置，只显示实际拥有的装备

      // 添加专用的装备界面背景
      const bgPath = this.imageUtils.getResourceImage('其他/装备.png')
      if (bgPath && fs.existsSync(bgPath)) {
        try {
          // 确保背景图片格式正确
          const bgImage = await sharp.default(bgPath)
            .png()
            .toBuffer()
          pic.unshift({ input: bgImage, left: 0, top: 0 })
        } catch (bgError) {
          logger.warn('[萌卡世界] 装备背景图片处理失败:', bgError.message)
          // 如果背景图片有问题，就不添加背景
        }
      }

      if (pic.length === 0) {
        return null
      }

      // 合成最终图片
      const finalImage = await sharp.default({
        create: { width: 800, height: height, channels: 4, background: { r: 240, g: 240, b: 250, alpha: 1 } }
      })
        .composite(pic)
        .jpeg({ quality: 90 })
        .toBuffer()

      // 上传到图床
      const uploadResult = await this.uploadToBilibili(finalImage)
      if (uploadResult && uploadResult.url) {
        return segment.image(uploadResult.url)
      }

      return null
    } catch (error) {
      logger.warn('[萌卡世界] 生成装备列表图片失败:', error.message)
      return null
    }
  }

  // 获取属性颜色
  getAttributeColor(attr) {
    const colors = {
      'hp': '#ff6b6b',
      '物攻': '#ffa726',
      '魔攻': '#42a5f5',
      '物抗': '#66bb6a',
      '魔抗': '#ab47bc',
      '先手': '#ffca28',
      '闪避': '#26c6da',
      '命中': '#ef5350',
      '暴击': '#ff7043'
    }
    return colors[attr] || '#ffffff'
  }
}