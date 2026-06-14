// Quick local validation test for upload rules (MAX_UPLOAD_MB and MIME checks)
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '50', 10);
const allowedMimePatterns = [
  /^image\//,
  /^application\/pdf$/,
  /^text\//,
  /^application\/msword$/,
  /^application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document$/,
  /^application\/zip$/
];

function validateFile({ size, mimetype }) {
  if (typeof size === 'number' && size > MAX_UPLOAD_MB * 1024 * 1024) {
    return { ok: false, reason: `size_exceeded: ${size} bytes > ${MAX_UPLOAD_MB}MB` };
  }
  const isAllowed = allowedMimePatterns.some((rx) => rx.test(mimetype || ''));
  if (!isAllowed) return { ok: false, reason: `mime_not_allowed: ${mimetype}` };
  return { ok: true };
}

const tests = [
  { name: 'small-pdf', size: 1 * 1024 * 1024, mimetype: 'application/pdf' },
  { name: 'large-pdf', size: 60 * 1024 * 1024, mimetype: 'application/pdf' },
  { name: 'small-jpeg', size: 2 * 1024 * 1024, mimetype: 'image/jpeg' },
  { name: 'exe-file', size: 1 * 1024 * 1024, mimetype: 'application/x-msdownload' }
];

console.log(`MAX_UPLOAD_MB=${MAX_UPLOAD_MB}`);
for (const t of tests) {
  const res = validateFile({ size: t.size, mimetype: t.mimetype });
  console.log(`${t.name}: ${res.ok ? 'OK' : 'REJECT'}${res.ok ? '' : ' -> ' + res.reason}`);
}
