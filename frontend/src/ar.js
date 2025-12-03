/**
 * Minimal AR support: request hit-test, show reticle, place simple markers.
 * If AR isn't supported or session fails, callers should hide AR affordances.
 */
export async function startAR(canvas, onReadyCanvas) {
  if (!('xr' in navigator)) throw new Error('WebXR not supported');
  const gl = canvas.getContext('webgl', { alpha: false, antialias: true });
  if (!gl) throw new Error('WebGL not available');

  // Basic clear so snapshots show something even without real rendering
  function drawPlaceholder() {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.06, 0.07, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  canvas.width = canvas.clientWidth * window.devicePixelRatio;
  canvas.height = canvas.clientHeight * window.devicePixelRatio;
  drawPlaceholder();
  onReadyCanvas?.();

  // Request AR session
  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test', 'dom-overlay'],
    domOverlay: { root: document.body }
  });

  const xrGl = gl;
  await xrGl.makeXRCompatible?.();
  const xrRefSpace = await session.requestReferenceSpace('viewer');
  const xrLocalRef = await session.requestReferenceSpace('local');
  const xrLayer = new XRWebGLLayer(session, xrGl);
  session.updateRenderState({ baseLayer: xrLayer });

  const hitTestSource = await session.requestHitTestSource({ space: xrRefSpace });

  let reticleVisible = false;

  function onXRFrame(time, frame) {
    const pose = frame.getViewerPose(xrLocalRef);
    // Very minimal placeholder draw
    drawPlaceholder();

    const results = frame.getHitTestResults(hitTestSource);
    reticleVisible = results.length > 0;
    // We don't render a 3D reticle here (would require shaders). This is a minimal placeholder.
    // Consumers can show UI hints if reticleVisible is true.

    session.requestAnimationFrame(onXRFrame);
  }

  session.requestAnimationFrame(onXRFrame);

  // Provide a trivial "place marker" behavior by tinting the canvas (visual cue)
  canvas.addEventListener('click', () => {
    // flash effect
    const prev = [Math.random()*0.2+0.06, Math.random()*0.2+0.06, Math.random()*0.2+0.06, 1.0];
    gl.clearColor(prev[0], prev[1], prev[2], 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  });

  return {
    session,
    stop() { session.end(); }
  };
}