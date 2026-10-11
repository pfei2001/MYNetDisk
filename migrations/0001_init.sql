-- =============================================
-- mynetdisk D1 Database Schema
-- 基于 roim-picx 精简：单用户密码认证，无 OAuth、
-- 无访问统计（image_stats）、无 NSFW 字段
-- =============================================

-- 用户表（单用户模式：仅一条 login='admin' 的记录）
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'admin' CHECK (role IN ('admin', 'user')),
    can_view_all INTEGER DEFAULT 1 CHECK (can_view_all IN (0, 1)),
    storage_quota INTEGER DEFAULT 0,
    storage_used INTEGER DEFAULT 0,
    upload_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    last_login_at TEXT
);

-- 图片元数据表
CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    user_id INTEGER,
    user_login TEXT NOT NULL,
    original_name TEXT,
    size INTEGER DEFAULT 0,
    mime_type TEXT,
    folder TEXT DEFAULT '',
    tags TEXT,  -- JSON array
    is_public INTEGER DEFAULT 0 CHECK (is_public IN (0, 1)),
    storage_type TEXT DEFAULT 'R2' CHECK (storage_type IN ('R2', 'HF')),
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 分享记录表
CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    image_key TEXT NOT NULL,
    user_id INTEGER,
    user_login TEXT,
    password_hash TEXT,
    max_views INTEGER,
    current_views INTEGER DEFAULT 0,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 操作审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    user_login TEXT,
    action TEXT NOT NULL CHECK (action IN ('upload', 'delete', 'rename', 'share', 'grant_permission', 'revoke_permission', 'login')),
    target_key TEXT,
    details TEXT,  -- JSON object
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- 系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL, -- JSON string
    description TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 相册表
CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cover_image TEXT,
    enable_random_image INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 相册图片关联表
CREATE TABLE IF NOT EXISTS album_images (
    album_id INTEGER NOT NULL,
    image_key TEXT NOT NULL,
    image_url TEXT,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (album_id, image_key),
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

-- 相册分享表
CREATE TABLE IF NOT EXISTS album_shares (
    id TEXT PRIMARY KEY,
    album_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    user_login TEXT NOT NULL,
    password_hash TEXT,
    max_views INTEGER,
    current_views INTEGER DEFAULT 0,
    expires_at TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
);

-- API Keys 表
CREATE TABLE IF NOT EXISTS api_keys (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_login TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    last_used_at TEXT,
    expires_at TEXT,
    is_active INTEGER DEFAULT 1 CHECK (is_active IN (0, 1)),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- 索引
-- =============================================
CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);
CREATE INDEX IF NOT EXISTS idx_images_user_login ON images(user_login);
CREATE INDEX IF NOT EXISTS idx_images_folder ON images(folder);
CREATE INDEX IF NOT EXISTS idx_images_created_at ON images(created_at);
CREATE INDEX IF NOT EXISTS idx_images_original_name ON images(original_name);
CREATE INDEX IF NOT EXISTS idx_shares_image_key ON shares(image_key);
CREATE INDEX IF NOT EXISTS idx_shares_user_login ON shares(user_login);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_login ON audit_logs(user_login);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_albums_user_id ON albums(user_id);
CREATE INDEX IF NOT EXISTS idx_album_images_album_id ON album_images(album_id);
CREATE INDEX IF NOT EXISTS idx_album_shares_album_id ON album_shares(album_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_login ON api_keys(user_login);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);

-- =============================================
-- 默认数据
-- =============================================
INSERT OR IGNORE INTO system_settings (key, value, description)
VALUES (
    'upload_config',
    '[{"type":"image/png","ext":"png"},{"type":"image/jpeg","ext":"jpeg"},{"type":"image/gif","ext":"gif"},{"type":"image/webp","ext":"webp"},{"type":"image/jpg","ext":"jpg"},{"type":"image/x-icon","ext":"ico"},{"type":"application/x-ico","ext":"ico"},{"type":"image/vnd.microsoft.icon","ext":"ico"}]',
    'Supported upload file types and extensions'
);
