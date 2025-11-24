/**
 * 特征提取模块 - Mel-Spectrogram 和其他音频特征
 */

import Meyda from 'meyda';

export class FeatureExtractor {
    constructor(sampleRate = 22050) {
        this.sampleRate = sampleRate;
        this.fftSize = 2048;
        this.hopLength = 512;
        this.nMels = 128;
        this.nFrames = 32; // 固定帧数
    }

    /**
     * 提取 Mel-Spectrogram
     */
    extractMelSpectrogram(audioData) {
        const frames = [];
        const step = this.hopLength;

        // 分帧处理
        for (let i = 0; i + this.fftSize <= audioData.length; i += step) {
            const frame = audioData.slice(i, i + this.fftSize);
            frames.push(frame);
        }

        // 确保有足够的帧
        if (frames.length === 0) {
            return null;
        }

        // 对每一帧提取 Mel 频谱
        const melSpectrograms = frames.map(frame => {
            const melBands = Meyda.extract('melBands', frame, {
                sampleRate: this.sampleRate,
                bufferSize: this.fftSize,
                numberOfMelBands: this.nMels
            });
            return melBands || new Array(this.nMels).fill(0);
        });

        // 标准化到固定帧数
        const normalized = this.normalizeFrames(melSpectrograms, this.nFrames);

        return normalized;
    }

    /**
     * 标准化帧数 - 通过插值或截断
     */
    normalizeFrames(frames, targetFrames) {
        if (frames.length === targetFrames) {
            return frames;
        }

        if (frames.length > targetFrames) {
            // 均匀采样
            const result = [];
            const step = frames.length / targetFrames;
            for (let i = 0; i < targetFrames; i++) {
                const idx = Math.floor(i * step);
                result.push(frames[idx]);
            }
            return result;
        } else {
            // 重复填充
            const result = [...frames];
            while (result.length < targetFrames) {
                const fillFrames = frames.slice(0, targetFrames - result.length);
                result.push(...fillFrames);
            }
            return result;
        }
    }

    /**
     * 提取 MFCC 特征
     */
    extractMFCC(audioData) {
        const mfccs = [];
        const step = this.hopLength;

        for (let i = 0; i + this.fftSize <= audioData.length; i += step) {
            const frame = audioData.slice(i, i + this.fftSize);
            const mfcc = Meyda.extract('mfcc', frame, {
                sampleRate: this.sampleRate,
                bufferSize: this.fftSize,
                numberOfMFCCCoefficients: 13
            });
            mfccs.push(mfcc || new Array(13).fill(0));
        }

        return this.normalizeFrames(mfccs, this.nFrames);
    }

    /**
     * 提取统计特征
     */
    extractStatisticalFeatures(audioData) {
        const features = Meyda.extract([
            'rms',
            'zcr',
            'energy',
            'spectralCentroid',
            'spectralFlatness',
            'spectralRolloff',
            'spectralKurtosis',
            'spectralSkewness'
        ], audioData, {
            sampleRate: this.sampleRate,
            bufferSize: this.fftSize
        });

        return [
            features.rms || 0,
            features.zcr || 0,
            features.energy || 0,
            features.spectralCentroid || 0,
            features.spectralFlatness || 0,
            features.spectralRolloff || 0,
            features.spectralKurtosis || 0,
            features.spectralSkewness || 0
        ];
    }

    /**
     * 提取完整特征向量
     * 返回格式: [nFrames, nMels]
     */
    extractFeatures(audioData) {
        const melSpec = this.extractMelSpectrogram(audioData);

        if (!melSpec) {
            return null;
        }

        // 转换为 2D 数组并归一化
        const normalized = this.normalizeSpectrogram(melSpec);

        return normalized;
    }

    /**
     * 归一化 Spectrogram (对数刻度 + 标准化)
     */
    normalizeSpectrogram(spectrogram) {
        // 转换为对数刻度
        const logSpec = spectrogram.map(frame =>
            frame.map(val => Math.log(Math.max(val, 1e-10)))
        );

        // 计算全局均值和标准差
        let sum = 0;
        let count = 0;
        logSpec.forEach(frame => {
            frame.forEach(val => {
                sum += val;
                count++;
            });
        });
        const mean = sum / count;

        let variance = 0;
        logSpec.forEach(frame => {
            frame.forEach(val => {
                variance += Math.pow(val - mean, 2);
            });
        });
        const std = Math.sqrt(variance / count);

        // 标准化
        const normalized = logSpec.map(frame =>
            frame.map(val => (val - mean) / (std + 1e-8))
        );

        return normalized;
    }

    /**
     * 将特征转换为 TensorFlow.js 可用的格式
     */
    featuresToTensor(features) {
        // features: [nFrames, nMels]
        // 返回: [1, nFrames, nMels, 1] for CNN
        const flat = [];
        features.forEach(frame => {
            frame.forEach(val => flat.push(val));
        });
        return flat;
    }

    /**
     * 可视化 Mel-Spectrogram
     */
    drawSpectrogram(canvas, spectrogram) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        if (!spectrogram || spectrogram.length === 0) {
            return;
        }

        const nFrames = spectrogram.length;
        const nMels = spectrogram[0].length;
        const cellWidth = width / nFrames;
        const cellHeight = height / nMels;

        // 找到最大最小值用于颜色映射
        let min = Infinity;
        let max = -Infinity;
        spectrogram.forEach(frame => {
            frame.forEach(val => {
                min = Math.min(min, val);
                max = Math.max(max, val);
            });
        });

        // 绘制
        for (let i = 0; i < nFrames; i++) {
            for (let j = 0; j < nMels; j++) {
                const value = spectrogram[i][j];
                const normalized = (value - min) / (max - min + 1e-8);
                const intensity = Math.floor(normalized * 255);

                // 使用热力图配色
                const color = this.valueToColor(normalized);
                ctx.fillStyle = color;
                ctx.fillRect(
                    i * cellWidth,
                    height - (j + 1) * cellHeight, // 翻转Y轴
                    cellWidth + 1,
                    cellHeight + 1
                );
            }
        }

        // 添加标签
        ctx.fillStyle = 'white';
        ctx.font = '12px monospace';
        ctx.fillText(`Frames: ${nFrames}`, 10, 20);
        ctx.fillText(`Mel Bins: ${nMels}`, 10, 35);
    }

    /**
     * 值到颜色的映射 (热力图)
     */
    valueToColor(value) {
        value = Math.max(0, Math.min(1, value));

        // 蓝 -> 青 -> 绿 -> 黄 -> 红
        let r, g, b;
        if (value < 0.25) {
            r = 0;
            g = Math.floor(value * 4 * 255);
            b = 255;
        } else if (value < 0.5) {
            r = 0;
            g = 255;
            b = Math.floor((0.5 - value) * 4 * 255);
        } else if (value < 0.75) {
            r = Math.floor((value - 0.5) * 4 * 255);
            g = 255;
            b = 0;
        } else {
            r = 255;
            g = Math.floor((1 - value) * 4 * 255);
            b = 0;
        }

        return `rgb(${r}, ${g}, ${b})`;
    }
}
