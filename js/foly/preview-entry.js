// Keep startup failures visible instead of leaving a blank page and a console-only error.
try {
  await import('./preview.js?v=20261103-2');
} catch (error) {
  const summary = document.getElementById('summary');
  summary.setAttribute('role', 'alert');
  summary.textContent = `Preview could not start: ${error.message}`;
  console.error('Foly preview startup failed', error);
}