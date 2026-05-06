onmessage = (e) => {
  const delay = e.data[0] + 1;
  setTimeout(() => {
    postMessage('timeout')
  }, delay * 60000);
}