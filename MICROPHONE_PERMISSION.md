# 🎤 麦克风权限问题解决方案

## 问题: 浏览器没有弹出麦克风权限对话框

### 原因分析

浏览器出于安全考虑,只在以下情况下允许麦克风访问:
1. **HTTPS 连接** (加密连接)
2. **localhost** (本地回环地址)
3. **用户主动授权**

从局域网 IP (如 192.168.x.x) 通过 HTTP 访问时,浏览器会**静默拒绝**麦克风权限请求。

---

## ✅ 解决方案

### 方案 1: 使用 localhost (推荐,最简单)

如果你在同一台机器上访问:

```
访问: http://localhost:3355
```

这样浏览器会正常弹出麦克风权限对话框。

---

### 方案 2: 使用 Chrome 的不安全源标志 (临时方案)

对于 Chrome/Edge 浏览器,可以临时允许不安全源访问麦克风:

#### 步骤:

1. **打开 Chrome 标志页面**:
   ```
   chrome://flags/#unsafely-treat-insecure-origin-as-secure
   ```

2. **添加你的服务器地址**:
   在输入框中添加:
   ```
   http://192.168.31.196:3355
   ```

3. **启用该标志**: 选择 "Enabled"

4. **重启浏览器**: 点击 "Relaunch" 按钮

5. **重新访问**: 打开 http://192.168.31.196:3355

现在浏览器会弹出麦克风权限对话框!

---

### 方案 3: 设置 HTTPS (最安全,推荐生产环境)

使用 `mkcert` 生成本地 SSL 证书:

#### 安装 mkcert:

```bash
# Ubuntu/Debian
sudo apt install libnss3-tools
wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
chmod +x mkcert-v1.4.4-linux-amd64
sudo mv mkcert-v1.4.4-linux-amd64 /usr/local/bin/mkcert

# 安装本地 CA
mkcert -install
```

#### 生成证书:

```bash
cd /home/andy/github/ml_voice_detection
mkcert localhost 192.168.31.196 192.168.31.174
```

这会生成:
- `localhost+2.pem` (证书)
- `localhost+2-key.pem` (密钥)

#### 配置 Vite 使用 HTTPS:

创建 `vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import fs from 'fs'

export default defineConfig({
  server: {
    https: {
      key: fs.readFileSync('./localhost+2-key.pem'),
      cert: fs.readFileSync('./localhost+2.pem'),
    },
    host: '0.0.0.0',
    port: 3355
  }
})
```

#### 重启服务器:

```bash
npm run dev
```

现在访问: `https://192.168.31.196:3355`

---

### 方案 4: 使用 Firefox (更宽松的策略)

Firefox 浏览器对局域网地址的限制相对宽松:

1. 打开 Firefox
2. 访问 `http://192.168.31.196:3355`
3. 点击地址栏左侧的锁图标
4. 找到"权限" → "使用麦克风"
5. 选择"允许"

---

## 🔍 如何检查麦克风权限状态

### Chrome DevTools:

1. 按 `F12` 打开开发者工具
2. 进入 **Console** 标签
3. 输入并执行:

```javascript
navigator.permissions.query({name: 'microphone'}).then(result => {
  console.log('Microphone permission:', result.state);
});
```

结果:
- `granted` ✅ - 已授权
- `denied` ❌ - 已拒绝
- `prompt` ⏸️ - 待询问

### 重置权限:

1. 点击地址栏左侧的图标 (锁或信息图标)
2. 找到"麦克风"权限
3. 选择"重置权限"或"允许"

---

## 🎯 推荐方案

| 场景 | 推荐方案 |
|------|---------|
| 本机测试 | **方案 1**: 使用 localhost |
| 局域网测试 | **方案 2**: Chrome 不安全源标志 |
| 生产环境 | **方案 3**: HTTPS + SSL 证书 |
| 快速调试 | **方案 4**: 使用 Firefox |

---

## 📱 移动设备访问

如果从手机访问局域网地址:

1. **使用 HTTPS** (方案 3)
2. 或使用 **ngrok/localtunnel** 等隧道工具:

```bash
# 使用 ngrok
ngrok http 3355

# 使用 localtunnel
npx localtunnel --port 3355
```

这会给你一个 HTTPS 公网地址,可以从任何设备访问。

---

## ❓ 常见问题

### Q: 为什么 localhost 可以用,IP 地址不行?

A: 浏览器将 localhost 视为"安全上下文",但将局域网 IP 视为"不安全源",除非使用 HTTPS。

### Q: 我已经允许了,但还是不工作?

A:
1. 检查浏览器控制台是否有错误
2. 清除浏览器缓存和 Cookie
3. 在隐私模式下测试
4. 检查系统麦克风权限设置

### Q: 有没有更简单的方法?

A: 最简单的方法是在本机访问时使用 `http://localhost:3355`

---

## 🛠️ 快速修复脚本

我可以帮你自动配置 HTTPS,需要吗?运行:

```bash
# 方案 1: 使用 localhost (最简单)
echo "请在浏览器中访问: http://localhost:3355"

# 方案 2: 设置 Chrome 标志 (手动操作)
echo "打开 Chrome: chrome://flags/#unsafely-treat-insecure-origin-as-secure"
echo "添加: http://192.168.31.196:3355"
```

选择最适合你的方案!
