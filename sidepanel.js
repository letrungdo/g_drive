let defaultFolderId,
  currentBacklogID,
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

async function getCurrentTabUrl() {
  const queryOptions = { active: true, lastFocusedWindow: true };
  const [tab] = await chrome.tabs.query(queryOptions);
  return tab?.url;
}

async function getCurrentBacklogId() {
  const url = await getCurrentTabUrl();
  const match = url?.match(/view\/([A-Z]+-\d+)/);
  return match ? match[1] : null;
}

function processFolder(authToken, callback) {
  chrome.storage.local.get(
    ["defaultFolderName", "defaultFolderId"],
    async function (storageData) {
      const folderName =
        storageData.defaultFolderName ||
        chrome.i18n.getMessage("defaultFolderName");

      const backlogId = await getCurrentBacklogId();
      if (backlogId == null || currentBacklogID != backlogId) {
        defaultFolderId = null; // reset Id to create new folder
      }
      currentBacklogID = backlogId;
      console.log("____currentBacklogID", currentBacklogID);

      if (defaultFolderId) {
        callback();
      } else if (folderRequestPromise) {
        folderRequestPromise.then(callback);
      } else {
        folderRequestPromise = new Promise(async (resolve, reject) => {
          defaultFolderId = await createFolderPath(folderName, authToken);
          if (defaultFolderId) {
            console.log("Final folder ID:", defaultFolderId);
            chrome.storage.local.set({ defaultFolderId });
            resolve();
            callback();
          } else {
            reject();
          }
          folderRequestPromise = null;
        });
      }
    }
  );
}

// Function to find or create a folder by name within a specified parent
async function findOrCreateFolder(folderName, parentId, accessToken) {
  try {
    // First, try to find the folder by name within the specified parent
    const searchUrl = `https://www.googleapis.com/drive/v3/files?q='${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false&fields=files(id, name)`;
    let response = await fetch(searchUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    const files = data.files;

    // If folder exists, return its ID
    if (files && files.length > 0) {
      return files[0].id;
    }

    // If folder doesn't exist, create it
    const createUrl = "https://www.googleapis.com/drive/v3/files";
    const folderMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    };

    response = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(folderMetadata),
    });

    const newFolder = await response.json();
    console.log(`Created folder "${folderName}": ID = ${newFolder.id}`);
    return newFolder.id;
  } catch (error) {
    console.error(`Error finding or creating folder "${folderName}":`, error);
    return null;
  }
}

// Main function to create the full folder path
async function createFolderPath(path, accessToken) {
  const folderNames = path.split("/");
  if (currentBacklogID) {
    folderNames.push(currentBacklogID);
  }
  let parentId = "root"; // Start from the root folder

  for (const folderName of folderNames) {
    parentId = await findOrCreateFolder(folderName, parentId, accessToken);
    if (!parentId) {
      console.error(`Failed to create path: ${path}`);
      return null;
    }
  }

  console.log(`Final folder ID for path "${path}": ${parentId}`);
  return parentId;
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

    xhr.onload = async function () {
      if (this.status === 200 || this.status === 201) {
        const res = JSON.parse(this.response);
        console.log("___finalizeUpload", res);
        const shareUrl = await createShareLink(res, authToken);
        finalizeUpload(file.name, shareUrl);
      } else if (this.status === 308) {
        uploadedSize += chunkSize;
        const rangeHeader = this.getResponseHeader("Range");
        const nextBytePosition = parseInt(rangeHeader.split("-")[1], 10) + 1;
        uploadChunk(uploadUrl, file, nextBytePosition);
      } else {
        showSnackBar(`Failed to upload chunk. Status: ${this.status}`);
      }
    };

    xhr.onerror = function () {
      showSnackBar("Network error occurred!");
    };

    xhr.send(chunk);
  };

  initiateResumableUpload(authToken, file, uploadChunk);
}

async function createShareLink({ id, mimeType }, accessToken) {
  // console.log("___createShareLink", id, mimeType);

  // Step 2: Set permissions to allow anyone with the link to view
  const permissionResponse = await fetch(
    `https://www.googleapis.com/drive/v3/files/${id}/permissions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        role: "reader",
        type: "domain",
        domain: "guide.inc",
      }),
    }
  );
  if (!permissionResponse.ok) {
    throw new Error("Failed to set file permissions.");
  }
  console.log("Permissions set to public.");

  let shareableLink;

  if (mimeType && mimeType.startsWith("image/")) {
    shareableLink = `#image(https://drive.google.com/thumbnail?id=${id}&sz=w2000)`;
  } else {
    const linkResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${id}?fields=webViewLink`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    const linkResult = await linkResponse.json();
    shareableLink = linkResult.webViewLink;
  }
  console.log("Shareable link:", shareableLink);

  return shareableLink;
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
      const res = JSON.parse(this.response);
      const firstError = res?.error?.errors?.[0] ?? {};
      if (firstError.reason == "notFound" && firstError.location == "fileId") {
        defaultFolderId = null;
        // Folder has been deleted
        processFolder(authToken, () =>
          initiateResumableUpload(authToken, file, uploadChunk)
        );
        return;
      }
      showSnackBar(`Failed to initiate upload: ${this.response}`);
    }
  };

  xhr.onerror = function () {
    showSnackBar("Network error occurred!");
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

function finalizeUpload(fileName, shareUrl) {
  const progressElement = uploadProgress[fileName];
  if (progressElement) {
    progressElement.progressBar.style.display = "none";
    progressElement.progressText.style.display = "none";
    const copyButton = document.createElement("button");
    copyButton.dataset.shareUrl = shareUrl;

    copyButton.textContent = "Copy";
    copyButton.className = "copy-button";
    copyButton.addEventListener("click", () => {
      navigator.clipboard.writeText(shareUrl);
      showSnackBar(`Copied: ${shareUrl}`);
    });
    progressElement.container
      .querySelector(".uploading-file-name")
      .appendChild(copyButton);
    delete uploadProgress[fileName];

    document.getElementById("btnCopyAll").style.display = "flex";
  }
}

function onCopyAll() {
  const shareUrls = [];
  document.querySelectorAll(".copy-button").forEach((e) => {
    shareUrls.push(e.dataset.shareUrl);
  });
  navigator.clipboard.writeText(shareUrls.join("\n"));
  showSnackBar(`Copied All`);
}

function showSnackBar(message) {
  var sb = document.getElementById("snackbar");

  //this is where the class name will be added & removed to activate the css
  sb.className = "show";
  sb.textContent = message;

  setTimeout(() => {
    sb.className = sb.className.replace("show", "");
  }, 2000);
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
        .getElementById("btnCopyAll")
        .addEventListener("click", function (e) {
          e.preventDefault();
          onCopyAll();
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
                showSnackBar("Failed to download the file: " + error);
              });
          } else {
            showSnackBar("Invalid URL");
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
                showSnackBar("Failed to obtain access token.");
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
                      showSnackBar(
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
                            showSnackBar("Error when revoking token");
                          }
                        })
                        .catch((error) => {
                          showSnackBar(
                            `Error when executing request to the server: ${error}`
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
