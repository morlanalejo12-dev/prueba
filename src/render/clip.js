// Graba un clip corto del colapso (desde el anuncio de la bifurcación hasta un momento después)
// para compartirlo. Usa MediaRecorder sobre el canvas; si el navegador no puede, no hace nada.
export class ClipRecorder {
  constructor(getCanvas) {
    this.getCanvas = getCanvas;
    this.rec = null;
    this.blob = null;
    this.type = '';
    this.supported = typeof window !== 'undefined' && !!window.MediaRecorder && typeof HTMLCanvasElement !== 'undefined'
      && !!HTMLCanvasElement.prototype.captureStream;
  }

  get available() { return !!this.blob; }

  pickType() {
    for (const t of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4']) {
      try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (e) { /* seguir */ }
    }
    return '';
  }

  start() {
    if (!this.supported || this.rec) return;
    try {
      const stream = this.getCanvas().captureStream(30);
      this.type = this.pickType();
      const rec = new MediaRecorder(stream, this.type ? { mimeType: this.type, videoBitsPerSecond: 2_500_000 } : undefined);
      const chunks = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        if (rec.keep && chunks.length) this.blob = new Blob(chunks, { type: this.type || 'video/webm' });
      };
      rec.start(250);
      this.rec = rec;
      this.safety = setTimeout(() => this.stop(false), 12000);
    } catch (e) { this.rec = null; }
  }

  stop(keep) {
    const rec = this.rec;
    if (!rec) return;
    clearTimeout(this.safety);
    rec.keep = keep;
    this.rec = null;
    try { rec.stop(); } catch (e) { /* ya detenido */ }
  }

  // keep: guardar solo si hubo colapso (si no, no vale la pena)
  stopAfter(ms, keep) {
    if (!this.rec) return;
    const rec = this.rec;
    setTimeout(() => { if (this.rec === rec) this.stop(keep); }, ms);
  }

  reset() { this.stop(false); this.blob = null; }

  file() {
    if (!this.blob) return null;
    const ext = this.type.includes('mp4') ? 'mp4' : 'webm';
    return new File([this.blob], `contracorriente-colapso.${ext}`, { type: this.blob.type });
  }
}
