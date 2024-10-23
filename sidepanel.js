(() => {
  var e = { 163: () => {} },
    t = {};
  function n(o) {
    var r = t[o];
    if (void 0 !== r) return r.exports;
    var s = (t[o] = { exports: {} });
    return e[o](s, s.exports, n), s.exports;
  }
  (n.n = (e) => {
    var t = e && e.__esModule ? () => e.default : () => e;
    return n.d(t, { a: t }), t;
  }),
    (n.d = (e, t) => {
      for (var o in t)
        n.o(t, o) &&
          !n.o(e, o) &&
          Object.defineProperty(e, o, { enumerable: !0, get: t[o] });
    }),
    (n.o = (e, t) => Object.prototype.hasOwnProperty.call(e, t)),
    (() => {
      "use strict";
      n(163);
      let e,
        t = {},
        o = null;
      function r(n) {
        chrome.identity.getAuthToken({ interactive: !0 }, function (r) {
          chrome.runtime.lastError
            ? console.log(chrome.runtime.lastError.message)
            : (function (t, n) {
                chrome.storage.local.get(
                  ["defaultFolderName", "defaultFolderId"],
                  function (r) {
                    const s =
                      r.defaultFolderName ||
                      chrome.i18n.getMessage("defaultFolderName");
                    e
                      ? n()
                      : o
                      ? o.then(() => {
                          n();
                        })
                      : (o = new Promise((r, a) => {
                          fetch(
                            'https://www.googleapis.com/drive/v3/files?q=name="' +
                              s +
                              '"',
                            { headers: { Authorization: "Bearer " + t } }
                          )
                            .then((e) => e.json())
                            .then((a) => {
                              if (a.files && a.files.length > 0)
                                (e = a.files[0].id),
                                  chrome.storage.local.set({
                                    defaultFolderId: a.files[0].id,
                                  }),
                                  r(),
                                  n(),
                                  (o = null);
                              else {
                                const a = {
                                  name: s,
                                  mimeType:
                                    "application/vnd.google-apps.folder",
                                };
                                fetch(
                                  "https://www.googleapis.com/drive/v3/files",
                                  {
                                    method: "POST",
                                    headers: {
                                      Authorization: "Bearer " + t,
                                      "Content-Type": "application/json",
                                    },
                                    body: JSON.stringify(a),
                                  }
                                )
                                  .then((e) => e.json())
                                  .then((t) => {
                                    (e = t.id),
                                      chrome.storage.local.set({
                                        defaultFolderId: t.id,
                                      }),
                                      r(),
                                      n();
                                  })
                                  .finally(() => {
                                    o = null;
                                  });
                              }
                            })
                            .catch((e) => {
                              a(e);
                            });
                        }));
                  }
                );
              })(r, function () {
                !(function (n, o) {
                  const r = 10485760;
                  let a = 0;
                  const l = (e, o, d) => {
                    const c = Math.min(o.size, d + r),
                      i = o.slice(d, c),
                      u = new XMLHttpRequest();
                    u.open("PUT", e, !0),
                      u.setRequestHeader("Authorization", "Bearer " + n),
                      u.setRequestHeader(
                        "Content-Range",
                        "bytes " + d + "-" + (c - 1) + "/" + o.size
                      ),
                      (u.upload.onprogress = function (e) {
                        if (e.lengthComputable) {
                          const n = ((a + e.loaded) / o.size) * 100;
                          t[o.name] ||
                            (t[o.name] = (function (e) {
                              const t = document.createElement("div"),
                                n = document.createElement("div"),
                                o = document.createElement("progress"),
                                r = document.createElement("span"),
                                s = document.createElement("div");
                              return (
                                (o.max = 100),
                                (o.value = 0),
                                (n.textContent = e),
                                (n.className = "uploading-file-name"),
                                t.appendChild(n),
                                (r.textContent = "0%"),
                                t.appendChild(o),
                                t.appendChild(r),
                                t.appendChild(s),
                                document
                                  .getElementById("progressContainer")
                                  .prepend(t),
                                {
                                  container: t,
                                  progressBar: o,
                                  progressText: r,
                                  completionMessage: s,
                                }
                              );
                            })(o.name));
                          const r = t[o.name];
                          (r.progressBar.value = n),
                            (r.progressText.textContent = `${n.toFixed(2)}%`);
                        }
                      }),
                      (u.onload = function () {
                        if (200 === this.status || 201 === this.status) {
                          const e = t[o.name];
                          if (e) {
                            (e.progressBar.style.display = "none"),
                              (e.progressText.style.display = "none");
                            const n = document.createElement("span");
                            (n.textContent = "Done"),
                              (n.className = "done-message"),
                              e.container
                                .querySelector(".uploading-file-name")
                                .appendChild(n),
                              delete t[o.name];
                          }
                        } else if (308 === this.status) {
                          a += r;
                          const t = this.getResponseHeader("Range"),
                            n = parseInt(t.split("-")[1], 10) + 1;
                          l(e, o, n);
                        } else if (
                          (console.error(
                            "Failed to upload chunk. Status:",
                            this.status,
                            "Response:",
                            this.responseText
                          ),
                          s(
                            "Failed to upload chunk. Status: " +
                              this.status +
                              " Response: " +
                              this.responseText
                          ),
                          progressElements)
                        ) {
                          (progressElements.progressBar.style.display = "none"),
                            (progressElements.progressText.style.display =
                              "none");
                          const e = document.createElement("span");
                          (e.textContent = "Done"),
                            (e.className = "done-message"),
                            progressElements.container
                              .querySelector(".uploading-file-name")
                              .appendChild(e),
                            delete t[o.name];
                        }
                      }),
                      (u.onerror = function () {
                        console.error("Network error occurred!"),
                          s("Network error occurred!");
                        const e = t[o.name];
                        if (e) {
                          (e.progressBar.style.display = "none"),
                            (e.progressText.style.display = "none");
                          const t = document.createElement("span");
                          (t.textContent = "Failed"),
                            (t.className = "failed-message"),
                            e.container
                              .querySelector(".uploading-file-name")
                              .appendChild(t);
                        }
                      }),
                      u.send(i);
                  };
                  ((t) => {
                    const o = { name: t.name, mimeType: t.type, parents: [e] },
                      r = new XMLHttpRequest();
                    r.open(
                      "POST",
                      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable",
                      !0
                    ),
                      r.setRequestHeader("Authorization", "Bearer " + n),
                      r.setRequestHeader(
                        "Content-Type",
                        "application/json; charset=UTF-8"
                      ),
                      (r.onload = function () {
                        if (200 === this.status) {
                          const e = this.getResponseHeader("Location");
                          l(e, t, 0);
                        } else
                          console.error(
                            "Failed to initiate upload. Status:",
                            this.status,
                            "Response:",
                            this.responseText
                          );
                      }),
                      (r.onerror = function () {
                        console.error("Network error occurred!"),
                          s("Network error occurred!");
                      }),
                      r.send(JSON.stringify(o));
                  })(o);
                })(r, n);
              });
        });
      }
      function s(e) {
        const t = document.createElement("div");
        t.className = "error-message";
        const n = document.createTextNode("Error: " + e);
        t.appendChild(n);
        const o = document.createElement("button");
        (o.textContent = "X"),
          o.addEventListener("click", () => {
            t.remove();
          }),
          t.insertBefore(o, n),
          document.body.insertBefore(t, document.body.firstChild);
      }
      function a(e) {
        e
          ? ((document.querySelector(".app").style.display = "flex"),
            (document.getElementById("connectDrive").style.display = "none"))
          : ((document.querySelector(".app").style.display = "none"),
            (document.getElementById("connectDrive").style.display = "flex"));
      }
      document.addEventListener("DOMContentLoaded", function () {
        chrome.identity.getAuthToken({ interactive: !1 }, function (e) {
          a(e);
        }),
          chrome.storage.local.get(
            ["defaultFolderName", "defaultFolderId"],
            function (t) {
              const n =
                t.defaultFolderName ||
                chrome.i18n.getMessage("defaultFolderName");
              t.defaultFolderId && (e = t.defaultFolderId),
                (document.getElementById("folderName").textContent = n);
              const l = document.getElementById("dropZone");
              l.addEventListener("dragover", (e) => {
                e.stopPropagation(),
                  e.preventDefault(),
                  l.classList.add("dragover"),
                  (e.dataTransfer.dropEffect = "copy");
              }),
                l.addEventListener("dragleave", (e) => {
                  e.stopPropagation(),
                    e.preventDefault(),
                    l.classList.remove("dragover");
                }),
                l.addEventListener("drop", (e) => {
                  e.stopPropagation(),
                    e.preventDefault(),
                    l.classList.remove("dragover");
                  const t = e.dataTransfer.files;
                  for (let e = 0; e < t.length; e++) r(t[e]);
                }),
                l.addEventListener("dragenter", (e) => {
                  e.stopPropagation(), e.preventDefault();
                }),
                document
                  .getElementById("changeFolder")
                  .addEventListener("click", function (t) {
                    t.preventDefault(),
                      chrome.storage.local.get(
                        "defaultFolderName",
                        function (t) {
                          const n =
                              t.defaultFolderName ||
                              chrome.i18n.getMessage("defaultFolderName"),
                            o = prompt("Enter new folder name:", n);
                          o &&
                            "" !== o.trim() &&
                            ((document.getElementById(
                              "folderName"
                            ).textContent = o.trim()),
                            (e = null),
                            chrome.storage.local.set({
                              defaultFolderName: o.trim(),
                              defaultFolderId: null,
                            }));
                        }
                      );
                  }),
                document
                  .getElementById("dropZone")
                  .addEventListener("click", function () {
                    document.getElementById("fileInput").click();
                  }),
                document
                  .getElementById("fileInput")
                  .addEventListener("change", function (e) {
                    const t = e.target.files;
                    for (let e = 0; e < t.length; e++) r(t[e]);
                  }),
                document
                  .getElementById("downloadFromUrl")
                  .addEventListener("click", function () {
                    const e = document.getElementById("fileUrl").value;
                    e
                      ? (function (e) {
                          fetch(e)
                            .then((e) => e.blob())
                            .then((t) => {
                              r(
                                new File([t], e.split("/").pop(), {
                                  type: t.type,
                                })
                              );
                            })
                            .catch((e) => {
                              console.error("Failed to download the file:", e),
                                s("Failed to download the file:" + e);
                            });
                        })(e)
                      : console.error("Invalid URL");
                  }),
                document
                  .getElementById("connectDriveBtn")
                  .addEventListener("click", function () {
                    chrome.identity.getAuthToken(
                      { interactive: !0 },
                      function (e) {
                        e
                          ? ((document.getElementById(
                              "connectDrive"
                            ).style.display = "none"),
                            (document.querySelector(".app").style.display =
                              "flex"))
                          : console.error("Failed to obtain access token.");
                      }
                    );
                  }),
                document
                  .getElementById("changeAccount")
                  .addEventListener("click", function () {
                    chrome.identity.getAuthToken(
                      { interactive: !1 },
                      function (t) {
                        chrome.runtime.lastError
                          ? console.log(chrome.runtime.lastError)
                          : chrome.identity.clearAllCachedAuthTokens(
                              function () {
                                (e = null),
                                  chrome.storage.local.remove(
                                    "defaultFolderId",
                                    function () {
                                      chrome.runtime.lastError
                                        ? console.log(
                                            "Error clearing defaultFolderId in the storage:",
                                            chrome.runtime.lastError
                                          )
                                        : fetch(
                                            `https://accounts.google.com/o/oauth2/revoke?token=${t}`
                                          )
                                            .then((e) => {
                                              e.ok
                                                ? chrome.identity.getAuthToken(
                                                    { interactive: !0 },
                                                    function (e) {
                                                      chrome.runtime
                                                        .lastError &&
                                                        console.log(
                                                          chrome.runtime
                                                            .lastError
                                                        ),
                                                        a(e),
                                                        (o = null);
                                                    }
                                                  )
                                                : console.error(
                                                    "Error when revoking token"
                                                  );
                                            })
                                            .catch((e) => {
                                              console.error(
                                                "Error when executing a request to the server:",
                                                e
                                              ),
                                                s(
                                                  "Error when executing a request to the server: " +
                                                    e
                                                );
                                            });
                                    }
                                  );
                              }
                            );
                      }
                    );
                  });
            }
          );
      }),
        (function () {
          let e = document.getElementsByTagName("html");
          for (let t = 0; t < e.length; t++) {
            let n = e[t],
              o = n.innerHTML.toString(),
              r = o.replace(/__MSG_(\w+)__/g, function (e, t) {
                return t ? chrome.i18n.getMessage(t) : "";
              });
            r !== o && (n.innerHTML = r);
          }
        })();
    })();
})();
