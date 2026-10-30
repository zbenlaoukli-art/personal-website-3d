(function () {
  var EMAIL = "zbenlaoukli@gmail.com";
  var dialog = document.getElementById("contact-dialog");
  var form = document.getElementById("contact-form");
  var status = document.getElementById("contact-status");
  var submit = form.querySelector("button[type=submit]");

  document.querySelectorAll("[data-contact]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      status.textContent = "";
      status.className = "";
      dialog.showModal();
    });
  });
  dialog.querySelector("[data-close]").addEventListener("click", function () { dialog.close(); });
  dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = Object.fromEntries(new FormData(form));
    if (data._honey) return; // spam bots fill this hidden field

    submit.disabled = true;
    submit.textContent = "Sending…";

    fetch("https://formsubmit.co/ajax/" + EMAIL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        message: data.message,
        _subject: "New message from your website: " + data.name,
        _replyto: data.email,
        _template: "table"
      })
    })
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (String(json.success) !== "true") throw new Error("not sent");
        form.reset();
        status.className = "ok";
        status.textContent = "Thank you! Your message was sent. I’ll reply soon.";
      })
      .catch(function () {
        var link = document.createElement("a");
        link.textContent = "Email me directly instead.";
        link.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent("Website message from " + data.name) +
          "&body=" + encodeURIComponent(data.message + "\n\n" + data.name + " (" + data.email + ")");
        status.className = "";
        status.textContent = "The message couldn’t be sent from here. ";
        status.appendChild(link);
      })
      .finally(function () {
        submit.disabled = false;
        submit.textContent = "Send message";
      });
  });
})();
