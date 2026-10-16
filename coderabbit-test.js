
function moyenne(notes) {
  return notes.reduce((a, b) => a + b, 0) / notes.length;
}
