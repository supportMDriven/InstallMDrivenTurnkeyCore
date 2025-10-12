export function CacheThis(name, id) {


  const viewModel = document.getElementById("contentWrapper");
  if (!viewModel) return;

  let mutationTimeout;
  let donealready = false;
  const observer = new MutationObserver((mutationsList, observer) => {
    clearTimeout(mutationTimeout);

    // Wait 500ms after last mutation before capturing
    mutationTimeout = setTimeout(() => {
      observer.disconnect(); // Stop observing
      if (donealready)
        return;
      donealready = true;
      captureAndSend(name, id, viewModel);
    }, 500);
  });

  observer.observe(viewModel, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });

  // Fallback: if no mutations after 3s, proceed anyway
  setTimeout(() => {
    observer.disconnect();
    if (donealready)
      return;
    donealready = true;
    captureAndSend(name, id, viewModel);
  }, 3000);



}

function captureAndSend(name, id, viewModel) {
  //debugger;
  const htmlContent = viewModel.innerHTML.replace('<!--!-->',''); // blazor comment can mix things up and block cached from rendering

  const formData = new FormData();

  // Append fields
  formData.append('viewmodel', name);
  formData.append('rootid', id);
  formData.append('html', htmlContent);

  fetch("/Rest/SysCacheCapture/Post/$null$", {
    method: "POST",
    body: formData
  }).then(response => {
    if (!response.ok) {
      console.error("Failed to cache page content");
    }
    else {
      console.info("CACHETHIS recongnised and data sent");

    }
  }).catch(err => {
    console.error("Error, check model, it should have a SysCacheCapture viewmodel with RestAllowed, and viewmodel,rootid,html columns:", err);
  });
}
