import { scenes } from './scenes.js';

const scene = scenes.find(item => item.id === new URLSearchParams(location.search).get('scene'));
const status = document.getElementById('preview-status');
if (!scene) {
  document.title = '未找到场景 · GenWorld';
  status.setAttribute('role', 'alert');
  status.textContent = '未找到这个场景。请使用上方导航选择场景，或返回首页。';
} else {
  document.title = `${scene.title} · GenWorld`;
  document.querySelector(`[data-scene="${scene.id}"]`).setAttribute('aria-current', 'page');
  document.getElementById('scene-caption').textContent = `${scene.title} / ${scene.detail}`;
  const direct = document.getElementById('direct-link');
  direct.href = scene.source;
  direct.hidden = false;
  const frame = document.getElementById('scene-frame');
  frame.title = `${scene.title} · 交互式三维预览`;
  frame.addEventListener('load', () => {
    if (!frame.contentDocument?.querySelector('canvas')) {
      status.setAttribute('role', 'alert');
      status.textContent = '场景页面未能载入。请重新打开场景，或使用底部的独立打开链接。';
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => {
      const engine = frame.contentWindow;
      const error = engine.__sceneError || engine.__publicAssetsError || engine.campusError;
      const ready = engine.__sceneReady || engine.campusApp?.ready
        || (engine.__knowledgeReady && engine.__publicAssetsReady);
      if (ready) status.hidden = true;
      else if (error || Date.now() - started > 90000) {
        status.setAttribute('role', 'alert');
        status.textContent = error
          ? '三维场景初始化失败。请确认浏览器支持 WebGL，或独立打开场景查看提示。'
          : '三维场景载入超时。请检查网络与浏览器的图形加速，或独立打开重试。';
      } else return;
      clearInterval(timer);
    }, 250);
    window.addEventListener('pagehide', () => clearInterval(timer), { once: true });
  }, { once: true });
  frame.src = scene.source;
  frame.hidden = false;
}
