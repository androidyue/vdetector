/**
 * 音频录制和数据采集模块
 */

export class AudioRecorder {
    constructor() {
        this.audioContext = null;
        this.mediaStream = null;
        this.mediaStreamSource = null;
        this.analyser = null;
        this.dataArray = null;
        this.isRecording = false;
        this.recordedChunks = [];
    }

    async init() {
        try {
            // 检查浏览器支持
            if (!window.AudioContext && !window.webkitAudioContext) {
                throw new Error('Web Audio API is not supported in this browser');
            }

            // 检查 getUserMedia 支持
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                // 尝试使用旧版 API
                const getUserMedia = navigator.getUserMedia ||
                                   navigator.webkitGetUserMedia ||
                                   navigator.mozGetUserMedia ||
                                   navigator.msGetUserMedia;

                if (!getUserMedia) {
                    throw new Error(
                        'Microphone access is not available. This may be because:\n' +
                        '1. You are accessing via HTTP instead of HTTPS\n' +
                        '2. Your browser does not support microphone access\n' +
                        '3. The site is not accessed from localhost or a secure origin\n\n' +
                        'Solutions:\n' +
                        '- Access via http://localhost:3355 instead of IP address\n' +
                        '- Use HTTPS\n' +
                        '- For Chrome: enable chrome://flags/#unsafely-treat-insecure-origin-as-secure'
                    );
                }

                // 使用旧版 API
                return new Promise((resolve, reject) => {
                    getUserMedia.call(navigator, {
                        audio: {
                            echoCancellation: false,
                            noiseSuppression: false,
                            autoGainControl: false
                        }
                    }, (stream) => {
                        this.setupAudioStream(stream);
                        resolve(true);
                    }, (error) => {
                        reject(new Error('Microphone access denied: ' + error.message));
                    });
                });
            }

            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 22050
                }
            });

            this.setupAudioStream(this.mediaStream);
            console.log('Audio recorder initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize audio recorder:', error);
            throw error;
        }
    }

    setupAudioStream(stream) {
        this.mediaStream = stream;
        this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 2048;
        this.analyser.smoothingTimeConstant = 0.8;

        this.mediaStreamSource.connect(this.analyser);

        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
    }

    getWaveformData() {
        if (!this.analyser) return null;
        this.analyser.getByteTimeDomainData(this.dataArray);
        return this.dataArray;
    }

    getFrequencyData() {
        if (!this.analyser) return null;
        this.analyser.getByteFrequencyData(this.dataArray);
        return this.dataArray;
    }

    async captureAudioSample(duration = 1000) {
        return new Promise((resolve) => {
            const sampleRate = this.audioContext.sampleRate;
            const numSamples = Math.floor(sampleRate * duration / 1000);
            const audioBuffer = this.audioContext.createBuffer(1, numSamples, sampleRate);
            const channelData = audioBuffer.getChannelData(0);

            const scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
            let sampleIndex = 0;

            scriptProcessor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);

                for (let i = 0; i < inputData.length && sampleIndex < numSamples; i++) {
                    channelData[sampleIndex++] = inputData[i];
                }

                if (sampleIndex >= numSamples) {
                    scriptProcessor.disconnect();
                    this.mediaStreamSource.disconnect(scriptProcessor);
                    resolve(channelData);
                }
            };

            this.mediaStreamSource.connect(scriptProcessor);
            scriptProcessor.connect(this.audioContext.destination);
        });
    }

    calculateRMS(audioData) {
        let sum = 0;
        for (let i = 0; i < audioData.length; i++) {
            sum += audioData[i] * audioData[i];
        }
        return Math.sqrt(sum / audioData.length);
    }

    calculateZeroCrossingRate(audioData) {
        let crossings = 0;
        for (let i = 1; i < audioData.length; i++) {
            if ((audioData[i] >= 0 && audioData[i - 1] < 0) ||
                (audioData[i] < 0 && audioData[i - 1] >= 0)) {
                crossings++;
            }
        }
        return crossings / audioData.length;
    }

    calculateSpectralCentroid(frequencyData) {
        let weightedSum = 0;
        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
            weightedSum += i * frequencyData[i];
            sum += frequencyData[i];
        }
        return sum === 0 ? 0 : weightedSum / sum;
    }

    stop() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        this.isRecording = false;
    }

    getSampleRate() {
        return this.audioContext ? this.audioContext.sampleRate : 22050;
    }
}
