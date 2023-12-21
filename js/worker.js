onmessage = (e) => {
  const delay = e.data[0] + 2;
  setTimeout(() => {
    postMessage('timeout')
  }, delay * 60000);
}