
function moyenne(notes) {
  if (notes.length === 0) {
    return null;
  }
  return notes.reduce((a, b) => a + b, 0) / notes.length;
}
