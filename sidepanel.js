let defaultFolderId,
  uploadProgress = {},
  folderRequestPromise = null;

function initiateFileUpload(file) {
  chrome.identity.getAuthToken({ interactive: true }, function (authToken) {
    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError.message);
    } else {
      processFolder(authToken, function () {
        handleFileUpload(authToken, file);
      });
    }
  });
}

function processFolder(authToken, callback) {
  chrome.storage.local.get(
    ["defaultFolderName", "defaultFolderId"],
    function (storageData) {
      const folderName =
        storageData.defaultFolderName ||
        chrome.i18n.getMessage("defaultFolderName");

      if (defaultFolderId) {
        callback();
      } else if (folderRequestPromise) {
        folderRequestPromise.then(callback);
      } else {
        folderRequestPromise = new Promise((resolve, reject) => {
          fetchFolder(authToken, folderName, resolve, reject, callback);
        });
      }
    }
  );
}

function fetchFolder(authToken, folderName, resolve, reject, callback) {
  fetch(`https://www.googleapis.com/drive/v3/files?q=name="${folderName}"`, {
    headers: { Authorization: "Bearer " + authToken },
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.files && data.files.length > 0) {
        defaultFolderId = data.files[0].id;
        chrome.storage.local.set({ defaultFolderId });
        resolve();
        callback();
        folderRequestPromise = null;
      } else {
        createFolder(authToken, folderName, resolve, callback);
      }
    })
    .catch(reject);
}

function createFolder(authToken, folderName, resolve, callback) {
  const folderMetadata = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };

  fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + authToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(folderMetadata),
  })
    .then((response) => response.json())
    .then((folder) => {
      defaultFolderId = folder.id;
      chrome.storage.local.set({ defaultFolderId });
      resolve();
      callback();
    })
    .finally(() => {
      folderRequestPromise = null;
    });
}

function handleFileUpload(authToken, file) {
  const chunkSize = 10485760; // 10MB
  let uploadedSize = 0;

  const uploadChunk = (uploadUrl, file, start) => {
    const end = Math.min(file.size, start + chunkSize);
    const chunk = file.slice(start, end);
    const xhr = new XMLHttpRequest();

    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Authorization", "Bearer " + authToken);
    xhr.setRequestHeader(
      "Content-Range",
      `bytes ${start}-${end - 1}/${file.size}`
    );

    xhr.upload.onprogress = function (event) {
      if (event.lengthComputable) {
        const percentComplete =
          ((uploadedSize + event.loaded) / file.size) * 100;
        updateUploadProgress(file.name, percentComplete);
      }
    };

    xhr.onload = function () {
      if (this.status === 200 || this.status === 201) {
        finalizeUpload(file.name);
      } else if (this.status === 308) {
        uploadedSize += chunkSize;
        const rangeHeader = this.getResponseHeader("Range");
        const nextBytePosition = parseInt(rangeHeader.split("-")[1], 10) + 1;
        uploadChunk(uploadUrl, file, nextBytePosition);
      } else {
        displayError(`Failed to upload chunk. Status: ${this.status}`);
      }
    };

    xhr.onerror = function () {
      displayError("Network error occurred!");
    };

    xhr.send(chunk);
  };

  initiateResumableUpload(authToken, file, uploadChunk);
}

function initiateResumableUpload(authToken, file, uploadChunk) {
  const fileMetadata = {
    name: file.name,
    mimeType: file.type,
    parents: [defaultFolderId],
  };
  const xhr = new XMLHttpRequest();

  xhr.open(
    "POST",
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
    true
  );
  xhr.setRequestHeader("Authorization", "Bearer " + authToken);
  xhr.setRequestHeader("Content-Type", "application/json; charset=UTF-8");

  xhr.onload = function () {
    if (this.status === 200) {
      const uploadUrl = this.getResponseHeader("Location");
      uploadChunk(uploadUrl, file, 0);
    } else {
      displayError(`Failed to initiate upload. Status: ${this.status}`);
    }
  };

  xhr.onerror = function () {
    displayError("Network error occurred!");
  };

  xhr.send(JSON.stringify(fileMetadata));
}

function updateUploadProgress(fileName, percentComplete) {
  if (!uploadProgress[fileName]) {
    uploadProgress[fileName] = createProgressElement(fileName);
  }
  const progressElement = uploadProgress[fileName];
  progressElement.progressBar.value = percentComplete;
  progressElement.progressText.textContent = `${percentComplete.toFixed(2)}%`;
}

function finalizeUpload(fileName) {
  const progressElement = uploadProgress[fileName];
  if (progressElement) {
    progressElement.progressBar.style.display = "none";
    progressElement.progressText.style.display = "none";
    const doneMessage = document.createElement("span");
    doneMessage.textContent = "Done";
    doneMessage.className = "done-message";
    progressElement.container
      .querySelector(".uploading-file-name")
      .appendChild(doneMessage);
    delete uploadProgress[fileName];
  }
}

function createProgressElement(fileName) {
  const container = document.createElement("div");
  const fileNameElement = document.createElement("div");
  const progressBar = document.createElement("progress");
  const progressText = document.createElement("span");
  const messageContainer = document.createElement("div");

  progressBar.max = 100;
  progressBar.value = 0;
  fileNameElement.textContent = fileName;
  fileNameElement.className = "uploading-file-name";

  container.appendChild(fileNameElement);
  container.appendChild(progressBar);
  container.appendChild(progressText);
  container.appendChild(messageContainer);
  document.getElementById("progressContainer").prepend(container);

  return {
    container,
    progressBar,
    progressText,
    completionMessage: messageContainer,
  };
}

function displayError(errorMessage) {
  const errorContainer = document.createElement("div");
  errorContainer.className = "error-message";
  const errorText = document.createTextNode("Error: " + errorMessage);
  errorContainer.appendChild(errorText);

  const closeButton = document.createElement("button");
  closeButton.textContent = "X";
  closeButton.addEventListener("click", () => {
    errorContainer.remove();
  });
  errorContainer.insertBefore(closeButton, errorText);
  document.body.insertBefore(errorContainer, document.body.firstChild);
}

function toggleAppDisplay(isConnected) {
  if (isConnected) {
    document.querySelector(".app").style.display = "flex";
    document.getElementById("connectDrive").style.display = "none";
  } else {
    document.querySelector(".app").style.display = "none";
    document.getElementById("connectDrive").style.display = "flex";
  }
}

document.addEventListener("DOMContentLoaded", function () {
  chrome.identity.getAuthToken({ interactive: false }, function (authToken) {
    toggleAppDisplay(authToken);
  });

  chrome.storage.local.get(
    ["defaultFolderName", "defaultFolderId"],
    function (storageData) {
      const folderName =
        storageData.defaultFolderName ||
        chrome.i18n.getMessage("defaultFolderName");

      if (storageData.defaultFolderId)
        defaultFolderId = storageData.defaultFolderId;
      document.getElementById("folderName").textContent = folderName;

      const dropZone = document.getElementById("dropZone");

      dropZone.addEventListener("dragover", (e) => {
        e.stopPropagation();
        e.preventDefault();
        dropZone.classList.add("dragover");
        e.dataTransfer.dropEffect = "copy";
      });

      dropZone.addEventListener("dragleave", (e) => {
        e.stopPropagation();
        e.preventDefault();
        dropZone.classList.remove("dragover");
      });

      dropZone.addEventListener("drop", (e) => {
        e.stopPropagation();
        e.preventDefault();
        dropZone.classList.remove("dragover");

        const files = e.dataTransfer.files;
        for (let i = 0; i < files.length; i++) {
          initiateFileUpload(files[i]);
        }
      });

      dropZone.addEventListener("dragenter", (e) => {
        e.stopPropagation();
        e.preventDefault();
      });

      document
        .getElementById("changeFolder")
        .addEventListener("click", function (e) {
          e.preventDefault();
          chrome.storage.local.get("defaultFolderName", function (storageData) {
            const currentFolderName =
              storageData.defaultFolderName ||
              chrome.i18n.getMessage("defaultFolderName");
            const newFolderName = prompt(
              "Enter new folder name:",
              currentFolderName
            );
            if (newFolderName && newFolderName.trim() !== "") {
              document.getElementById("folderName").textContent =
                newFolderName.trim();
              defaultFolderId = null;
              chrome.storage.local.set({
                defaultFolderName: newFolderName.trim(),
                defaultFolderId: null,
              });
            }
          });
        });

      document
        .getElementById("dropZone")
        .addEventListener("click", function () {
          document.getElementById("fileInput").click();
        });

      document
        .getElementById("fileInput")
        .addEventListener("change", function (e) {
          const files = e.target.files;
          for (let i = 0; i < files.length; i++) {
            initiateFileUpload(files[i]);
          }
        });

      document
        .getElementById("downloadFromUrl")
        .addEventListener("click", function () {
          const fileUrl = document.getElementById("fileUrl").value;
          if (fileUrl) {
            fetch(fileUrl)
              .then((response) => response.blob())
              .then((blob) => {
                initiateFileUpload(
                  new File([blob], fileUrl.split("/").pop(), {
                    type: blob.type,
                  })
                );
              })
              .catch((error) => {
                console.error("Failed to download the file:", error);
                displayError("Failed to download the file: " + error);
              });
          } else {
            console.error("Invalid URL");
          }
        });

      document
        .getElementById("connectDriveBtn")
        .addEventListener("click", function () {
          chrome.identity.getAuthToken(
            { interactive: true },
            function (authToken) {
              if (authToken) {
                document.getElementById("connectDrive").style.display = "none";
                document.querySelector(".app").style.display = "flex";
              } else {
                console.error("Failed to obtain access token.");
              }
            }
          );
        });

      document
        .getElementById("changeAccount")
        .addEventListener("click", function () {
          chrome.identity.getAuthToken(
            { interactive: false },
            function (authToken) {
              if (chrome.runtime.lastError) {
                console.log(chrome.runtime.lastError);
              } else {
                chrome.identity.clearAllCachedAuthTokens(function () {
                  defaultFolderId = null;
                  chrome.storage.local.remove("defaultFolderId", function () {
                    if (chrome.runtime.lastError) {
                      console.log(
                        "Error clearing defaultFolderId in storage:",
                        chrome.runtime.lastError
                      );
                    } else {
                      fetch(
                        `https://accounts.google.com/o/oauth2/revoke?token=${authToken}`
                      )
                        .then((response) => {
                          if (response.ok) {
                            chrome.identity.getAuthToken(
                              { interactive: true },
                              function (newAuthToken) {
                                if (chrome.runtime.lastError) {
                                  console.log(chrome.runtime.lastError);
                                } else {
                                  toggleAppDisplay(newAuthToken);
                                  folderRequestPromise = null;
                                }
                              }
                            );
                          } else {
                            console.error("Error when revoking token");
                          }
                        })
                        .catch((error) => {
                          console.error(
                            "Error when executing request to the server:",
                            error
                          );
                          displayError(
                            "Error when executing request to the server: " +
                              error
                          );
                        });
                    }
                  });
                });
              }
            }
          );
        });
    }
  );
});

// Replace internationalization tags in HTML
(function replaceIntlTags() {
  const htmlElements = document.getElementsByTagName("html");
  for (let i = 0; i < htmlElements.length; i++) {
    let element = htmlElements[i],
      originalHTML = element.innerHTML.toString(),
      replacedHTML = originalHTML.replace(
        /__MSG_(\w+)__/g,
        function (match, key) {
          return key ? chrome.i18n.getMessage(key) : "";
        }
      );
    if (replacedHTML !== originalHTML) {
      element.innerHTML = replacedHTML;
    }
  }
})();
