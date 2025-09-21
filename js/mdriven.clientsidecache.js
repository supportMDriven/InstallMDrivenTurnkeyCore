export function CacheThis(name,id) {


  const viewModel = document.getElementById("globalContentWrapper");
  if (!viewModel) return;

    let mutationTimeout;
    const observer = new MutationObserver((mutationsList, observer) => {
      clearTimeout(mutationTimeout);

      // Wait 500ms after last mutation before capturing
      mutationTimeout = setTimeout(() => {
        observer.disconnect(); // Stop observing
        captureAndSend(name, id, viewModel);
      }, 500);
    });

  observer.observe(viewModel, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });

    // Fallback: if no mutations after 2s, proceed anyway
    setTimeout(() => {
      observer.disconnect();
      captureAndSend(name, id, viewModel);
    }, 2000);



  }

function captureAndSend(name, id, viewModel) {

    const htmlContent = viewModel.innerHTML;

    fetch("/api/PageContentCache", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: name,
        id: id,
        html: htmlContent
      })
    }).then(response => {
      if (!response.ok) {
        console.error("Failed to cache page content");
      }
      else {
        console.error("CACHETHIS recongnised and data sent");

      }
    }).catch(err => {
      console.error("Error posting cached content:", err);
    });
  }
