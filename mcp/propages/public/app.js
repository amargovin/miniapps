/* Swarajya PRO — pricing calculator + page interactions. Vanilla JS, no deps. */

(function () {
  "use strict";

  var LIST_PRICE = 1999; // ₹ per seat / year, before GST
  var GST_RATE = 0.18;
  var MIN_SEATS = 10;
  var MAX_SEATS = 500;
  var RANGE_MAX = 60; // slider caps here; typed input can go higher

  // Discount tiers, exactly as specified:
  //   10 seats → 10%   ·   11–20 → 20%   ·   21+ → 30%
  function discountFor(seats) {
    if (seats <= 10) return 0.10;
    if (seats <= 20) return 0.20;
    return 0.30;
  }

  function inr(n) {
    return "₹" + Math.round(n).toLocaleString("en-IN");
  }

  var numEl = document.getElementById("seatNum");
  var rangeEl = document.getElementById("seatRange");
  var minusEl = document.getElementById("seatMinus");
  var plusEl = document.getElementById("seatPlus");

  var tierPill = document.getElementById("tierPill");
  var lineSeats = document.getElementById("lineSeats");
  var lineList = document.getElementById("lineList");
  var lineDiscLbl = document.getElementById("lineDiscLbl");
  var lineDisc = document.getElementById("lineDisc");
  var lineSub = document.getElementById("lineSub");
  var lineGst = document.getElementById("lineGst");
  var lineTotal = document.getElementById("lineTotal");
  var linePerSeat = document.getElementById("linePerSeat");
  var calcCta = document.getElementById("calcCta");
  var mailtoCta = document.getElementById("mailtoCta");
  var entNote = document.getElementById("entNote");

  function clampSeats(v) {
    v = parseInt(v, 10);
    if (isNaN(v)) v = MIN_SEATS;
    if (v < MIN_SEATS) v = MIN_SEATS;
    if (v > MAX_SEATS) v = MAX_SEATS;
    return v;
  }

  function buildMailto(seats, total) {
    var subject = "Swarajya PRO — request access (" + seats + " seats)";
    var body =
      "Organisation:\n" +
      "Team size (seats): " + seats + "\n" +
      "Estimated annual total (incl. GST): " + inr(total) + "\n" +
      "How you'd use it:\n" +
      "Name & role:\n";
    return (
      "mailto:pro@swarajyamag.com?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(body)
    );
  }

  function render(seats) {
    var disc = discountFor(seats);
    var discPct = Math.round(disc * 100);
    var list = seats * LIST_PRICE;
    var discAmt = list * disc;
    var subtotal = list - discAmt;
    var gst = subtotal * GST_RATE;
    var total = subtotal + gst;
    var perSeat = LIST_PRICE * (1 - disc);

    tierPill.innerHTML = "Applying <b>" + discPct + "% volume discount</b>";
    lineSeats.textContent = seats + " seats × " + inr(LIST_PRICE);
    lineList.textContent = inr(list);
    lineDiscLbl.textContent = "Volume discount (" + discPct + "%)";
    lineDisc.textContent = "−" + inr(discAmt);
    lineSub.textContent = inr(subtotal);
    lineGst.textContent = inr(gst);
    lineTotal.innerHTML = inr(total) + ' <small>incl. GST</small>';
    linePerSeat.textContent = "≈ " + inr(perSeat) + " / seat / year before GST";

    calcCta.textContent = "Request access for " + seats + " seats →";
    calcCta.href = buildMailto(seats, total);
    if (mailtoCta) mailtoCta.href = buildMailto(seats, total);

    if (seats >= 50) {
      entNote.innerHTML =
        "Buying for a larger team? <a href='mailto:pro@swarajyamag.com?subject=Swarajya%20PRO%20—%20larger%20team%20enquiry'>Talk to us.</a>";
    } else {
      entNote.innerHTML = "";
    }
  }

  function setSeats(v, syncRange) {
    var seats = clampSeats(v);
    numEl.value = seats;
    if (syncRange !== false) {
      rangeEl.value = Math.min(seats, RANGE_MAX);
    }
    render(seats);
  }

  // Wire inputs
  rangeEl.addEventListener("input", function () {
    setSeats(rangeEl.value, false);
  });
  numEl.addEventListener("input", function () {
    var seats = clampSeats(numEl.value);
    rangeEl.value = Math.min(seats, RANGE_MAX);
    render(seats);
  });
  numEl.addEventListener("blur", function () {
    setSeats(numEl.value);
  });
  minusEl.addEventListener("click", function () {
    setSeats(clampSeats(numEl.value) - 1);
  });
  plusEl.addEventListener("click", function () {
    setSeats(clampSeats(numEl.value) + 1);
  });

  // FAQ accordion
  var faq = document.getElementById("faqList");
  if (faq) {
    faq.addEventListener("click", function (e) {
      var btn = e.target.closest(".faq-q");
      if (!btn) return;
      var item = btn.parentElement;
      var answer = item.querySelector(".faq-a");
      var isOpen = item.classList.toggle("open");
      answer.style.maxHeight = isOpen ? answer.scrollHeight + "px" : "0";
    });
  }

  // Footer year
  var yr = document.getElementById("year");
  if (yr) yr.textContent = String(new Date().getFullYear());

  // Init
  setSeats(MIN_SEATS);
})();
