import { Hono } from 'hono'
import { Ok, Fail, Folder } from '../type'
import { auth, type AppEnv } from '../middleware/auth'

const folderRoutes = new Hono<AppEnv>()

// 创建目录
folderRoutes.post("/folder", auth, async (c) => {
    try {
        const data = await c.req.json<Folder>()
        // Allow letters, numbers, underscores, hyphens and Chinese
        const regx = /^[A-Za-z0-9_-\u4e00-\u9fa5]+$/
        if (!data.name || !regx.test(data.name)) {
            return c.json(Fail("Folder name error: only letters, numbers, underscores, hyphens and Chinese allowed"))
        }
        await c.env.PICX.put(data.name + '/', null)
        return c.json(Ok("Success"))
    } catch (e) {
        console.error('Create folder error:', e)
        return c.json(Fail(`Create folder fail: ${(e as Error).message}`))
    }
})

// 删除目录（含目录下所有文件，不可恢复）
folderRoutes.delete("/folder", auth, async (c) => {
    try {
        const data = await c.req.json<{ name?: string }>()
        const regx = /^[A-Za-z0-9_-\u4e00-\u9fa5]+$/
        if (!data.name || !regx.test(data.name)) {
            return c.json(Fail("Folder name error"))
        }
        const prefix = data.name + '/'

        // 删除 R2 中该前缀下的所有对象（含目录标记自身）
        let cursor: string | undefined = undefined
        do {
            const listed = await c.env.PICX.list({ prefix, cursor })
            for (const obj of listed.objects) {
                await c.env.PICX.delete(obj.key)
            }
            cursor = listed.truncated ? listed.cursor : undefined
        } while (cursor)

        // 删除 D1 中该目录下的图片记录
        await c.env.DB.prepare('DELETE FROM images WHERE folder = ?').bind(prefix).run()

        return c.json(Ok("Success"))
    } catch (e) {
        console.error('Delete folder error:', e)
        return c.json(Fail(`Delete folder fail: ${(e as Error).message}`))
    }
})

export default folderRoutes
