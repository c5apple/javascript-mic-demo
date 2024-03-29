(function () {
  const start = document.getElementById('start');
  const stop = document.getElementById('stop');
  const speak = document.getElementById('speak');
  const download = document.getElementById('download');
  const audio = document.getElementById('audio');
  const target = document.getElementById('target');

  SpeechRecognition = webkitSpeechRecognition || SpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.lang = 'ja-JP';
  recognition.interimResults = true;  // 途中で結果を得る
  recognition.continuous = true;  // 認識を続ける

  // 音声認識結果
  let finalTranscript = '';

  /**
   * 音声認識イベント
   */
  recognition.onresult = (event) => {
    // console.group();
    // console.log(event.results[0][0].transcript);
    // console.log(event.results[0].isFinal);
    // console.groupEnd();

    let interimTranscript = ''; // 暫定認識結果
    for (let i = event.resultIndex; i < event.results.length; i++) {
      let transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + '<br>';
      } else {
        interimTranscript = transcript;
      }
    }
    target.innerHTML = finalTranscript + '<i style="color:#ccc;">' + interimTranscript + '</i>';
  }

  // audio data
  let audioData = [];
  const bufferSize = 1024;
  let audio_sample_rate = null;
  let localMediaStream = null;

  /**
   * 音声録音イベント
   */
  const handleSuccess = (stream) => {
    localMediaStream = stream;

    const audioContext = new AudioContext();
    audio_sample_rate = audioContext.sampleRate;

    scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
    var mediastreamsource = audioContext.createMediaStreamSource(stream);
    mediastreamsource.connect(scriptProcessor);
    scriptProcessor.onaudioprocess = function (e) {
      var input = e.inputBuffer.getChannelData(0);
      var bufferData = new Float32Array(bufferSize);
      for (var i = 0; i < bufferSize; i++) {
        bufferData[i] = input[i];
      }
      audioData.push(bufferData);
    };
    scriptProcessor.connect(audioContext.destination);
  }

  /**
   * 音声保存
   */
  const saveWAV = () => {
    const audioBlob = exportWAV(audioData);

    let myURL = window.URL || window.webkitURL;
    let url = myURL.createObjectURL(audioBlob);
    console.log(url);

    // ダウンロードリンク
    download.href = url;
    download.download = 'text.wav';
    // オーディオ
    audio.src = url;
  }

  /**
   * WAVに変換し、Blobを返却
   */
  const exportWAV = function (audioData) {

    let encodeWAV = function (samples, sampleRate) {
      let buffer = new ArrayBuffer(44 + samples.length * 2);
      let view = new DataView(buffer);

      let writeString = function (view, offset, string) {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };

      let floatTo16BitPCM = function (output, offset, input) {
        for (let i = 0; i < input.length; i++ , offset += 2) {
          let s = Math.max(-1, Math.min(1, input[i]));
          output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
      };

      writeString(view, 0, 'RIFF');  // RIFFヘッダ
      view.setUint32(4, 32 + samples.length * 2, true); // これ以降のファイルサイズ
      writeString(view, 8, 'WAVE'); // WAVEヘッダ
      writeString(view, 12, 'fmt '); // fmtチャンク
      view.setUint32(16, 16, true); // fmtチャンクのバイト数
      view.setUint16(20, 1, true); // フォーマットID
      view.setUint16(22, 1, true); // チャンネル数
      view.setUint32(24, sampleRate, true); // サンプリングレート
      view.setUint32(28, sampleRate * 2, true); // データ速度
      view.setUint16(32, 2, true); // ブロックサイズ
      view.setUint16(34, 16, true); // サンプルあたりのビット数
      writeString(view, 36, 'data'); // dataチャンク
      view.setUint32(40, samples.length * 2, true); // 波形データのバイト数
      floatTo16BitPCM(view, 44, samples); // 波形データ

      return view;
    };

    let mergeBuffers = function (audioData) {
      let sampleLength = 0;
      for (let i = 0; i < audioData.length; i++) {
        sampleLength += audioData[i].length;
      }
      let samples = new Float32Array(sampleLength);
      let sampleIdx = 0;
      for (let i = 0; i < audioData.length; i++) {
        for (let j = 0; j < audioData[i].length; j++) {
          samples[sampleIdx] = audioData[i][j];
          sampleIdx++;
        }
      }
      return samples;
    };

    let dataview = encodeWAV(mergeBuffers(audioData), audio_sample_rate);
    let audioBlob = new Blob([dataview], { type: 'audio/wav' });
    console.log(dataview);
    return audioBlob;
  }

  /**
   * スタートボタンクリックイベント
   */
  start.onclick = () => {
    // 初期化
    finalTranscript = '';

    // 録音開始
    recognition.start();
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(handleSuccess);

    start.disabled = true;
    stop.disabled = false;
    speak.disabled = true;
  }

  /**
   * ストップボタンクリックイベント
   */
  stop.onclick = () => {
    // 録音停止
    recognition.stop();
    localMediaStream.getTracks().forEach(track => track.stop());
    saveWAV();

    start.disabled = false;
    stop.disabled = true;
    speak.disabled = false;
  }

  /**
   * スピークボタンクリックイベント
   */
  speak.onclick = () => {
    const uttr = new SpeechSynthesisUtterance(finalTranscript);
    // 再生 (発言キューに発言を追加)
    speechSynthesis.speak(uttr);
  }
})();
