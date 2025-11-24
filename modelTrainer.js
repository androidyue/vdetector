/**
 * 模型训练模块
 */

import * as tf from '@tensorflow/tfjs';

export class ModelTrainer {
    constructor(featureExtractor) {
        this.featureExtractor = featureExtractor;
        this.model = null;
        this.trainingData = { blow: [], not_blow: [] };
        this.isTraining = false;
    }

    /**
     * 添加训练样本
     */
    addSample(audioData, label) {
        const features = this.featureExtractor.extractFeatures(audioData);
        if (features && features.length > 0) {
            this.trainingData[label].push(features);
            console.log(`Added ${label} sample. Total: ${this.trainingData[label].length}`);
            return true;
        }
        return false;
    }

    /**
     * 获取样本数量
     */
    getSampleCounts() {
        return {
            blow: this.trainingData.blow.length,
            not_blow: this.trainingData.not_blow.length,
            total: this.trainingData.blow.length + this.trainingData.not_blow.length
        };
    }

    /**
     * 清空训练数据
     */
    clearData() {
        this.trainingData = { blow: [], not_blow: [] };
    }

    /**
     * 创建 CNN 模型
     */
    createModel() {
        const nFrames = this.featureExtractor.nFrames;
        const nMels = this.featureExtractor.nMels;

        const model = tf.sequential();

        // Input: [batch, nFrames, nMels, 1]
        model.add(tf.layers.conv2d({
            inputShape: [nFrames, nMels, 1],
            filters: 32,
            kernelSize: [3, 3],
            activation: 'relu',
            padding: 'same'
        }));

        model.add(tf.layers.maxPooling2d({
            poolSize: [2, 2]
        }));

        model.add(tf.layers.conv2d({
            filters: 64,
            kernelSize: [3, 3],
            activation: 'relu',
            padding: 'same'
        }));

        model.add(tf.layers.maxPooling2d({
            poolSize: [2, 2]
        }));

        model.add(tf.layers.conv2d({
            filters: 128,
            kernelSize: [3, 3],
            activation: 'relu',
            padding: 'same'
        }));

        model.add(tf.layers.globalAveragePooling2d());

        model.add(tf.layers.dropout({ rate: 0.5 }));

        model.add(tf.layers.dense({
            units: 64,
            activation: 'relu'
        }));

        model.add(tf.layers.dropout({ rate: 0.3 }));

        // 二分类输出
        model.add(tf.layers.dense({
            units: 2,
            activation: 'softmax'
        }));

        model.compile({
            optimizer: tf.train.adam(0.001),
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });

        console.log('Model created:');
        model.summary();

        this.model = model;
        return model;
    }

    /**
     * 准备训练数据
     */
    prepareTrainingData() {
        const { blow, not_blow } = this.trainingData;

        if (blow.length === 0 || not_blow.length === 0) {
            throw new Error('Need both blow and not_blow samples');
        }

        // 创建特征和标签数组
        const features = [];
        const labels = [];

        // 吹气声 - 标签 [1, 0]
        blow.forEach(spec => {
            features.push(spec);
            labels.push([1, 0]);
        });

        // 非吹气声 - 标签 [0, 1]
        not_blow.forEach(spec => {
            features.push(spec);
            labels.push([0, 1]);
        });

        // 打乱数据
        const indices = Array.from({ length: features.length }, (_, i) => i);
        this.shuffleArray(indices);

        const shuffledFeatures = indices.map(i => features[i]);
        const shuffledLabels = indices.map(i => labels[i]);

        // 转换为 Tensor
        const nFrames = this.featureExtractor.nFrames;
        const nMels = this.featureExtractor.nMels;

        const xs = tf.tensor4d(
            shuffledFeatures,
            [shuffledFeatures.length, nFrames, nMels, 1]
        );

        const ys = tf.tensor2d(shuffledLabels);

        return { xs, ys };
    }

    /**
     * Fisher-Yates 洗牌算法
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    /**
     * 训练模型
     */
    async train(epochs = 50, batchSize = 32, callbacks = {}) {
        if (this.isTraining) {
            throw new Error('Training already in progress');
        }

        this.isTraining = true;

        try {
            // 准备数据
            const { xs, ys } = this.prepareTrainingData();

            console.log('Training data shape:', xs.shape);
            console.log('Labels shape:', ys.shape);

            // 创建模型
            if (!this.model) {
                this.createModel();
            }

            // 训练
            const history = await this.model.fit(xs, ys, {
                epochs,
                batchSize,
                validationSplit: 0.2,
                shuffle: true,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        console.log(`Epoch ${epoch + 1}/${epochs}:`, logs);
                        if (callbacks.onEpochEnd) {
                            callbacks.onEpochEnd(epoch, logs);
                        }
                    },
                    onTrainEnd: () => {
                        console.log('Training completed');
                        if (callbacks.onTrainEnd) {
                            callbacks.onTrainEnd();
                        }
                    }
                }
            });

            // 清理内存
            xs.dispose();
            ys.dispose();

            this.isTraining = false;
            return history;

        } catch (error) {
            this.isTraining = false;
            throw error;
        }
    }

    /**
     * 预测
     */
    async predict(audioData) {
        if (!this.model) {
            throw new Error('Model not trained or loaded');
        }

        const features = this.featureExtractor.extractFeatures(audioData);
        if (!features) {
            return null;
        }

        const nFrames = this.featureExtractor.nFrames;
        const nMels = this.featureExtractor.nMels;

        // 转换为 Tensor
        const input = tf.tensor4d([features], [1, nFrames, nMels, 1]);

        // 预测
        const prediction = this.model.predict(input);
        const probabilities = await prediction.data();

        // 清理
        input.dispose();
        prediction.dispose();

        return {
            blow: probabilities[0],
            not_blow: probabilities[1],
            label: probabilities[0] > probabilities[1] ? 'blow' : 'not_blow'
        };
    }

    /**
     * 保存模型
     */
    async saveModel(name = 'blow-classifier') {
        if (!this.model) {
            throw new Error('No model to save');
        }

        await this.model.save(`localstorage://${name}`);
        console.log(`Model saved as ${name}`);
    }

    /**
     * 加载模型
     */
    async loadModel(name = 'blow-classifier') {
        try {
            this.model = await tf.loadLayersModel(`localstorage://${name}`);
            console.log(`Model loaded from ${name}`);
            this.model.summary();
            return true;
        } catch (error) {
            console.error('Failed to load model:', error);
            return false;
        }
    }

    /**
     * 获取模型摘要
     */
    getModelSummary() {
        if (!this.model) {
            return null;
        }

        return {
            layers: this.model.layers.length,
            trainable: this.model.trainableParams,
            nonTrainable: this.model.nonTrainableParams
        };
    }
}
