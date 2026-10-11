import { Hono } from 'hono'
import { Ok, Fail, FailCode } from '../type'
import StatusCode from '../type'
import type { User, DbUser, UserStats } from '../type'
import { auth, type AppEnv, adminAuth } from '../middleware/auth'

const adminRoutes = new Hono<AppEnv>()

// ============================================
// 用户管理接口
// ============================================

/**
 * 获取用户列表 (支持分页和搜索)
 */
adminRoutes.get('/users', auth, adminAuth, async (c) => {
    const page = parseInt(c.req.query('page') || '1')
    const limit = parseInt(c.req.query('limit') || '10')
    const keyword = c.req.query('q') || ''
    const offset = (page - 1) * limit

    try {
        let query = 'SELECT * FROM users'
        let countQuery = 'SELECT COUNT(*) as count FROM users'
        const params: any[] = []

        if (keyword) {
            const condition = ' WHERE login LIKE ? OR name LIKE ?'
            query += condition
            countQuery += condition
            params.push(`%${keyword}%`, `%${keyword}%`)
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'

        const [listResult, countResult] = await Promise.all([
            c.env.DB.prepare(query).bind(...params, limit, offset).all(),
            c.env.DB.prepare(countQuery).bind(...params).first<{ count: number }>()
        ])

        const users = ((listResult.results || []) as unknown as DbUser[]).map((u: DbUser) => ({
            id: u.id,
            login: u.login,
            name: u.name,
            avatarUrl: u.avatar_url,
            role: u.role,
            canViewAll: u.can_view_all === 1,
            storageQuota: u.storage_quota,
            storageUsed: u.storage_used,
            uploadCount: u.upload_count,
            createdAt: u.created_at,
            lastLoginAt: u.last_login_at
        }))

        return c.json(Ok({
            list: users,
            total: countResult?.count || 0
        }))
    } catch (e) {
        console.error('Failed to get users:', e)
        return c.json(Fail(`获取用户列表失败: ${(e as Error).message}`))
    }
})

/**
 * 获取单个用户信息
 */
adminRoutes.get('/users/:login', auth, adminAuth, async (c) => {
    const login = c.req.param('login')

    try {
        const user = await c.env.DB.prepare(
            'SELECT * FROM users WHERE login = ?'
        ).bind(login).first<DbUser>()

        if (!user) {
            return c.json(Fail('用户不存在'))
        }

        return c.json(Ok({
            id: user.id,
            login: user.login,
            name: user.name,
            avatarUrl: user.avatar_url,
            role: user.role,
            canViewAll: user.can_view_all === 1,
            storageQuota: user.storage_quota,
            storageUsed: user.storage_used,
            uploadCount: user.upload_count,
            createdAt: user.created_at,
            lastLoginAt: user.last_login_at
        }))
    } catch (e) {
        console.error('Failed to get user:', e)
        return c.json(Fail(`获取用户失败: ${(e as Error).message}`))
    }
})

/**
 * 授权/取消授权用户查看所有图片
 */
adminRoutes.post('/users/:login/view-all', auth, adminAuth, async (c) => {
    const login = c.req.param('login')
    const { grant } = await c.req.json<{ grant: boolean }>()

    try {
        const result = await c.env.DB.prepare(
            'UPDATE users SET can_view_all = ? WHERE login = ?'
        ).bind(grant ? 1 : 0, login).run()

        if (result.meta.changes === 0) {
            return c.json(Fail('用户不存在'))
        }

        // 记录审计日志
        const adminUser = c.get('user') as User | undefined
        await c.env.DB.prepare(
            `INSERT INTO audit_logs (user_id, user_login, action, target_key, details) 
             VALUES (?, ?, ?, ?, ?)`
        ).bind(
            adminUser?.id || null,
            adminUser?.login || 'admin_token',
            grant ? 'grant_permission' : 'revoke_permission',
            login,
            JSON.stringify({ permission: 'view_all', grant })
        ).run()

        return c.json(Ok({ login, canViewAll: grant }))
    } catch (e) {
        console.error('Failed to update user permission:', e)
        return c.json(Fail(`更新权限失败: ${(e as Error).message}`))
    }
})

/**
 * 设置用户角色
 */
adminRoutes.post('/users/:login/role', auth, adminAuth, async (c) => {
    const login = c.req.param('login')
    const { role } = await c.req.json<{ role: 'admin' | 'user' }>()

    if (role !== 'admin' && role !== 'user') {
        return c.json(Fail('无效的角色'))
    }

    try {
        const result = await c.env.DB.prepare(
            'UPDATE users SET role = ?, can_view_all = ? WHERE login = ?'
        ).bind(role, role === 'admin' ? 1 : 0, login).run()

        if (result.meta.changes === 0) {
            return c.json(Fail('用户不存在'))
        }

        // 记录审计日志
        const adminUser = c.get('user') as User | undefined
        await c.env.DB.prepare(
            `INSERT INTO audit_logs (user_id, user_login, action, target_key, details) 
             VALUES (?, ?, ?, ?, ?)`
        ).bind(
            adminUser?.id || null,
            adminUser?.login || 'admin_token',
            role === 'admin' ? 'grant_permission' : 'revoke_permission',
            login,
            JSON.stringify({ permission: 'admin_role', role })
        ).run()

        return c.json(Ok({ login, role }))
    } catch (e) {
        console.error('Failed to update user role:', e)
        return c.json(Fail(`更新角色失败: ${(e as Error).message}`))
    }
})

/**
 * 设置用户存储配额
 */
adminRoutes.post('/users/:login/quota', auth, adminAuth, async (c) => {
    const login = c.req.param('login')
    const { quota } = await c.req.json<{ quota: number }>()

    if (typeof quota !== 'number' || quota < 0) {
        return c.json(Fail('无效的配额值'))
    }

    try {
        const result = await c.env.DB.prepare(
            'UPDATE users SET storage_quota = ? WHERE login = ?'
        ).bind(quota, login).run()

        if (result.meta.changes === 0) {
            return c.json(Fail('用户不存在'))
        }

        return c.json(Ok({ login, storageQuota: quota }))
    } catch (e) {
        console.error('Failed to update user quota:', e)
        return c.json(Fail(`更新配额失败: ${(e as Error).message}`))
    }
})

// ============================================
// 统计接口
// ============================================

/**
 * 获取系统总体统计
 */
adminRoutes.get('/stats', auth, adminAuth, async (c) => {
    try {
        const [userCount, imageCount, totalSize, recentUploads] = await Promise.all([
            c.env.DB.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>(),
            c.env.DB.prepare('SELECT COUNT(*) as count FROM images').first<{ count: number }>(),
            c.env.DB.prepare('SELECT COALESCE(SUM(size), 0) as total FROM images').first<{ total: number }>(),
            c.env.DB.prepare(
                `SELECT COUNT(*) as count FROM images 
                 WHERE created_at >= datetime('now', '-7 days')`
            ).first<{ count: number }>()
        ])

        return c.json(Ok({
            userCount: userCount?.count || 0,
            imageCount: imageCount?.count || 0,
            totalSize: totalSize?.total || 0,
            recentUploads: recentUploads?.count || 0
        }))
    } catch (e) {
        console.error('Failed to get stats:', e)
        return c.json(Fail(`获取统计失败: ${(e as Error).message}`))
    }
})

/**
 * 获取用户统计
 */
adminRoutes.get('/users/:login/stats', auth, adminAuth, async (c) => {
    const login = c.req.param('login')

    try {
        const [imageCount, totalSize, recentUploads] = await Promise.all([
            c.env.DB.prepare(
                'SELECT COUNT(*) as count FROM images WHERE user_login = ?'
            ).bind(login).first<{ count: number }>(),
            c.env.DB.prepare(
                'SELECT COALESCE(SUM(size), 0) as total FROM images WHERE user_login = ?'
            ).bind(login).first<{ total: number }>(),
            c.env.DB.prepare(
                `SELECT COUNT(*) as count FROM images 
                 WHERE user_login = ? AND created_at >= datetime('now', '-7 days')`
            ).bind(login).first<{ count: number }>()
        ])

        return c.json(Ok(<UserStats>{
            totalImages: imageCount?.count || 0,
            totalSize: totalSize?.total || 0,
            totalViews: 0,
            recentUploads: recentUploads?.count || 0
        }))
    } catch (e) {
        console.error('Failed to get user stats:', e)
        return c.json(Fail(`获取用户统计失败: ${(e as Error).message}`))
    }
})

// ============================================
// 审计日志接口
// ============================================

/**
 * 获取审计日志
 */
adminRoutes.get('/audit-logs', auth, adminAuth, async (c) => {
    const limit = parseInt(c.req.query('limit') || '50')
    const offset = parseInt(c.req.query('offset') || '0')
    const action = c.req.query('action')
    const userLogin = c.req.query('user')

    try {
        let query = 'SELECT * FROM audit_logs WHERE 1=1'
        let countQuery = 'SELECT COUNT(*) as count FROM audit_logs WHERE 1=1'
        const params: any[] = []

        if (action) {
            const condition = ' AND action = ?'
            query += condition
            countQuery += condition
            params.push(action)
        }
        if (userLogin) {
            const condition = ' AND user_login = ?'
            query += condition
            countQuery += condition
            params.push(userLogin)
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'

        const [result, countResult] = await Promise.all([
            c.env.DB.prepare(query).bind(...params, limit, offset).all(),
            c.env.DB.prepare(countQuery).bind(...params).first<{ count: number }>()
        ])

        return c.json(Ok({
            logs: result.results || [],
            total: countResult?.count || 0,
            hasMore: (result.results?.length || 0) === limit
        }))
    } catch (e) {
        console.error('Failed to get audit logs:', e)
        return c.json(Fail(`获取审计日志失败: ${(e as Error).message}`))
    }
})


/**
 * 同步历史 R2 文件数据到 D1 数据库
 */
adminRoutes.post('/sync-r2-to-d1', auth, adminAuth, async (c) => {
    let limit = 100
    let cursor: string | undefined = undefined
    let dryRun = false

    try {
        const body = await c.req.json().catch(() => ({}))
        limit = parseInt(body.limit || '100')
        cursor = body.cursor || undefined
        dryRun = body.dryRun === true

        // 1. 获取 R2 文件列表 (包含元数据)
        const list = await c.env.PICX.list({
            limit,
            cursor,
            include: ['customMetadata', 'httpMetadata']
        })

        const results = {
            processed: 0,
            synced: 0,
            skipped: 0,
            errors: 0,
            nextCursor: list.cursor,
            hasMore: list.truncated,
            details: [] as any[]
        }

        // 2. 遍历文件并同步到 D1
        for (const object of list.objects) {
            results.processed++
            const key = object.key

            try {
                // 检查数据库中是否已存在
                const existing = await c.env.DB.prepare(
                    'SELECT 1 FROM images WHERE key = ?'
                ).bind(key).first()

                if (existing) {
                    results.skipped++
                    continue
                }

                if (dryRun) {
                    results.synced++
                    results.details.push({ key, status: 'dry_run' })
                    continue
                }

                // 提取元数据
                const meta = object.customMetadata || {}
                const userLogin = meta['uploadedBy'] || 'system'
                const originalName = meta['originalName'] || null
                const mimeType = object.httpMetadata?.contentType || null
                const size = object.size

                // 从 key 中提取目录信息
                let folder = ''
                if (key.includes('/')) {
                    folder = key.substring(0, key.lastIndexOf('/') + 1)
                }

                // 解析过期时间
                let expiresAt = null
                if (meta['expires']) {
                    try {
                        expiresAt = new Date(parseInt(meta['expires'])).toISOString()
                    } catch (e) {
                        console.warn(`Invalid expiry for ${key}:`, meta['expires'])
                    }
                }

                // 3. 插入到 D1
                await c.env.DB.prepare(
                    `INSERT INTO images (key, user_id, user_login, original_name, size, mime_type, folder, expires_at, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
                ).bind(
                    key,
                    null,
                    userLogin,
                    originalName,
                    size,
                    mimeType,
                    folder,
                    expiresAt,
                    object.uploaded.toISOString()
                ).run()

                // 4. 更新用户信息 (同步统计信息)
                await c.env.DB.prepare(
                    `UPDATE users SET 
                        storage_used = storage_used + ?, 
                        upload_count = upload_count + 1 
                     WHERE login = ?`
                ).bind(size, userLogin).run()

                results.synced++
                // results.details.push({ key, status: 'synced' })
            } catch (e) {
                console.error(`Failed to sync ${key}:`, e)
                results.errors++
                results.details.push({ key, error: (e as Error).message })
            }
        }

        return c.json(Ok(results))
    } catch (e) {
        console.error('Sync failed:', e)
        return c.json(Fail(`同步失败: ${(e as Error).message}`))
    }
})

export default adminRoutes


