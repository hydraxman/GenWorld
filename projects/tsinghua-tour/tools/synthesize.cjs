// Optional regeneration only. Normal map rendering reuses the frozen audio.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {parseArgs} = require('node:util');
const root = path.resolve(__dirname, '..');
const voice = 'zh-CN-XiaoxiaoNeural';
const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex');
const escapeXml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

async function waitForWav(file, duration) {
  const expected = 44 + Math.round(duration / 1e7 * 48000) * 2;
  for (let i = 0; i < 200; i++) {
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file);
      if (data.length === expected && data.toString('ascii', 0, 4) === 'RIFF' &&
          data.readUInt32LE(4) === data.length - 8 && data.toString('ascii', 36, 40) === 'data' &&
          data.readUInt32LE(40) === data.length - 44) return;
    }
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error('WAV writer did not finish within the bounded wait');
}

async function main() {
  const {values} = parseArgs({options: {synthesize: {type: 'boolean', default: false}, output: {type: 'string', default: 'output/new-audio'}}});
  if (!values.synthesize) {
    console.log(JSON.stringify({action: 'reuse', voice, manifest: 'audio/manifest.json', segments: 15, paid_api_called: false}));
    return;
  }
  if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
    throw new Error('Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION before explicit synthesis');
  }
  const out = path.resolve(root, values.output);
  const relative = path.relative(root, out);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) ||
      relative === 'audio' || relative.startsWith('audio' + path.sep)) {
    throw new Error('Use a fresh output directory inside the project, not the approved audio directory');
  }
  if (fs.existsSync(out) && fs.readdirSync(out).length) throw new Error('Output is not empty; choose a fresh directory');
  const sdk = require('microsoft-cognitiveservices-speech-sdk');
  const texts = JSON.parse(fs.readFileSync(path.join(root, 'narration.json'), 'utf8'));
  const styles = JSON.parse(fs.readFileSync(path.join(root, 'voice-supported-styles.json'), 'utf8')).StyleList;
  if (texts.some(item => !/^[a-z0-9_-]+$/.test(item.id) || !styles.includes(item.style))) throw new Error('Invalid narration id/style');
  fs.mkdirSync(out, {recursive: true});
  const manifest = [];
  for (const item of texts) {
    const body = item.ssml_body || escapeXml(item.text).replace(/。/g, '。<break time="350ms"/>');
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="zh-CN"><voice name="${voice}"><mstts:express-as style="${escapeXml(item.style)}" styledegree="${escapeXml(item.styledegree || 1)}"><prosody rate="${escapeXml(item.rate || '0%')}" pitch="${escapeXml(item.pitch || '0%')}">${body}</prosody></mstts:express-as></voice></speak>`;
    const file = path.join(out, item.id + '.wav');
    const temp = file + '.part';
    fs.writeFileSync(path.join(out, item.id + '.ssml'), ssml);
    const config = sdk.SpeechConfig.fromSubscription(process.env.AZURE_SPEECH_KEY, process.env.AZURE_SPEECH_REGION);
    config.speechSynthesisVoiceName = voice;
    config.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff48Khz16BitMonoPcm;
    const synth = new sdk.SpeechSynthesizer(config, sdk.AudioConfig.fromAudioFileOutput(temp));
    const boundaries = [];
    synth.wordBoundary = (_, e) => boundaries.push({audioOffset: e.audioOffset, duration: e.duration, text: e.text, textOffset: e.textOffset, wordLength: e.wordLength, boundaryType: e.boundaryType});
    let result;
    try {
      result = await new Promise((resolve, reject) => synth.speakSsmlAsync(ssml, resolve, reject));
    } finally { synth.close(); }
    if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) throw new Error(`Synthesis did not complete: ${item.id}`);
    await waitForWav(temp, result.audioDuration);
    fs.renameSync(temp, file);
    const record = {...item, voice, file: path.relative(root, file).split(path.sep).join('/'), ssml_sha256: sha(ssml), sha256: sha(fs.readFileSync(file)), duration_seconds: result.audioDuration / 1e7, boundaries};
    fs.writeFileSync(path.join(out, item.id + '.json'), JSON.stringify(record, null, 2));
    manifest.push(record);
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log(JSON.stringify({id: item.id, duration_seconds: record.duration_seconds, voice}));
  }
}
main().catch(() => { console.error('Synthesis failed. Check required environment, source text, output directory, and Azure availability; no credentials were logged.'); process.exitCode = 1; });
