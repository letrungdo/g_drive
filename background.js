let defaultFolderId,
  defaultFolderCreationPromise = null;

function getAuthTokenAndUploadFile(file) {
  chrome.identity.getAuthToken({ interactive: true }, function (authToken) {
    if (chrome.runtime.lastError) {
      console.log(chrome.runtime.lastError.message);
    } else {
      getDefaultFolderId(authToken, function () {
        uploadFileToDrive(authToken, file);
      });
    }
  });
}

function getDefaultFolderId(authToken, callback) {
  chrome.storage.local.get("defaultFolderName", function (storageData) {
    const folderName =
      storageData.defaultFolderName ||
      chrome.i18n.getMessage("defaultFolderName");

    if (defaultFolderId) {
      callback();
    } else {
      chrome.storage.local.get("defaultFolderId", function (storageData) {
        if (storageData.defaultFolderId) {
          defaultFolderId = storageData.defaultFolderId;
          callback();
        } else {
          if (defaultFolderCreationPromise) {
            defaultFolderCreationPromise.then(() => {
              callback();
            });
          } else {
            defaultFolderCreationPromise = new Promise((resolve, reject) => {
              fetch(
                `https://www.googleapis.com/drive/v3/files?q=name="${folderName}"`,
                {
                  headers: { Authorization: "Bearer " + authToken },
                }
              )
                .then((response) => response.json())
                .then((data) => {
                  if (data.files && data.files.length > 0) {
                    defaultFolderId = data.files[0].id;
                    chrome.storage.local.set(
                      { defaultFolderId: defaultFolderId },
                      function () {
                        console.log(
                          "defaultFolderId is set to " + defaultFolderId
                        );
                      }
                    );
                    resolve();
                    callback();
                  } else {
                    const newFolderMetadata = {
                      name: folderName,
                      mimeType: "application/vnd.google-apps.folder",
                    };
                    fetch("https://www.googleapis.com/drive/v3/files", {
                      method: "POST",
                      headers: {
                        Authorization: "Bearer " + authToken,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify(newFolderMetadata),
                    })
                      .then((response) => response.json())
                      .then((data) => {
                        defaultFolderId = data.id;
                        chrome.storage.local.set(
                          { defaultFolderId: defaultFolderId },
                          function () {
                            console.log(
                              "defaultFolderId is set to " + defaultFolderId
                            );
                          }
                        );
                        resolve();
                        callback();
                      });
                  }
                })
                .catch((error) => {
                  reject(error);
                });
            });
          }
        }
      });
    }
  });
}

function uploadFileToDrive(authToken, file) {
  const boundary = "-------314159265358979323846";
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelimiter = "\r\n--" + boundary + "--";
  const fileReader = new FileReader();

  fileReader.readAsArrayBuffer(file);
  fileReader.onload = function (event) {
    const mimeType = file.type || "application/octet-stream";
    const metadata = {
      name: file.name,
      mimeType: mimeType,
      parents: [defaultFolderId],
    };
    const base64Data = arrayBufferToBase64(event.target.result);
    const multipartRequestBody =
      delimiter +
      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
      JSON.stringify(metadata) +
      delimiter +
      "Content-Type: " +
      mimeType +
      "\r\nContent-Transfer-Encoding: base64\r\n\r\n" +
      base64Data +
      closeDelimiter;

    fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + authToken,
          "Content-Type": "multipart/related; boundary=" + boundary,
        },
        body: multipartRequestBody,
      }
    )
      .then((response) => {
        if (!response.ok)
          throw new Error(`HTTP error! Status: ${response.status}`);
        return response.json();
      })
      .then(() => {
        chrome.windows.create({
          url: `result.html?name=${file.name}`,
          type: "popup",
          width: 400,
          height: 200,
        });
      })
      .catch((error) => {
        if (error.message.includes("404")) {
          defaultFolderId = null;
          getAuthTokenAndUploadFile(file);
        } else {
          console.error("Failed to upload file:", error);
        }
      });
  };
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const length = bytes.byteLength;
  for (let i = 0; i < length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const UNINSTALL_URL = "https://www.guide.inc/";
chrome.runtime.setUninstallURL(UNINSTALL_URL);
chrome.runtime.onInstalled.addListener((installDetails) => {
  chrome.contextMenus.create({
    id: "captureScreenshot",
    title: chrome.i18n.getMessage("contextMenuScreenShotTitle"),
    contexts: ["all"],
  });

  if (installDetails.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.storage.local.clear(function () {
      let error = chrome.runtime.lastError;
      if (error) console.error(error);
    });
    chrome.tabs.create({ url: "https://www.guide.inc/" });
  }
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === "captureScreenshot") {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.tabs.captureVisibleTab(
        null,
        { format: "png" },
        function (dataUrl) {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
          } else if (dataUrl) {
            const binaryString = atob(dataUrl.split(",")[1]);
            const arrayBuffer = new ArrayBuffer(binaryString.length);
            const uintArray = new Uint8Array(arrayBuffer);
            for (let i = 0; i < binaryString.length; i++) {
              uintArray[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([arrayBuffer], { type: "image/png" });
            const timestamp = Date.now();
            getAuthTokenAndUploadFile(
              new File([blob], `screenshot_${timestamp}.png`, {
                type: blob.type,
              })
            );
          } else {
            alert("Failed to capture screenshot.");
          }
        }
      );
    });
  }
});
