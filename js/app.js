/* GRC Notes — reader app
 * Reads data/topics.json and renders a left-nav + content pane.
 * To add a new topic later: drop the PDF in assets/pdfs/ and add
 * one object to data/topics.json — nothing here needs to change.
 */
(function () {
  "use strict";

  var state = { topics: [], byId: {} };

  var els = {
    sidebarNav: document.getElementById("sidebarNav"),
    main: document.getElementById("main"),
    topbarTitle: document.getElementById("topbarTitle"),
    siteTitle: document.getElementById("siteTitle"),
    siteSubtitle: document.getElementById("siteSubtitle"),
    sidebar: document.getElementById("sidebar"),
    scrim: document.getElementById("scrim"),
    menuBtn: document.getElementById("menuBtn"),
  };

  fetch("data/topics.json")
    .then(function (r) {
      if (!r.ok) throw new Error("topics.json not found");
      return r.json();
    })
    .then(function (data) {
      state.topics = (data.topics || []).slice().sort(function (a, b) {
        return (a.order || 0) - (b.order || 0);
      });
      state.topics.forEach(function (t) { state.byId[t.id] = t; });

      document.title = data.siteTitle || "Docs";
      els.siteTitle.textContent = data.siteTitle || "Docs";
      els.siteSubtitle.textContent = data.siteSubtitle || "";

      buildNav();
      route();
    })
    .catch(function (err) {
      els.main.innerHTML =
        '<div class="landing-hero"><p class="topic-eyebrow">Setup error</p>' +
        "<h1 class='topic-title'>Could not load data/topics.json</h1>" +
        "<p class='topic-summary'>" + escapeHtml(err.message) +
        ". If you opened index.html directly as a file:// URL, some browsers block local fetch() — serve the folder instead, e.g. <code class='tok'>python3 -m http.server</code>, then open it via http://localhost.</p></div>";
      console.error(err);
    });

  window.addEventListener("hashchange", route);

  els.menuBtn.addEventListener("click", function () {
    els.sidebar.classList.toggle("open");
    els.scrim.classList.toggle("open");
  });
  els.scrim.addEventListener("click", closeMenu);

  function closeMenu() {
    els.sidebar.classList.remove("open");
    els.scrim.classList.remove("open");
  }

  function buildNav() {
    var groups = {};
    var order = [];
    state.topics.forEach(function (t) {
      var cat = t.category || "General";
      if (!groups[cat]) { groups[cat] = []; order.push(cat); }
      groups[cat].push(t);
    });

    var html = "";
    order.forEach(function (cat) {
      html += '<div class="nav-group"><div class="nav-group-label">' + escapeHtml(cat) + "</div>";
      groups[cat].forEach(function (t) {
        var num = String(t.order).padStart(2, "0");
        html +=
          '<button class="nav-item" data-id="' + t.id + '">' +
          '<span class="n">' + num + "</span><span>" + escapeHtml(t.menuLabel) + "</span>" +
          "</button>";
      });
      html += "</div>";
    });
    els.sidebarNav.innerHTML = html;

    els.sidebarNav.querySelectorAll(".nav-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        window.location.hash = btn.getAttribute("data-id");
        closeMenu();
      });
    });
  }

  function route() {
    var id = decodeURIComponent(window.location.hash.replace(/^#/, ""));
    var topic = state.byId[id];

    els.sidebarNav.querySelectorAll(".nav-item").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-id") === id);
    });

    if (!topic) {
      renderLanding();
      els.topbarTitle.innerHTML = "<span>Menu</span>Overview";
      return;
    }
    renderTopic(topic);
    els.topbarTitle.innerHTML = "<span>" + escapeHtml((topic.eyebrow || "").toUpperCase()) + "</span>" + escapeHtml(topic.title);
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function renderLanding() {
    var cards = state.topics
      .map(function (t) {
        return (
          '<a class="landing-card" href="#' + t.id + '">' +
          '<span class="n">' + String(t.order).padStart(2, "0") + " / " + t.category + "</span>" +
          "<h3>" + escapeHtml(t.title) + "</h3>" +
          "<p>" + escapeHtml(t.summary) + "</p>" +
          "</a>"
        );
      })
      .join("");

    els.main.innerHTML =
      '<div class="landing-hero">' +
      '<p class="topic-eyebrow">Reference set</p>' +
      '<h1 class="topic-title">SAP Security &amp; GRC — working notes</h1>' +
      '<p class="topic-summary">Short, working-memory summaries for each config area, with the original walkthrough document attached underneath. Pick a topic from the menu' +
      (window.innerWidth <= 880 ? " (tap the ☰ icon above)" : " on the left") +
      ", or start here:</p>" +
      '<div class="landing-list">' + cards + "</div>" +
      "</div>";
  }

  function renderTopic(t) {
    var blocksHtml = (t.blocks || []).map(renderBlock).join("");

    els.main.innerHTML =
      '<p class="topic-eyebrow">' + escapeHtml(t.eyebrow || "") + "</p>" +
      '<h1 class="topic-title">' + escapeHtml(t.title) + "</h1>" +
      '<p class="topic-summary">' + escapeHtml(t.summary) + "</p>" +
      '<div class="topic-meta">' +
      '<span class="meta-chip">⏱ ' + escapeHtml(t.readTime || "") + " read</span>" +
      '<span class="meta-chip">📎 ' + escapeHtml(t.pdfLabel || "") + "</span>" +
      "</div>" +
      blocksHtml +
      renderReference(t);
  }

  function renderBlock(block) {
    switch (block.type) {
      case "intro":
        return '<div class="block"><p class="intro-text">' + inlineFmt(block.text) + "</p></div>";

      case "callout":
        return '<div class="block"><div class="callout">' + inlineFmt(block.text) + "</div></div>";

      case "diagram-note":
        return (
          '<div class="block"><div class="diagram-note">' +
          (block.title ? '<p class="block-title">' + escapeHtml(block.title) + "</p>" : "") +
          "<p>" + inlineFmt(block.text) + "</p></div></div>"
        );

      case "keyvalue":
        var rows = (block.items || [])
          .map(function (it) {
            return (
              '<div class="kv-row"><div class="kv-k">' +
              escapeHtml(it.k) +
              '</div><div class="kv-v">' +
              inlineFmt(it.v) +
              "</div></div>"
            );
          })
          .join("");
        return (
          '<div class="block">' +
          (block.title ? '<p class="block-title">' + escapeHtml(block.title) + "</p>" : "") +
          '<div class="kv-grid">' + rows + "</div></div>"
        );

      case "table":
        var thead = (block.columns || []).map(function (c) { return "<th>" + escapeHtml(c) + "</th>"; }).join("");
        var tbody = (block.rows || [])
          .map(function (r) {
            return "<tr>" + r.map(function (cell) { return "<td>" + inlineFmt(cell) + "</td>"; }).join("") + "</tr>";
          })
          .join("");
        return (
          '<div class="block">' +
          (block.title ? '<p class="block-title">' + escapeHtml(block.title) + "</p>" : "") +
          '<div class="table-wrap"><table class="doc-table"><thead><tr>' +
          thead +
          "</tr></thead><tbody>" +
          tbody +
          "</tbody></table></div></div>"
        );

      case "steps":
        var items = (block.items || [])
          .map(function (it) {
            return '<li><p class="step-h">' + inlineFmt(it.h) + '</p><p class="step-b">' + inlineFmt(it.b) + "</p></li>";
          })
          .join("");
        return (
          '<div class="block">' +
          (block.title ? '<p class="block-title">' + escapeHtml(block.title) + "</p>" : "") +
          '<ol class="steps-list">' + items + "</ol></div>"
        );

      default:
        return "";
    }
  }

  function renderReference(t) {
    var isSmall = window.innerWidth <= 880;
    return (
      '<div class="ref-section">' +
      '<div class="ref-head">' +
      '<div class="ref-file">' +
      '<span class="icon">PDF</span>' +
      '<div><div class="ref-file-name">' + escapeHtml(t.pdfLabel || "Reference.pdf") + "</div>" +
      '<div class="ref-file-sub">Original walkthrough — full screenshots &amp; detail</div></div>' +
      "</div>" +
      '<div class="ref-actions">' +
      '<a class="btn" href="' + t.pdf + '" target="_blank" rel="noopener">Open in new tab</a>' +
      '<a class="btn primary" href="' + t.pdf + '" download>Download</a>' +
      "</div></div>" +
      (isSmall
        ? '<div class="pdf-frame-wrap"><div class="pdf-fallback">PDF preview is easiest full-screen on mobile.<br/><br/><a class="btn primary" style="margin-top:10px" href="' +
          t.pdf +
          '" target="_blank" rel="noopener">Open ' +
          escapeHtml(t.pdfLabel || "PDF") +
          "</a></div></div>"
        : '<div class="pdf-frame-wrap"><iframe src="' + t.pdf + '" title="' + escapeHtml(t.pdfLabel || "PDF") + '"></iframe></div>') +
      "</div>"
    );
  }

  function inlineFmt(str) {
    if (str == null) return "";
    var s = escapeHtml(String(str));
    // simple markup: **bold**, `code`
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/`([^`]+?)`/g, '<code class="tok">$1</code>');
    return s;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
})();
