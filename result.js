document.addEventListener("DOMContentLoaded", function () {
  const e = new URLSearchParams(window.location.search).get("name");
  document.getElementById("screenshotName").textContent =
    e || "Error: Screenshot name not found.";
}),
  (function () {
    for (
      var e = document.getElementsByTagName("html"), n = 0;
      n < e.length;
      n++
    ) {
      var t = e[n],
        o = t.innerHTML.toString(),
        r = o.replace(/__MSG_(\w+)__/g, function (e, n) {
          return n ? chrome.i18n.getMessage(n) : "";
        });
      r != o && (t.innerHTML = r);
    }
  })();
