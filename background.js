(() => {
  "use strict";
  let e,
    t = null;
  function o(n) {
    chrome.identity.getAuthToken({ interactive: !0 }, function (r) {
      chrome.runtime.lastError
        ? console.log(chrome.runtime.lastError.message)
        : (function (o, n) {
            chrome.storage.local.get("defaultFolderName", function (r) {
              const a =
                r.defaultFolderName ||
                chrome.i18n.getMessage("defaultFolderName");
              e
                ? n()
                : chrome.storage.local.get("defaultFolderId", function (r) {
                    if (r.defaultFolderId) (e = r.defaultFolderId), n();
                    else {
                      if (t)
                        return void t.then(() => {
                          n();
                        });
                      t = new Promise((t, r) => {
                        fetch(
                          'https://www.googleapis.com/drive/v3/files?q=name="' +
                            a +
                            '"',
                          { headers: { Authorization: "Bearer " + o } }
                        )
                          .then((e) => e.json())
                          .then((r) => {
                            if (r.files && r.files.length > 0)
                              (e = r.files[0].id),
                                chrome.storage.local.set(
                                  { defaultFolderId: e },
                                  function () {
                                    console.log(
                                      "defaultFolderId is set to " + e
                                    );
                                  }
                                ),
                                t(),
                                n();
                            else {
                              const r = {
                                name: a,
                                mimeType: "application/vnd.google-apps.folder",
                              };
                              fetch(
                                "https://www.googleapis.com/drive/v3/files",
                                {
                                  method: "POST",
                                  headers: {
                                    Authorization: "Bearer " + o,
                                    "Content-Type": "application/json",
                                  },
                                  body: JSON.stringify(r),
                                }
                              )
                                .then((e) => e.json())
                                .then((o) => {
                                  (e = o.id),
                                    chrome.storage.local.set(
                                      { defaultFolderId: e },
                                      function () {
                                        console.log(
                                          "defaultFolderId is set to " + e
                                        );
                                      }
                                    ),
                                    t(),
                                    n();
                                });
                            }
                          })
                          .catch((e) => {
                            r(e);
                          });
                      });
                    }
                  });
            });
          })(r, function () {
            !(function (t, n) {
              const r = "-------314159265358979323846",
                a = "\r\n--" + r + "\r\n",
                l = "\r\n--" + r + "--",
                s = new FileReader();
              s.readAsArrayBuffer(n),
                (s.onload = function (s) {
                  const i = n.type || "application/octet-stream",
                    c = { name: n.name, mimeType: i, parents: [e] },
                    d = (function (e) {
                      let t = "";
                      const o = new Uint8Array(e),
                        n = o.byteLength;
                      for (let e = 0; e < n; e++)
                        t += String.fromCharCode(o[e]);
                      return btoa(t);
                    })(s.target.result),
                    u =
                      a +
                      "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
                      JSON.stringify(c) +
                      a +
                      "Content-Type: " +
                      i +
                      "\r\nContent-Transfer-Encoding: base64\r\n\r\n" +
                      d +
                      l;
                  fetch(
                    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
                    {
                      method: "POST",
                      headers: {
                        Authorization: "Bearer " + t,
                        "Content-Type": "multipart/related; boundary=" + r,
                      },
                      body: u,
                    }
                  )
                    .then((e) => {
                      if (!e.ok)
                        throw new Error(`HTTP error! Status: ${e.status}`);
                      return e.json();
                    })
                    .then((e) => {
                      chrome.windows.create({
                        url: `result.html?name=${n.name}`,
                        type: "popup",
                        width: 400,
                        height: 200,
                      });
                    })
                    .catch((t) => {
                      t.message.includes("404")
                        ? ((e = null), o(n))
                        : console.error("Failed to upload file:", t);
                    });
                });
            })(r, n);
          });
    });
  }
  const UNINSTALL_URL = "https://cv.xn--t-lia.vn/";
  chrome.runtime.setUninstallURL(UNINSTALL_URL);
  chrome.runtime.onInstalled.addListener((e) => {
    chrome.contextMenus.create({
      id: "captureScreenshot",
      title: chrome.i18n.getMessage("contextMenuScreenShotTitle"),
      contexts: ["all"],
    }),
      e.reason === chrome.runtime.OnInstalledReason.INSTALL
        ? (chrome.storage.local.clear(function () {
            let e = chrome.runtime.lastError;
            e && console.error(e);
          }),
          chrome.tabs.create({ url: "https://cv.xn--t-lia.vn/" }))
        : e.reason === chrome.runtime.OnInstalledReason.UPDATE ||
          e.reason === chrome.runtime.OnInstalledReason.CHROME_UPDATE ||
          (e.reason, chrome.runtime.OnInstalledReason.SHARED_MODULE_UPDATE);
  }),
    chrome.sidePanel
      .setPanelBehavior({ openPanelOnActionClick: !0 })
      .catch((e) => console.error(e)),
    chrome.contextMenus.onClicked.addListener(function (e, t) {
      "captureScreenshot" === e.menuItemId &&
        chrome.tabs.query({ active: !0, currentWindow: !0 }, function (e) {
          chrome.tabs.captureVisibleTab(null, { format: "png" }, function (e) {
            if (chrome.runtime.lastError)
              console.error(chrome.runtime.lastError.message);
            else if (e) {
              const t = atob(e.split(",")[1]),
                n = new ArrayBuffer(t.length),
                r = new Uint8Array(n);
              for (let e = 0; e < t.length; e++) r[e] = t.charCodeAt(e);
              const a = new Blob([n], { type: "image/png" }),
                l = Date.now();
              o(new File([a], `screenshot_${l}.png`, { type: a.type }));
            } else alert("Failed to capture screenshot.");
          });
        });
    });
})();
