# 🎤 吹气声分类器 (Blow Sound Classifier)

基于 TensorFlow.js 的实时吹气声检测系统,可在浏览器中完成数据采集、模型训练和实时推理。

## ✨ 特性

- 🎯 **实时音频分类**: 在浏览器中实时检测吹气声
- 🧠 **端到端训练**: 从数据采集到模型训练,全部在浏览器完成
- 📊 **Mel-Spectrogram 特征**: 使用深度学习标准的音频特征提取
- 🔥 **CNN 模型**: 基于卷积神经网络的分类器
- 💾 **本地存储**: 模型保存在浏览器 localStorage,无需服务器
- 📈 **实时可视化**: 波形图、频谱图、训练曲线实时显示

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

### 3. 打开浏览器

访问 `http://localhost:5173` (或控制台显示的地址)

## 📖 使用指南

### 第一步: 数据采集

1. **选择标签**: 选择"吹气声"或"非吹气声"
2. **开始录制**: 点击"开始录制"按钮
3. **制造声音**:
   - **吹气声样本**: 对着麦克风吹气 (强度、距离、角度多变)
   - **非吹气声样本**: 说话、播放音乐、敲击、环境噪音等
4. **收集足够样本**: 每类建议收集 **20-50 个样本** (每个样本 1 秒)
5. **停止录制**: 点击"停止录制"

**数据采集建议**:
- 吹气声: 尝试不同强度 (轻吹、重吹)、距离 (近距离、远距离)、角度
- 非吹气声: 多样化噪音源 (键盘声、说话声、背景音乐、脚步声等)
- 样本数量: 每类至少 20 个,越多越好 (50+ 推荐)

### 第二步: 训练模型

1. **设置参数**:
   - 训练轮数: 50-100 (默认 50)
   - 批次大小: 16-32 (默认 32)
2. **开始训练**: 点击"开始训练"按钮
3. **观察训练**: 查看准确率和损失曲线
4. **等待完成**: 训练完成后会显示最终准确率
5. **保存模型**: 点击"保存模型"保存到浏览器

**训练建议**:
- 验证准确率 > 90% 为佳
- 如果准确率低,增加样本数量或训练轮数
- 观察训练曲线,避免过拟合

### 第三步: 实时推理

1. **加载模型**: 点击"加载模型"(如果刚训练完,已自动加载)
2. **开始检测**: 点击"开始检测"
3. **测试效果**: 对着麦克风吹气,观察分类结果
4. **查看置信度**: 实时显示吹气声/非吹气声的概率

## 🏗️ 项目结构

```
ml_voice_detection/
├── index.html              # 主页面
├── style.css               # 样式文件
├── main.js                 # 主应用逻辑
├── audioRecorder.js        # 音频录制模块
├── featureExtractor.js     # 特征提取 (Mel-Spectrogram)
├── modelTrainer.js         # 模型训练和推理
├── package.json            # 项目配置
└── README.md               # 使用说明
```

## 🧪 技术架构

### 音频特征提取

- **采样率**: 22050 Hz
- **FFT 大小**: 2048
- **Mel 频带数**: 128
- **帧数**: 32 (固定)
- **特征格式**: [32, 128] Mel-Spectrogram

### 模型架构

```
Input: [batch, 32, 128, 1]
    ↓
Conv2D (32 filters, 3x3) → ReLU → MaxPooling2D (2x2)
    ↓
Conv2D (64 filters, 3x3) → ReLU → MaxPooling2D (2x2)
    ↓
Conv2D (128 filters, 3x3) → ReLU → GlobalAveragePooling2D
    ↓
Dropout (0.5) → Dense (64) → ReLU → Dropout (0.3)
    ↓
Dense (2, softmax) → Output: [blow, not_blow]
```

### 依赖库

- **TensorFlow.js**: 深度学习框架
- **Meyda**: 音频特征提取库
- **Vite**: 开发服务器和构建工具

## 📊 性能优化建议

### 数据采集阶段

1. **多样化样本**:
   - 不同环境 (安静房间、嘈杂环境)
   - 不同设备 (不同麦克风)
   - 不同时间段

2. **数据平衡**:
   - 两类样本数量保持接近
   - 避免数据偏斜

### 训练阶段

1. **超参数调优**:
   - 学习率: 0.001 (默认)
   - Batch Size: 根据样本数量调整
   - Epochs: 观察收敛情况

2. **避免过拟合**:
   - 使用 Dropout
   - 观察验证损失
   - 增加训练数据

### 推理阶段

1. **实时性能**:
   - 推理间隔: 500ms (可调整)
   - GPU 加速: TensorFlow.js 自动使用 WebGL

2. **准确性调优**:
   - 使用滑动窗口平均
   - 设置置信度阈值

## 🔧 高级配置

### 修改特征提取参数

编辑 `featureExtractor.js`:

```javascript
constructor(sampleRate = 22050) {
    this.fftSize = 2048;      // FFT 窗口大小
    this.hopLength = 512;     // 帧移
    this.nMels = 128;         // Mel 频带数
    this.nFrames = 32;        // 固定帧数
}
```

### 修改模型架构

编辑 `modelTrainer.js` 中的 `createModel()` 方法,调整卷积层、全连接层等。

### 修改推理间隔

编辑 `main.js` 中的 `startInference()`:

```javascript
this.inferenceInterval = setInterval(async () => {
    // ...
}, 500);  // 改为你想要的间隔 (毫秒)
```

## 🐛 常见问题

### 麦克风权限问题

**问题**: 浏览器提示麦克风权限被拒绝

**解决**:
1. 检查浏览器麦克风权限设置
2. 使用 HTTPS 或 localhost
3. 重新加载页面并允许权限

### 训练准确率低

**问题**: 验证准确率低于 80%

**解决**:
1. 增加训练样本 (每类 50+ 样本)
2. 提高样本质量 (清晰、多样化)
3. 增加训练轮数
4. 检查数据是否平衡

### 实时推理延迟

**问题**: 推理结果更新缓慢

**解决**:
1. 减少推理间隔 (但会增加 CPU 使用)
2. 检查浏览器性能
3. 关闭其他占用资源的标签页

### 模型无法保存

**问题**: 保存模型时出错

**解决**:
1. 检查浏览器是否支持 localStorage
2. 清理浏览器存储空间
3. 尝试使用隐私模式以外的窗口

## 📝 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📚 参考资料

- [TensorFlow.js 官方文档](https://www.tensorflow.org/js)
- [Meyda 音频特征库](https://meyda.js.org/)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Mel-Spectrogram 原理](https://en.wikipedia.org/wiki/Mel-frequency_cepstrum)

---

**Happy Detecting! 🎉**
