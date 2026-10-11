import { Hono } from 'hono'
import { Ok, Fail, FailCode } from '../type'
import StatusCode from '../type'
import type { AppEnv } from '../middleware/auth'
import { createSessionToken, verifySessionToken, safeCompare, SESSION_COOKIE, auth, getOrCreateAdminUser } from '../middleware/auth'
import { ConfigService } from '../services/ConfigService'

const authRoutes = new Hono<AppEnv>()

/**
 * 获取认证配置（前端用）
 * GET /rest/auth/config
 */
authRoutes.get('/auth/config', async (c) => {
    const storageProviders: Array<{ type: 'R2' | 'HF', name: string, enabled: boolean }> = [
        { type: 'R2', name: 'Cloudflare R2', enabled: true }
    ]
    if (c.env.HF_TOKEN && c.env.HF_REPO) {
        storageProviders.push({ type: 'HF', name: 'Hugging Face', enabled: true })
    }
    const defaultStorage = c.env.STORAGE_TYPE || 'R2'
    return c.json(Ok({
        authType: 'password',
        storageProviders,
        defaultStorage
    }))
})

function sessionCookieHeader(token: string, maxAge: number): string {
    // Secure 只在 https 下生效；本地 http 调试时浏览器会忽略 Secure，此处始终带上
    return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Secure`
}

/**
 * 密码登录
 * POST /rest/auth/login  { password }
 * 成功后通过 httpOnly cookie 下发 session，前端不接触任何 token
 */
authRoutes.post('/auth/login', async (c) => {
    const password = c.env.ADMIN_PASSWORD
    if (!password) {
        return c.json(FailCode('ADMIN_PASSWORD is not configured', StatusCode.ServerError))
    }
    let body: { password?: string }
    try {
        body = await c.req.json()
    } catch {
        return c.json(Fail('Invalid request body'))
    }
    if (!body.password || !(await safeCompare(body.password, password))) {
        return c.json(FailCode('密码错误', StatusCode.NotAuth))
    }
    // 确保管理员用户行存在（用量统计用）
    try { await getOrCreateAdminUser(c.env.DB) } catch (e) { console.error('getOrCreateAdminUser failed:', e) }
    // session 有效期复用系统设置（管理页可配置，默认 30 天）
    let expireDays = 30
    try { expireDays = await new ConfigService(c.env.DB).getTokenExpireDays() } catch (e) { console.error('getTokenExpireDays failed:', e) }
    const maxAge = expireDays * 24 * 3600
    const token = await createSessionToken(password, maxAge)
    return c.json(Ok({ ok: true }), 200, {
        'Set-Cookie': sessionCookieHeader(token, maxAge)
    })
})

/**
 * 登出：清除 session cookie
 * POST /rest/auth/logout
 */
authRoutes.post('/auth/logout', async (c) => {
    return c.json(Ok({ ok: true }), 200, {
        'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`
    })
})

/**
 * 检查当前会话是否有效
 * GET /rest/auth/me
 */
authRoutes.get('/auth/me', auth, async (c) => {
    const header = c.req.header('cookie') || ''
    const token = header.split(';').map(s => s.trim()).find(s => s.startsWith(SESSION_COOKIE + '='))?.slice(SESSION_COOKIE.length + 1)
    const valid = token ? await verifySessionToken(decodeURIComponent(token), c.env.ADMIN_PASSWORD) : false
    return c.json(Ok({ loggedIn: valid }))
})

export default authRoutes
