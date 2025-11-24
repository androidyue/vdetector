/**
 * 主应用程序 - 整合所有模块
 */

import { AudioRecorder } from './audioRecorder.js';
import { FeatureExtractor } from './featureExtractor.js';
import { ModelTrainer } from './modelTrainer.js';

class BlowClassifierApp {
    constructor() {
        this.audioRecorder = null;
        this.featureExtractor = null;
        this.modelTrainer = null;
        this.isRecording = false;
        this.isInferencing = false;
        this.recordingInterval = null;
        this.inferenceInterval = null;
        this.trainingHistory = { loss: [], accuracy: [], val_loss: [], val_accuracy: [] };

        this.initUI();
    }

    initUI() {
        // 数据采集控件
        this.startRecordBtn = document.getElementById('start-record');
        this.stopRecordBtn = document.getElementById('stop-record');
        this.clearDataBtn = document.getElementById('clear-data');
        this.blowCountEl = document.getElementById('blow-count');
        this.notBlowCountEl = document.getElementById('not-blow-count');
        this.waveformCanvas = document.getElementById('waveform-canvas');

        // 训练控件
        this.trainModelBtn = document.getElementById('train-model');
        this.saveModelBtn = document.getElementById('save-model');
        this.epochsInput = document.getElementById('epochs');
        this.batchSizeInput = document.getElementById('batch-size');
        this.trainingStatus = document.getElementById('training-status');
        this.accuracyEl = document.getElementById('accuracy');
        this.lossEl = document.getElementById('loss');
        this.trainingChart = document.getElementById('training-chart');

        // 推理控件
        this.loadModelBtn = document.getElementById('load-model');
        this.startInferenceBtn = document.getElementById('start-inference');
        this.stopInferenceBtn = document.getElementById('stop-inference');
        this.predictionLabel = document.getElementById('prediction-label');
        this.blowConfidence = document.getElementById('blow-confidence');
        this.notBlowConfidence = document.getElementById('not-blow-confidence');
        this.blowPercent = document.getElementById('blow-percent');
        this.notBlowPercent = document.getElementById('not-blow-percent');
        this.spectrogramCanvas = document.getElementById('spectrogram-canvas');

        this.bindEvents();
    }

    bindEvents() {
        this.startRecordBtn.addEventListener('click', () => this.startRecording());
        this.stopRecordBtn.addEventListener('click', () => this.stopRecording());
        this.clearDataBtn.addEventListener('click', () => this.clearData());
        this.trainModelBtn.addEventListener('click', () => this.trainModel());
        this.saveModelBtn.addEventListener('click', () => this.saveModel());
        this.loadModelBtn.addEventListener('click', () => this.loadModel());
        this.startInferenceBtn.addEventListener('click', () => this.startInference());
        this.stopInferenceBtn.addEventListener('click', () => this.stopInference());
    }

    async init() {
        try {
            this.log('Initializing audio recorder...');
            this.audioRecorder = new AudioRecorder();
            await this.audioRecorder.init();

            const sampleRate = this.audioRecorder.getSampleRate();
            this.featureExtractor = new FeatureExtractor(sampleRate);
            this.modelTrainer = new ModelTrainer(this.featureExtractor);

            this.log('Application initialized successfully!');
            this.updateSampleCounts();

        } catch (error) {
            this.log(`Error: ${error.message}`, true);
            alert('Failed to initialize audio. Please allow microphone access.');
            throw error;
        }
    }

    initWithoutAudio() {
        // 初始化不需要麦克风的功能
        const sampleRate = 22050; // 默认采样率
        this.featureExtractor = new FeatureExtractor(sampleRate);
        this.modelTrainer = new ModelTrainer(this.featureExtractor);
        this.updateSampleCounts();
        this.log('Application ready. Click "Start Recording" or "Start Detection" to request microphone access.');

        // 检查是否支持麦克风
        this.checkMicrophoneSupport();
    }

    checkMicrophoneSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            // 显示警告横幅
            const warningBanner = document.getElementById('security-warning');
            if (warningBanner) {
                warningBanner.style.display = 'block';
            }
            this.log('⚠️ WARNING: Microphone access is not available in this context.', true);
            this.log('Please access via http://localhost:3355 or configure your browser.', true);
        }
    }

    async startRecording() {
        if (!this.audioRecorder) {
            await this.init();
        }

        this.isRecording = true;
        this.startRecordBtn.disabled = true;
        this.stopRecordBtn.disabled = false;

        const label = document.querySelector('input[name="label"]:checked').value;
        this.log(`Recording ${label} samples...`);

        // 定期采集样本
        this.recordingInterval = setInterval(async () => {
            try {
                const audioData = await this.audioRecorder.captureAudioSample(1000);
                const success = this.modelTrainer.addSample(audioData, label);

                if (success) {
                    this.updateSampleCounts();
                    this.drawWaveform(audioData);
                }
            } catch (error) {
                console.error('Recording error:', error);
            }
        }, 1000);
    }

    stopRecording() {
        this.isRecording = false;
        this.startRecordBtn.disabled = false;
        this.stopRecordBtn.disabled = true;

        if (this.recordingInterval) {
            clearInterval(this.recordingInterval);
            this.recordingInterval = null;
        }

        this.log('Recording stopped');
    }

    clearData() {
        if (confirm('Are you sure you want to clear all collected data?')) {
            this.modelTrainer.clearData();
            this.updateSampleCounts();
            this.log('All data cleared');
        }
    }

    updateSampleCounts() {
        const counts = this.modelTrainer.getSampleCounts();
        this.blowCountEl.textContent = counts.blow;
        this.notBlowCountEl.textContent = counts.not_blow;
    }

    drawWaveform(audioData) {
        const canvas = this.waveformCanvas;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.beginPath();

        const sliceWidth = width / audioData.length;
        let x = 0;

        for (let i = 0; i < audioData.length; i++) {
            const v = audioData[i];
            const y = (v + 1) * height / 2;

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        ctx.stroke();
    }

    async trainModel() {
        const counts = this.modelTrainer.getSampleCounts();

        if (counts.blow < 10 || counts.not_blow < 10) {
            alert('Please collect at least 10 samples for each class');
            return;
        }

        this.trainModelBtn.disabled = true;
        this.saveModelBtn.disabled = true;
        this.trainingHistory = { loss: [], accuracy: [], val_loss: [], val_accuracy: [] };

        const epochs = parseInt(this.epochsInput.value);
        const batchSize = parseInt(this.batchSizeInput.value);

        this.log(`Training model: ${epochs} epochs, batch size ${batchSize}...`);

        try {
            await this.modelTrainer.train(epochs, batchSize, {
                onEpochEnd: (epoch, logs) => {
                    this.trainingHistory.loss.push(logs.loss);
                    this.trainingHistory.accuracy.push(logs.acc);
                    this.trainingHistory.val_loss.push(logs.val_loss);
                    this.trainingHistory.val_accuracy.push(logs.val_acc);

                    this.accuracyEl.textContent = `${(logs.val_acc * 100).toFixed(2)}%`;
                    this.lossEl.textContent = logs.val_loss.toFixed(4);

                    this.log(
                        `Epoch ${epoch + 1}/${epochs} - ` +
                        `loss: ${logs.loss.toFixed(4)}, ` +
                        `acc: ${(logs.acc * 100).toFixed(2)}%, ` +
                        `val_loss: ${logs.val_loss.toFixed(4)}, ` +
                        `val_acc: ${(logs.val_acc * 100).toFixed(2)}%`
                    );

                    this.drawTrainingChart();
                },
                onTrainEnd: () => {
                    this.log('Training completed!');
                    this.trainModelBtn.disabled = false;
                    this.saveModelBtn.disabled = false;
                    this.startInferenceBtn.disabled = false;
                }
            });

        } catch (error) {
            this.log(`Training error: ${error.message}`, true);
            this.trainModelBtn.disabled = false;
        }
    }

    drawTrainingChart() {
        const canvas = this.trainingChart;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        const { loss, val_loss, accuracy, val_accuracy } = this.trainingHistory;
        if (loss.length === 0) return;

        const maxEpochs = loss.length;
        const padding = 40;
        const chartWidth = width - 2 * padding;
        const chartHeight = height - 2 * padding;

        // 绘制坐标轴
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();

        // 绘制准确率曲线
        this.drawLine(ctx, accuracy, '#28a745', padding, chartWidth, chartHeight, maxEpochs);
        this.drawLine(ctx, val_accuracy, '#20c997', padding, chartWidth, chartHeight, maxEpochs);

        // 添加图例
        ctx.font = '12px monospace';
        ctx.fillStyle = '#28a745';
        ctx.fillText('Train Accuracy', padding + 10, padding + 20);
        ctx.fillStyle = '#20c997';
        ctx.fillText('Val Accuracy', padding + 10, padding + 35);
    }

    drawLine(ctx, data, color, padding, chartWidth, chartHeight, maxEpochs) {
        if (data.length === 0) return;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        const xStep = chartWidth / (maxEpochs - 1 || 1);

        for (let i = 0; i < data.length; i++) {
            const x = padding + i * xStep;
            const y = padding + chartHeight - (data[i] * chartHeight);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
    }

    async saveModel() {
        try {
            await this.modelTrainer.saveModel('blow-classifier');
            this.log('Model saved successfully!');
            alert('Model saved to browser storage');
        } catch (error) {
            this.log(`Save error: ${error.message}`, true);
        }
    }

    async loadModel() {
        try {
            this.log('Loading model...');
            const success = await this.modelTrainer.loadModel('blow-classifier');

            if (success) {
                this.log('Model loaded successfully!');
                this.startInferenceBtn.disabled = false;
                this.saveModelBtn.disabled = false;
            } else {
                this.log('No saved model found', true);
                alert('No saved model found. Please train a model first.');
            }
        } catch (error) {
            this.log(`Load error: ${error.message}`, true);
        }
    }

    async startInference() {
        if (!this.audioRecorder) {
            await this.init();
        }

        this.isInferencing = true;
        this.startInferenceBtn.disabled = true;
        this.stopInferenceBtn.disabled = false;
        this.log('Real-time inference started...');

        this.inferenceInterval = setInterval(async () => {
            try {
                const audioData = await this.audioRecorder.captureAudioSample(1000);
                const prediction = await this.modelTrainer.predict(audioData);

                if (prediction) {
                    this.updatePrediction(prediction);

                    // 可视化频谱
                    const features = this.featureExtractor.extractFeatures(audioData);
                    if (features) {
                        this.featureExtractor.drawSpectrogram(this.spectrogramCanvas, features);
                    }
                }
            } catch (error) {
                console.error('Inference error:', error);
            }
        }, 500);
    }

    stopInference() {
        this.isInferencing = false;
        this.startInferenceBtn.disabled = false;
        this.stopInferenceBtn.disabled = true;

        if (this.inferenceInterval) {
            clearInterval(this.inferenceInterval);
            this.inferenceInterval = null;
        }

        this.log('Inference stopped');
    }

    updatePrediction(prediction) {
        const { blow, not_blow, label } = prediction;

        // 更新标签
        this.predictionLabel.textContent = label === 'blow' ? '吹气声检测到!' : '非吹气声';
        this.predictionLabel.className = `result-label ${label}`;

        // 更新置信度条
        this.blowConfidence.style.width = `${blow * 100}%`;
        this.notBlowConfidence.style.width = `${not_blow * 100}%`;
        this.blowPercent.textContent = `${(blow * 100).toFixed(1)}%`;
        this.notBlowPercent.textContent = `${(not_blow * 100).toFixed(1)}%`;
    }

    log(message, isError = false) {
        const timestamp = new Date().toLocaleTimeString();
        const prefix = isError ? '[ERROR]' : '[INFO]';
        const text = `${timestamp} ${prefix} ${message}\n`;

        if (this.trainingStatus) {
            this.trainingStatus.textContent += text;
            this.trainingStatus.scrollTop = this.trainingStatus.scrollHeight;
        }

        console.log(message);
    }
}

// 启动应用
const app = new BlowClassifierApp();
window.addEventListener('load', () => {
    app.initWithoutAudio();
});
